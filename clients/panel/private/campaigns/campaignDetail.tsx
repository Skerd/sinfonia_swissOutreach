import {compose} from "redux";
import {useEffect, useState} from "react";
import {Link} from "react-router-dom";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import useHttpRequest, {type HttpRequest} from "@coreModule/helpers/hooks/useHttpRequest.ts";
import {useActionAccess} from "@coreModule/helpers/hooks/useActionAccess.ts";
import {handleError} from "@coreModule/helpers/general/errors.ts";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";
import type {ProspectCompany} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/prospectCompany/prospectCompany.dto.ts";
import type {TableResponse} from "armonia/src/modules/core/types/shared.types.ts";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@coreModule/components/ui/table/table.tsx";
import {Button} from "@coreModule/components/ui/button.tsx";
import Paginator from "@coreModule/components/custom/paginator/index.tsx";

type Props = WithLanguageType & {campaignId: string};

type PipelineLog = {
    _id: string;
    step: string;
    level: string;
    message: string;
    createdAt?: string;
};

type CampaignAction = "start" | "cancel" | "approveAll" | "sendApproved";

const RUNNING = new Set(["parsing", "searching", "enriching", "scoring", "sending"]);
const IDLE_DONE = new Set(["completed", "failed", "cancelled", "awaiting_approval"]);

const CAMPAIGN_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/campaign/single"};
const PROSPECTS_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/prospectCompany"};
const LOGS_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/campaign/logs"};
/** Prospects per page, best-scored first. */
const PAGE_SIZE = 20;
const ACTION_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/campaign"};

