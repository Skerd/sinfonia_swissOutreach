import {compose} from "redux";
import {useEffect, useMemo, useState} from "react";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import useHttpRequest, {type HttpRequest} from "@coreModule/helpers/hooks/useHttpRequest.ts";
import {useActionAccess} from "@coreModule/helpers/hooks/useActionAccess.ts";
import {handleError} from "@coreModule/helpers/general/errors.ts";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";
import type {ProspectCompany} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/prospectCompany/prospectCompany.dto.ts";
import type {OutreachEmail} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/outreachEmail/outreachEmail.dto.ts";
import type {OutreachEmailStatusValue} from "armonia/src/modules/swissOutreach/types/constants.ts";
import type {FilterGroup} from "armonia/src/modules/core/database/filter/filter.types.ts";
import type {TableResponse} from "armonia/src/modules/core/types/shared.types.ts";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@coreModule/components/ui/table/table.tsx";
import {Button} from "@coreModule/components/ui/button.tsx";
import {Input} from "@coreModule/components/ui/input.tsx";
import {Textarea} from "@coreModule/components/ui/textarea.tsx";
import {NativeSelect, NativeSelectOption} from "@coreModule/components/ui/native-select.tsx";
import CampaignPicker from "@swissOutreachModule/clients/panel/private/campaigns/campaignPicker.tsx";
import Paginator from "@coreModule/components/custom/paginator/index.tsx";
import OutreachEmailSheetView from "./outreachEmailSheetView.tsx";

type Props = WithLanguageType & {campaignId?: string};

type EmailAction = "approve" | "skip" | "editDraft" | "doNotContact";
type Draft = {toEmail: string; subject: string; body: string};

/** Which emails the queue shows: the ones still to decide, or what became of the others. */
const VIEWS = ["pending", "failed", "sent", "skipped"] as const;
type View = (typeof VIEWS)[number];
const VIEW_STATUSES: Record<View, OutreachEmailStatusValue[]> = {
    pending: ["draft", "edited", "approved"],
    failed: ["failed"],
    sent: ["queued", "sent"],
    skipped: ["skipped"],
};
/** A sent email, or one being sent, is history: it is not rewritten, approved or skipped (the server refuses). */
const SENT: OutreachEmailStatusValue[] = ["queued", "sent"];
const PAGE_SIZE = 20;

const CAMPAIGNS_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/campaign"};
const EMAILS_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/outreachEmail"};
const PROSPECTS_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/prospectCompany"};

/** The campaign's emails in the chosen view, as the email list filters them. */
const queueFilter = (campaignId: string, view: View): FilterGroup => ({
    id: "approval-queue",
    operator: "and",
    rules: [
        {id: "campaign", field: "campaignId", operator: "equals", value: campaignId},
        {id: "status", field: "status", operator: "in", value: VIEW_STATUSES[view]},
    ],
    groups: [],
});
const campaignFilter = (campaignId: string): FilterGroup => ({
    id: "campaign-prospects",
    operator: "and",
    rules: [{id: "campaign", field: "campaignId", operator: "equals", value: campaignId}],
    groups: [],
});
const EMAIL_ACTION_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/outreachEmail"};
const APPROVE_ALL_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/campaign/approveAll"};

const draftOf = (email: OutreachEmail): Draft => ({toEmail: email.toEmail ?? "", subject: email.subject, body: email.body});

