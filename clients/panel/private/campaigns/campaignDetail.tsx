import {compose} from "redux";
import {useCallback, useEffect, useMemo, useState} from "react";
import {Link} from "react-router-dom";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import apiClient from "@coreModule/helpers/apiClient/apiClient.ts";
import {handleError} from "@coreModule/helpers/general/errors.ts";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";
import type {ProspectCompany} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/prospectCompany/prospectCompany.dto.ts";

type Props = WithLanguageType & {campaignId: string};

type PipelineLog = {
    _id: string;
    step: string;
    level: string;
    message: string;
    createdAt?: string;
};

const RUNNING = new Set(["parsing", "searching", "enriching", "scoring", "sending"]);
const IDLE_DONE = new Set(["completed", "failed", "cancelled", "awaiting_approval"]);

function CampaignDetailPage({campaignId}: Props) {
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [prospects, setProspects] = useState<ProspectCompany[]>([]);
    const [logs, setLogs] = useState<PipelineLog[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const [cRes, pRes, lRes] = await Promise.all([
                apiClient.post<Campaign>("/api/swissOutreach/campaign/single", {_id: campaignId}),
                apiClient.get<{data: ProspectCompany[]}>(`/api/swissOutreach/campaign/${campaignId}/prospects`),
                apiClient.get<{data: PipelineLog[]}>(`/api/swissOutreach/campaign/${campaignId}/logs`),
            ]);
            const next = cRes.data;
            if (!next?._id) {
                setError("Campaign not found");
                setCampaign(null);
                return;
            }
            setCampaign(next);
            setProspects(pRes.data.data || []);
            setLogs(lRes.data.data || []);
            setError(null);
        } catch (e: any) {
            setError(e?.message || "Failed to load campaign");
        }
    }, [campaignId]);

    const status = campaign?.status;
    const isRunning = !!status && RUNNING.has(status);
    const isIdleDone = !!status && IDLE_DONE.has(status);
    const canCancel = !!campaign && !isIdleDone;
    const canApproveSend = status === "awaiting_approval" || status === "completed" || status === "failed";
    const canRestart = !isRunning;

    const latestLog = logs[0];
    const activityLabel = useMemo(() => {
        if (isRunning) return `Working… (${status})`;
        if (status === "awaiting_approval") return "Finished — awaiting email approval";
        if (status === "completed") return "Completed";
        if (status === "failed") return "Failed";
        if (status === "cancelled") return "Cancelled";
        if (status === "draft") return "Not started yet — click Restart";
        return status || "Loading";
    }, [isRunning, status]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (isIdleDone) return;
        const ms = isRunning || status === "draft" ? 1500 : 5000;
        const t = setInterval(() => void load(), ms);
        return () => clearInterval(t);
    }, [load, isIdleDone, isRunning, status]);

    const runAction = async (path: string) => {
        setBusy(true);
        setError(null);
        if (path === "start") {
            setCampaign((prev) => (prev ? {...prev, status: "parsing" as Campaign["status"]} : prev));
            setLogs((prev) => [
                {
                    _id: `local-start-${Date.now()}`,
                    step: "pipeline",
                    level: "info",
                    message: "Pipeline start requested…",
                },
                ...prev,
            ]);
        }
        try {
            await apiClient.post(`/api/swissOutreach/campaign/${path}`, {campaignId});
            await load();
        } catch (e) {
            setError(handleError(e, {context: "CampaignDetail"})?.displayMessage ?? "Action failed");
        } finally {
            setBusy(false);
        }
    };

    if (!campaign && !error) return <div className="p-4 text-sm text-muted-foreground">Loading campaign…</div>;

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">{campaign?.senderCompanyName || "Campaign"}</h1>
                    <p className="text-sm text-muted-foreground">
                        Status: <strong>{campaign?.status}</strong> · Found {campaign?.stats?.found ?? 0} · Enriched{" "}
                        {campaign?.stats?.enriched ?? 0} · Sent {campaign?.stats?.sent ?? 0}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link className="rounded-md border px-3 py-2 text-sm" to={`/swissOutreach/approval?campaignId=${campaignId}`}>
                        Approval
                    </Link>
                    <button
                        disabled={busy || !canRestart}
                        className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                        onClick={() => void runAction("start")}
                        title={!canRestart ? "Pipeline is already running" : undefined}
                    >
                        Restart
                    </button>
                    <button
                        disabled={busy || !canCancel}
                        className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive disabled:opacity-50"
                        onClick={() => void runAction("cancel")}
                    >
                        Cancel
                    </button>
                    <button
                        disabled={busy || !canApproveSend}
                        className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                        onClick={() => void runAction("approveAll")}
                    >
                        Approve all
                    </button>
                    <button
                        disabled={busy || !canApproveSend}
                        className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        onClick={() => void runAction("sendApproved")}
                    >
                        Send approved
                    </button>
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
                {latestLog && (
                    <div className="mt-1 text-xs opacity-90">
                        Latest: [{latestLog.level}] {latestLog.step}: {latestLog.message}
                    </div>
                )}
                {!latestLog && status === "draft" && (
                    <div className="mt-1 text-xs opacity-90">No pipeline logs yet.</div>
                )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {campaign?.lastError && <p className="text-sm text-destructive">Pipeline error: {campaign.lastError}</p>}

            <div>
                <h2 className="mb-2 font-medium">Pipeline logs</h2>
                <ul className="flex flex-col max-h-56 gap-y-1 overflow-auto rounded-md border p-3 text-xs text-foreground">
                    {logs.length === 0 && <li className="text-muted-foreground">Waiting for pipeline activity…</li>}
                    {logs.map((l) => (
                        <li key={l._id}>
                            [{l.level}] {l.step}: {l.message}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="rounded-md border border-border p-3 text-sm whitespace-pre-wrap">{campaign?.jobDescription}</div>

            <div>
                <h2 className="mb-2 font-medium">Prospects (by score) — {prospects.length}</h2>
                <div className="overflow-x-auto rounded-md border">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-muted">
                            <tr>
                                <th className="px-3 py-2">Company</th>
                                <th className="px-3 py-2">Canton</th>
                                <th className="px-3 py-2">Website</th>
                                <th className="px-3 py-2">Email</th>
                                <th className="px-3 py-2">Score</th>
                                <th className="px-3 py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prospects.map((p) => (
                                <tr key={p._id} className="border-t">
                                    <td className="px-3 py-2">{p.companyName}</td>
                                    <td className="px-3 py-2">{p.canton}</td>
                                    <td className="px-3 py-2">
                                        {p.website ? (
                                            <a className="text-info underline" href={p.website} target="_blank" rel="noreferrer">
                                                link
                                            </a>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td className="px-3 py-2">{p.emails?.[0] || "—"}</td>
                                    <td className="px-3 py-2">{p.score ?? "—"}</td>
                                    <td className="px-3 py-2">{p.status}</td>
                                </tr>
                            ))}
                            {!isRunning && prospects.length === 0 && (
                                <tr>
                                    <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                                        No prospects yet. Click Restart to run the pipeline.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default compose(
    withLanguage("src/modules/swissOutreach/clients/panel/private/campaigns/campaignDetail.tsx"),
    withDebug(true, true, "swissOutreachCampaigns"),
)(CampaignDetailPage);
