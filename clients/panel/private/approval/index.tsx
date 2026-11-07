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
import {Table} from "@coreModule/components/ui/table/table.tsx";
import {Button} from "@coreModule/components/ui/button.tsx";
import {Input} from "@coreModule/components/ui/input.tsx";
import {Textarea} from "@coreModule/components/ui/textarea.tsx";
import {NativeSelect, NativeSelectOption} from "@coreModule/components/ui/native-select.tsx";

type Props = WithLanguageType & {campaignId?: string};

type EmailAction = "approve" | "skip" | "editDraft";
type Draft = {subject: string; body: string};

const CAMPAIGNS_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/campaign"};
const LIST_REQUEST: HttpRequest = {method: "get", url: "/api/swissOutreach/campaign"};
const EMAIL_ACTION_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/outreachEmail"};
const APPROVE_ALL_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/campaign/approveAll"};

function ApprovalPage({campaignId: initialCampaignId, resolveLanguageKey}: Props) {
    const campaignsRequest = useHttpRequest<{data: Campaign[]}>(CAMPAIGNS_REQUEST, {offset: 0, limit: 100}, 1);
    const campaigns = campaignsRequest.data?.data ?? [];
    const [pickedCampaignId, setCampaignId] = useState(initialCampaignId || "");
    // Without a campaign in the URL, the first one is shown.
    const campaignId = pickedCampaignId || campaigns[0]?._id || "";
    const [error, setError] = useState<string | null>(null);

    // The queue (emails + their prospects) reloads on a campaign change and after every action.
    const [loadCount, setLoadCount] = useState(0);
    const reload = () => setLoadCount((count) => count + 1);
    useEffect(() => {
        if (campaignId) setLoadCount((count) => count + 1);
    }, [campaignId]);
    const emailsRequest = useHttpRequest<{data: OutreachEmail[]}>(LIST_REQUEST, {}, loadCount, true, {
        success: () => setDrafts({}),
    }, {url: `/api/swissOutreach/campaign/${campaignId}/emails`});
    const prospectsRequest = useHttpRequest<{data: ProspectCompany[]}>(LIST_REQUEST, {}, loadCount, true, {}, {
        url: `/api/swissOutreach/campaign/${campaignId}/prospects`,
    });
    const loadFailed = emailsRequest.error != null || prospectsRequest.error != null;

    // Subject/body edits not saved yet, by email id.
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const pending = useMemo(() => {
        const prospects = new Map((prospectsRequest.data?.data ?? []).map((p) => [p._id, p]));
        return (emailsRequest.data?.data ?? [])
            .filter((e) => ["draft", "edited", "approved"].includes(e.status))
            .map((e) => {
                const draft = drafts[e._id];
                // Approving sends the stored text, so an unsaved edit must be saved first.
                const unsaved = draft != null && (draft.subject !== e.subject || draft.body !== e.body);
                return {...e, ...draft, unsaved, prospect: prospects.get(e.prospectCompanyId)};
            });
    }, [emailsRequest.data, prospectsRequest.data, drafts]);

    const [emailAction, setEmailAction] = useState<{action: EmailAction; payload: Record<string, unknown>}>({action: "approve", payload: {}});
    const [emailActionCount, setEmailActionCount] = useState(0);
    const emailActionRequest = useHttpRequest(EMAIL_ACTION_REQUEST, emailAction.payload, emailActionCount, true, {
        success: reload,
        error: (e) => setError(handleError(e, {context: "Approval"})?.displayMessage ?? resolveLanguageKey("actionFailed")),
    }, {url: `/api/swissOutreach/outreachEmail/${emailAction.action}`});
    const busyId = emailActionRequest.loading ? String(emailAction.payload.emailId) : null;

    const [approveAllCount, setApproveAllCount] = useState(0);
    const approveAllRequest = useHttpRequest(APPROVE_ALL_REQUEST, {campaignId}, approveAllCount, true, {
        success: reload,
        error: (e) => setError(handleError(e, {context: "Approval"})?.displayMessage ?? resolveLanguageKey("approveAllFailed")),
    });

    const act = (emailId: string, action: EmailAction, draft?: Draft) => {
        setError(null);
        setEmailAction({action, payload: {emailId, ...draft}});
        setEmailActionCount((count) => count + 1);
    };

    const approveAll = () => {
        if (!campaignId) return;
        setError(null);
        setApproveAllCount((count) => count + 1);
    };

    const editDraft = (emailId: string, patch: Partial<Draft>, current: Draft) =>
        setDrafts((previous) => ({...previous, [emailId]: {...current, ...previous[emailId], ...patch}}));

    // Each action is a role permission of its (loose) model; without it the control is not shown (D95).
    const mayApprove = useActionAccess("swissoutreachemails", "approve");
    const maySkip = useActionAccess("swissoutreachemails", "skip");
    const mayEditDraft = useActionAccess("swissoutreachemails", "editDraft");
    const mayApproveAll = useActionAccess("swissoutreachcampaigns", "approveAll");

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold">{resolveLanguageKey("title")}</h1>
                <div className="flex gap-2">
                    <NativeSelect
                        aria-label={String(resolveLanguageKey("campaign"))}
                        value={campaignId}
                        onChange={(e) => setCampaignId(e.target.value)}
                    >
                        {campaigns.map((c) => (
                            <NativeSelectOption key={c._id} value={c._id}>
                                {c.senderCompanyName} ({resolveLanguageKey(`status.${c.status}`)})
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
            <div className="overflow-x-auto rounded-md border">
                <Table bare className="min-w-full text-left text-sm">
                    <thead className="bg-muted">
                        <tr>
                            <th className="px-3 py-2">{resolveLanguageKey("columns.company")}</th>
                            <th className="px-3 py-2">{resolveLanguageKey("columns.website")}</th>
                            <th className="px-3 py-2">{resolveLanguageKey("columns.email")}</th>
                            <th className="px-3 py-2">{resolveLanguageKey("columns.score")}</th>
                            <th className="px-3 py-2">{resolveLanguageKey("columns.generatedEmail")}</th>
                            <th className="px-3 py-2">{resolveLanguageKey("columns.actions")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pending.map((row) => (
                            <tr key={row._id} className="border-t align-top">
                                <td className="px-3 py-2">{row.prospect?.companyName || row.prospectCompanyId}</td>
                                <td className="px-3 py-2">
                                    {row.prospect?.website ? (
                                        <a href={row.prospect.website} className="text-info underline" target="_blank" rel="noreferrer">
                                            {resolveLanguageKey("websiteLink")}
                                        </a>
                                    ) : (
                                        "—"
                                    )}
                                </td>
                                <td className="px-3 py-2">{row.toEmail || "—"}</td>
                                <td className="px-3 py-2">{row.prospect?.score ?? "—"}</td>
                                <td className="px-3 py-2 min-w-[280px]">
                                    <Input
                                        aria-label={String(resolveLanguageKey("subject"))}
                                        className="mb-1 h-7 w-full rounded px-2 py-1 text-xs md:text-xs"
                                        value={row.subject}
                                        readOnly={!mayEditDraft}
                                        onChange={(e) => editDraft(row._id, {subject: e.target.value}, row)}
                                    />
                                    <Textarea
                                        aria-label={String(resolveLanguageKey("body"))}
                                        className="h-28 min-h-0 w-full rounded px-2 py-1 text-xs md:text-xs"
                                        value={row.body}
                                        readOnly={!mayEditDraft}
                                        onChange={(e) => editDraft(row._id, {body: e.target.value}, row)}
                                    />
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {resolveLanguageKey("statusLabel")}: {resolveLanguageKey(`emailStatus.${row.status}`)}
                                    </div>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex flex-col gap-1">
                                        {mayEditDraft && <Button
                                            type="button"
                                            variant="outline"
                                            size="xs"
                                            disabled={busyId === row._id}
                                            onClick={() => act(row._id, "editDraft", {subject: row.subject, body: row.body})}
                                        >
                                            {resolveLanguageKey("saveEdit")}
                                        </Button>}
                                        {mayApprove && <Button
                                            type="button"
                                            size="xs"
                                            disabled={busyId === row._id || !row.toEmail || row.unsaved}
                                            aria-describedby={row.unsaved ? `unsaved-${row._id}` : undefined}
                                            onClick={() => act(row._id, "approve")}
                                        >
                                            {resolveLanguageKey("approve")}
                                        </Button>}
                                        {maySkip && <Button
                                            type="button"
                                            variant="outline"
                                            size="xs"
                                            disabled={busyId === row._id}
                                            onClick={() => act(row._id, "skip")}
                                        >
                                            {resolveLanguageKey("skip")}
                                        </Button>}
                                        {mayApprove && row.unsaved && (
                                            <p id={`unsaved-${row._id}`} className="max-w-[10rem] text-xs text-muted-foreground">
                                                {resolveLanguageKey("saveBeforeApprove")}
                                            </p>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {pending.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                                    {resolveLanguageKey("empty")}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </div>
        </div>
    );
}

export default compose(
    withLanguage("src/modules/swissOutreach/clients/panel/private/approval/index.tsx"),
    withDebug(true, true, "swissOutreachEmails"),
)(ApprovalPage);