function ApprovalPage({campaignId: initialCampaignId, resolveLanguageKey}: Props) {
    // Without a campaign in the URL, the first one is shown; any other is found by searching the picker.
    const firstCampaignRequest = useHttpRequest<{data: Campaign[]}>(CAMPAIGNS_REQUEST, {offset: 0, limit: 1}, initialCampaignId ? 0 : 1);
    const [pickedCampaignId, setCampaignId] = useState(initialCampaignId || "");
    const campaignId = pickedCampaignId || firstCampaignRequest.data?.data[0]?._id || "";
    const [view, setView] = useState<View>("pending");
    const [offset, setOffset] = useState(0);
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [detailsId, setDetailsId] = useState<string | null>(null);

    // One page of the queue reloads on a campaign, view or page change and after every action; then its prospects.
    const [loadCount, setLoadCount] = useState(0);
    const reload = () => setLoadCount((count) => count + 1);
    useEffect(() => {
        if (campaignId) setLoadCount((count) => count + 1);
    }, [campaignId, view, offset, limit]);
    const [prospectIds, setProspectIds] = useState<string[]>([]);
    const [prospectLoadCount, setProspectLoadCount] = useState(0);
    const emailsRequest = useHttpRequest<TableResponse<OutreachEmail>>(EMAILS_REQUEST, {
        offset,
        limit,
        filter: queueFilter(campaignId, view),
    }, loadCount, true, {
        success: (response) => {
            setDrafts({});
            const ids = [...new Set(response.data.map((email) => email.prospectCompanyId))];
            setProspectIds(ids);
            if (ids.length > 0) setProspectLoadCount((count) => count + 1);
        },
    });
    // Only the prospects of the emails on this page (the list route takes their ids).
    const prospectsRequest = useHttpRequest<TableResponse<ProspectCompany>>(PROSPECTS_REQUEST, {
        offset: 0,
        limit: Math.max(prospectIds.length, 1),
        ids: prospectIds,
        filter: campaignFilter(campaignId),
    }, prospectLoadCount);
    const loadFailed = emailsRequest.error != null || prospectsRequest.error != null;
    const total = emailsRequest.data?.total ?? 0;

    // Recipient/subject/body edits not saved yet, by email id.
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const rows = useMemo(() => {
        const prospects = new Map((prospectsRequest.data?.data ?? []).map((p) => [p._id, p]));
        return (emailsRequest.data?.data ?? []).map((email) => {
            const stored = draftOf(email);
            const draft = drafts[email._id] ?? stored;
            // Approving sends the stored email, so an unsaved edit must be saved first.
            const unsaved = draft.toEmail !== stored.toEmail || draft.subject !== stored.subject || draft.body !== stored.body;
            return {email, draft, unsaved, decidable: !SENT.includes(email.status), prospect: prospects.get(email.prospectCompanyId)};
        });
    }, [emailsRequest.data, prospectsRequest.data, drafts]);

    const [emailAction, setEmailAction] = useState<{action: EmailAction; payload: Record<string, unknown>}>({action: "approve", payload: {}});
    const [emailActionCount, setEmailActionCount] = useState(0);
    const emailActionRequest = useHttpRequest<{data: OutreachEmail}>(EMAIL_ACTION_REQUEST, emailAction.payload, emailActionCount, true, {
        success: (response) => {
            // The server skips, rather than approves, an email to an address on the do-not-contact list.
            if (emailAction.action === "approve" && response.data?.status === "skipped") setNotice(resolveLanguageKey("skippedDoNotContact"));
            reload();
        },
        error: (e) => setError(handleError(e, {context: "Approval"})?.displayMessage ?? resolveLanguageKey("actionFailed")),
    }, {url: `/api/swissOutreach/outreachEmail/${emailAction.action}`});
    const busyId = emailActionRequest.loading ? String(emailAction.payload.emailId) : null;

    const [approveAllCount, setApproveAllCount] = useState(0);
    const approveAllRequest = useHttpRequest(APPROVE_ALL_REQUEST, {campaignId}, approveAllCount, true, {
        success: reload,
        error: (e) => setError(handleError(e, {context: "Approval"})?.displayMessage ?? resolveLanguageKey("approveAllFailed")),
    });

    const act = (emailId: string, action: EmailAction, payload: Record<string, unknown> = {}) => {
        setError(null);
        setNotice(null);
        setEmailAction({action, payload: {emailId, ...payload}});
        setEmailActionCount((count) => count + 1);
    };

    /** Saves the subject and body as shown, and the recipient when it was changed. */
    const saveDraft = (email: OutreachEmail, draft: Draft) => {
        const toEmail = draft.toEmail.trim();
        act(email._id, "editDraft", {subject: draft.subject, body: draft.body, ...(toEmail && toEmail !== email.toEmail ? {toEmail} : {})});
    };

    const approveAll = () => {
        if (!campaignId) return;
        setError(null);
        setNotice(null);
        setApproveAllCount((count) => count + 1);
    };

    const editDraft = (email: OutreachEmail, patch: Partial<Draft>) =>
        setDrafts((previous) => ({...previous, [email._id]: {...(previous[email._id] ?? draftOf(email)), ...patch}}));

    // Each action is a role permission of its (loose) model; without it the control is not shown (D95).
    const mayApprove = useActionAccess("swissoutreachemails", "approve");
    const maySkip = useActionAccess("swissoutreachemails", "skip");
    const mayEditDraft = useActionAccess("swissoutreachemails", "editDraft");
    const mayDoNotContact = useActionAccess("swissoutreachemails", "doNotContact");
    const mayApproveAll = useActionAccess("swissoutreachcampaigns", "approveAll");

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold">{resolveLanguageKey("title")}</h1>
                <div className="flex flex-wrap gap-2">
                    <CampaignPicker
                        value={campaignId}
                        onChange={(picked) => {
                            if (!picked) return;
                            setCampaignId(picked);
                            setOffset(0);
                        }}
                        placeholder={String(resolveLanguageKey("campaign"))}
                        resolveLanguageKey={resolveLanguageKey}
                        className="w-64"
                    />
                    <NativeSelect aria-label={resolveLanguageKey("view")} value={view} onChange={(e) => {
                        const next = VIEWS.find((option) => option === e.target.value);
                        if (!next) return;
                        setView(next);
                        setOffset(0);
                    }}>
                        {VIEWS.map((option) => (
                            <NativeSelectOption key={option} value={option}>
                                {resolveLanguageKey(`views.${option}`)}
                            </NativeSelectOption>
                        ))}
                    </NativeSelect>
                    {mayApproveAll && (
                        <Button type="button" variant="outline" disabled={approveAllRequest.loading} onClick={approveAll}>
                            {resolveLanguageKey("approveAll")}
                        </Button>
                    )}
                </div>
            </div>
            {(error || loadFailed) && <p className="text-sm text-destructive">{error || resolveLanguageKey("loadFailed")}</p>}
            {notice && <p className="text-sm text-warning">{notice}</p>}
            <div className="rounded-md border">
                <Table className="text-left">
                    <TableHeader>
                        <TableRow>
                            <TableHead>{resolveLanguageKey("columns.company")}</TableHead>
                            <TableHead>{resolveLanguageKey("columns.website")}</TableHead>
                            <TableHead>{resolveLanguageKey("columns.email")}</TableHead>
                            <TableHead>{resolveLanguageKey("columns.score")}</TableHead>
                            <TableHead>{resolveLanguageKey("columns.generatedEmail")}</TableHead>
                            <TableHead>{resolveLanguageKey("columns.actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map(({email, draft, unsaved, decidable, prospect}) => {
                            const editable = mayEditDraft && decidable;
                            const busy = busyId === email._id;
                            return (
                                <TableRow key={email._id} className="align-top">
                                    <TableCell className="whitespace-normal">{prospect?.companyName || email.prospectCompanyId}</TableCell>
                                    <TableCell>
                                        {prospect?.website ? (
                                            <a href={prospect.website} className="text-info underline" target="_blank" rel="noreferrer">
                                                {resolveLanguageKey("websiteLink")}
                                            </a>
                                        ) : (
                                            "—"
                                        )}
                                    </TableCell>
                                    <TableCell className="min-w-[200px]">
                                        <Input
                                            type="email"
                                            aria-label={resolveLanguageKey("toEmail")}
                                            className="h-7 w-full rounded px-2 py-1 text-xs md:text-xs"
                                            value={draft.toEmail}
                                            placeholder="—"
                                            readOnly={!editable}
                                            onChange={(e) => editDraft(email, {toEmail: e.target.value})}
                                        />
                                    </TableCell>
                                    <TableCell>{prospect?.score ?? "—"}</TableCell>
                                    <TableCell className="min-w-[280px] whitespace-normal">
                                        <Input
                                            aria-label={resolveLanguageKey("subject")}
                                            className="mb-1 h-7 w-full rounded px-2 py-1 text-xs md:text-xs"
                                            value={draft.subject}
                                            readOnly={!editable}
                                            onChange={(e) => editDraft(email, {subject: e.target.value})}
                                        />
                                        <Textarea
                                            aria-label={resolveLanguageKey("body")}
                                            className="h-28 min-h-0 w-full rounded px-2 py-1 text-xs md:text-xs"
                                            value={draft.body}
                                            readOnly={!editable}
                                            onChange={(e) => editDraft(email, {body: e.target.value})}
                                        />
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            {resolveLanguageKey("statusLabel")}: {resolveLanguageKey(`emailStatus.${email.status}`)}
                                        </div>
                                        {email.lastError && (
                                            <p className="mt-1 text-xs text-destructive">
                                                {resolveLanguageKey("lastError")}: {resolveLanguageKey(`lastErrorReasons.${email.lastError}`, true) || email.lastError}
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            {editable && <Button
                                                type="button"
                                                variant="outline"
                                                size="xs"
                                                disabled={busy}
                                                onClick={() => saveDraft(email, draft)}
                                            >
                                                {resolveLanguageKey("saveEdit")}
                                            </Button>}
                                            {mayApprove && decidable && <Button
                                                type="button"
                                                size="xs"
                                                disabled={busy || !email.toEmail || unsaved}
                                                aria-describedby={unsaved ? `unsaved-${email._id}` : undefined}
                                                onClick={() => act(email._id, "approve")}
                                            >
                                                {resolveLanguageKey("approve")}
                                            </Button>}
                                            {maySkip && decidable && email.status !== "skipped" && <Button
                                                type="button"
                                                variant="outline"
                                                size="xs"
                                                disabled={busy}
                                                onClick={() => act(email._id, "skip")}
                                            >
                                                {resolveLanguageKey("skip")}
                                            </Button>}
                                            {mayDoNotContact && <Button
                                                type="button"
                                                variant="outline"
                                                size="xs"
                                                className="border-destructive/30 text-destructive hover:text-destructive"
                                                disabled={busy || !email.toEmail}
                                                onClick={() => act(email._id, "doNotContact")}
                                            >
                                                {resolveLanguageKey("doNotContact")}
                                            </Button>}
                                            <Button type="button" variant="ghost" size="xs" onClick={() => setDetailsId(email._id)}>
                                                {resolveLanguageKey("details")}
                                            </Button>
                                            {mayApprove && decidable && unsaved && (
                                                <p id={`unsaved-${email._id}`} className="max-w-[10rem] text-xs text-muted-foreground">
                                                    {resolveLanguageKey("saveBeforeApprove")}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="py-6 text-muted-foreground">
                                    {resolveLanguageKey(`emptyView.${view}`)}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {total > 0 && (
                <Paginator
                    key={`${campaignId}:${view}`}
                    total={total}
                    limit={PAGE_SIZE}
                    loading={emailsRequest.loading}
                    setOffset={setOffset}
                    setLimit={setLimit}
                />
            )}
            {detailsId && (
                <OutreachEmailSheetView open fetchId={detailsId} onOpenChange={(open: boolean) => !open && setDetailsId(null)} />
            )}
        </div>
    );
}

export default compose(
    withLanguage("src/modules/swissOutreach/clients/panel/private/approval/index.tsx"),
    withDebug(true, true, "swissOutreachEmails"),
)(ApprovalPage);