function CampaignDetailPage({campaignId, resolveLanguageKey}: Props) {
    const [error, setError] = useState<string | null>(null);
    // A requested start shows as running at once; the next load replaces it with the server's state.
    const [startRequested, setStartRequested] = useState(false);

    // The campaign, its prospects and its logs reload together: on open, after an action, and while it runs.
    const [loadCount, setLoadCount] = useState(0);
    const reload = () => setLoadCount((count) => count + 1);
    useEffect(() => {
        setLoadCount((count) => count + 1);
    }, [campaignId]);
    const [offset, setOffset] = useState(0);
    const [limit, setLimit] = useState(PAGE_SIZE);
    // A page change reloads only the prospects.
    const [prospectsPageCount, setProspectsPageCount] = useState(0);
    useEffect(() => {
        setProspectsPageCount((count) => count + 1);
    }, [offset, limit]);
    const campaignRequest = useHttpRequest<Campaign>(CAMPAIGN_REQUEST, {_id: campaignId}, loadCount, true, {
        success: () => setStartRequested(false),
    });
    const prospectsRequest = useHttpRequest<TableResponse<ProspectCompany>>(PROSPECTS_REQUEST, {
        offset,
        limit,
        sortBy: "score",
        sortOrder: "desc",
        filter: {
            id: "campaign-prospects",
            operator: "and",
            rules: [{id: "campaign", field: "campaignId", operator: "equals", value: campaignId}],
            groups: [],
        },
    }, loadCount + prospectsPageCount);
    const logsRequest = useHttpRequest<{data: PipelineLog[]}>(LOGS_REQUEST, {campaignId}, loadCount);
    const campaign = campaignRequest.data?._id ? campaignRequest.data : null;
    const prospects = prospectsRequest.data?.data ?? [];
    const prospectsTotal = prospectsRequest.data?.total ?? prospects.length;
    const logs = logsRequest.data?.data ?? [];
    const loadError = campaignRequest.error || (campaignRequest.data && !campaign) ? resolveLanguageKey("notFound") : null;

    const status = startRequested ? "parsing" : campaign?.status;
    const isRunning = !!status && RUNNING.has(status);
    const isIdleDone = !!status && IDLE_DONE.has(status);
    const canCancel = !!campaign && !isIdleDone;
    const canApproveSend = status === "awaiting_approval" || status === "completed" || status === "failed";
    // The server refuses to start a finished or cancelled campaign (D85).
    const isFinal = status === "completed" || status === "cancelled";
    const canRestart = !isRunning && !isFinal;
    // Each action is a role permission of the (loose) campaign model; without it the button is not shown (D95).
    const mayStart = useActionAccess("swissoutreachcampaigns", "start");
    const mayCancel = useActionAccess("swissoutreachcampaigns", "cancel");
    const mayApproveAll = useActionAccess("swissoutreachcampaigns", "approveAll");
    const maySendApproved = useActionAccess("swissoutreachcampaigns", "sendApproved");

    useEffect(() => {
        if (!campaign || isIdleDone) return;
        const ms = isRunning || status === "draft" ? 1500 : 5000;
        const timer = setInterval(() => setLoadCount((count) => count + 1), ms);
        return () => clearInterval(timer);
    }, [campaign, isIdleDone, isRunning, status]);

    const [action, setAction] = useState<CampaignAction>("start");
    const [actionCount, setActionCount] = useState(0);
    const {loading: busy} = useHttpRequest(ACTION_REQUEST, {campaignId}, actionCount, true, {
        success: reload,
        error: (e) => {
            setStartRequested(false);
            setError(handleError(e, {context: "CampaignDetail"})?.displayMessage ?? resolveLanguageKey("actionFailed"));
        },
    }, {url: `/api/swissOutreach/campaign/${action}`});

    const runAction = (next: CampaignAction) => {
        setError(null);
        if (next === "start") setStartRequested(true);
        setAction(next);
        setActionCount((count) => count + 1);
    };

    const activityLabel = isRunning
        ? resolveLanguageKey("activity.running").replace("{status}", String(resolveLanguageKey(`status.${status}`)))
        : status
          ? resolveLanguageKey(`activity.${status}`)
          : resolveLanguageKey("loading");
    const latestLog = startRequested ? null : logs[0];

    if (!campaign && !loadError) return <div className="p-4 text-sm text-muted-foreground">{resolveLanguageKey("loading")}</div>;

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">{campaign?.name || resolveLanguageKey("campaign")}</h1>
                    <p className="text-sm text-muted-foreground">
                        {resolveLanguageKey("summary")
                            .replace("{status}", String(resolveLanguageKey(`status.${campaign?.status}`)))
                            .replace("{found}", String(campaign?.stats?.found ?? 0))
                            .replace("{enriched}", String(campaign?.stats?.enriched ?? 0))
                            .replace("{sent}", String(campaign?.stats?.sent ?? 0))}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="lg">
                        <Link to={`/swissOutreach/approval?campaignId=${campaignId}`}>{resolveLanguageKey("approval")}</Link>
                    </Button>
                    {mayStart && <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        disabled={busy || !canRestart}
                        onClick={() => runAction("start")}
                        title={isRunning ? String(resolveLanguageKey("alreadyRunning")) : isFinal ? String(resolveLanguageKey("cannotRestart")) : undefined}
                    >
                        {resolveLanguageKey("restart")}
                    </Button>}
                    {mayCancel && <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="border-destructive/30 text-destructive hover:text-destructive"
                        disabled={busy || !canCancel}
                        onClick={() => runAction("cancel")}
                    >
                        {resolveLanguageKey("cancel")}
                    </Button>}
                    {mayApproveAll && <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        disabled={busy || !canApproveSend}
                        onClick={() => runAction("approveAll")}
                    >
                        {resolveLanguageKey("approveAll")}
                    </Button>}
                    {maySendApproved && <Button
                        type="button"
                        size="lg"
                        disabled={busy || !canApproveSend}
                        onClick={() => runAction("sendApproved")}
                    >
                        {resolveLanguageKey("sendApproved")}
                    </Button>}
                </div>
            </div>

            <div
                className={`rounded-md border px-3 py-2 text-sm ${
                    isRunning
                        ? "border-warning/30 bg-warning/10 text-warning"
                        : status === "awaiting_approval"
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-border bg-muted text-muted-foreground"
                }`}
            >
                <div className="font-medium">{activityLabel}</div>
                {startRequested && <div className="mt-1 text-xs opacity-90">{resolveLanguageKey("startRequested")}</div>}
                {latestLog && (
                    <div className="mt-1 text-xs opacity-90">
                        {resolveLanguageKey("latest")}: [{latestLog.level}] {latestLog.step}: {latestLog.message}
                    </div>
                )}
                {!latestLog && !startRequested && status === "draft" && (
                    <div className="mt-1 text-xs opacity-90">{resolveLanguageKey("noLogsYet")}</div>
                )}
            </div>

            {(error || loadError) && <p className="text-sm text-destructive">{error || loadError}</p>}
            {campaign?.lastError && (
                <p className="text-sm text-destructive">{resolveLanguageKey("pipelineError")}: {campaign.lastError}</p>
            )}

            <div>
                <h2 className="mb-2 font-medium">{resolveLanguageKey("logsTitle")}</h2>
                <ul className="flex flex-col max-h-56 gap-y-1 overflow-auto rounded-md border p-3 text-xs text-foreground">
                    {logs.length === 0 && <li className="text-muted-foreground">{resolveLanguageKey("waitingForActivity")}</li>}
                    {logs.map((l) => (
                        <li key={l._id}>
                            [{l.level}] {l.step}: {l.message}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="rounded-md border border-border p-3 text-sm whitespace-pre-wrap">{campaign?.jobDescription}</div>

            <div>
                <h2 className="mb-2 font-medium">{resolveLanguageKey("prospectsTitle").replace("{count}", String(prospectsTotal))}</h2>
                <div className="rounded-md border">
                    <Table className="text-left">
                        <TableHeader>
                            <TableRow>
                                <TableHead>{resolveLanguageKey("columns.company")}</TableHead>
                                <TableHead>{resolveLanguageKey("columns.canton")}</TableHead>
                                <TableHead>{resolveLanguageKey("columns.website")}</TableHead>
                                <TableHead>{resolveLanguageKey("columns.email")}</TableHead>
                                <TableHead>{resolveLanguageKey("columns.score")}</TableHead>
                                <TableHead>{resolveLanguageKey("columns.status")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {prospects.map((p) => (
                                <TableRow key={p._id}>
                                    <TableCell>{p.companyName}</TableCell>
                                    <TableCell>{p.canton}</TableCell>
                                    <TableCell>
                                        {p.website ? (
                                            <a className="text-info underline" href={p.website} target="_blank" rel="noreferrer">
                                                {resolveLanguageKey("websiteLink")}
                                            </a>
                                        ) : (
                                            "—"
                                        )}
                                    </TableCell>
                                    <TableCell>{p.emails[0] || "—"}</TableCell>
                                    <TableCell>{p.score ?? "—"}</TableCell>
                                    <TableCell>{resolveLanguageKey(`prospectStatus.${p.status}`)}</TableCell>
                                </TableRow>
                            ))}
                            {!isRunning && prospects.length === 0 && (
                                <TableRow>
                                    <TableCell className="py-6 text-muted-foreground" colSpan={6}>
                                        {resolveLanguageKey("noProspects")}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                {prospectsTotal > 0 && (
                    <Paginator
                        total={prospectsTotal}
                        limit={PAGE_SIZE}
                        loading={prospectsRequest.loading}
                        setOffset={setOffset}
                        setLimit={setLimit}
                    />
                )}
            </div>
        </div>
    );
}

export default compose(
    withLanguage("src/modules/swissOutreach/clients/panel/private/campaigns/campaignDetail.tsx"),
    withDebug(true, true, "swissOutreachCampaigns"),
)(CampaignDetailPage);
