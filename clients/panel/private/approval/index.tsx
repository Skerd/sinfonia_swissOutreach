import {compose} from "redux";
import {useCallback, useEffect, useMemo, useState} from "react";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import apiClient from "@coreModule/helpers/axiosClients/apiClient.ts";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";
import type {ProspectCompany} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/prospectCompany/prospectCompany.dto.ts";
import type {OutreachEmail} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/outreachEmail/outreachEmail.dto.ts";

type Props = WithLanguageType & {campaignId?: string};

type Row = OutreachEmail & {prospect?: ProspectCompany};

function ApprovalPage({campaignId: initialCampaignId}: Props) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [campaignId, setCampaignId] = useState(initialCampaignId || "");
    const [rows, setRows] = useState<Row[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        void (async () => {
            const res = await apiClient.post<{data: Campaign[]}>("/api/swissOutreach/campaign", {offset: 0, limit: 100});
            const list = res.data.data || [];
            setCampaigns(list);
            if (!campaignId && list[0]) setCampaignId(list[0]._id);
        })();
    }, []);

    const load = useCallback(async () => {
        if (!campaignId) return;
        setError(null);
        try {
            const [emailsRes, prospectsRes] = await Promise.all([
                apiClient.get<{data: OutreachEmail[]}>(`/api/swissOutreach/campaign/${campaignId}/emails`),
                apiClient.get<{data: ProspectCompany[]}>(`/api/swissOutreach/campaign/${campaignId}/prospects`),
            ]);
            const prospects = Object.fromEntries((prospectsRes.data.data || []).map((p) => [p._id, p]));
            setRows((emailsRes.data.data || []).map((e) => ({...e, prospect: prospects[e.prospectCompanyId]})));
        } catch (e: any) {
            setError(e?.message || "Failed to load approval queue");
        }
    }, [campaignId]);

    useEffect(() => {
        void load();
    }, [load]);

    const pending = useMemo(() => rows.filter((r) => ["draft", "edited", "approved"].includes(r.status)), [rows]);

    const act = async (emailId: string, action: "approve" | "skip" | "editDraft", payload?: {subject?: string; body?: string}) => {
        setBusyId(emailId);
        try {
            await apiClient.post(`/api/swissOutreach/outreachEmail/${action}`, {emailId, ...payload});
            await load();
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Action failed");
        } finally {
            setBusyId(null);
        }
    };

    const approveAll = async () => {
        if (!campaignId) return;
        setBusyId("all");
        try {
            await apiClient.post("/api/swissOutreach/campaign/approveAll", {campaignId});
            await load();
        } catch (e: any) {
            setError(e?.message || "Approve all failed");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold">Email Approval</h1>
                <div className="flex gap-2">
                    <select className="rounded-md border px-2 py-2 text-sm" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                        {campaigns.map((c) => (
                            <option key={c._id} value={c._id}>
                                {c.senderCompanyName} ({c.status})
                            </option>
                        ))}
                    </select>
                    <button className="rounded-md border px-3 py-2 text-sm" disabled={busyId === "all"} onClick={() => void approveAll()}>
                        Approve all
                    </button>
                </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-muted">
                        <tr>
                            <th className="px-3 py-2">Company</th>
                            <th className="px-3 py-2">Website</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2">Score</th>
                            <th className="px-3 py-2">Generated email</th>
                            <th className="px-3 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pending.map((row) => (
                            <tr key={row._id} className="border-t align-top">
                                <td className="px-3 py-2">{row.prospect?.companyName || row.prospectCompanyId}</td>
                                <td className="px-3 py-2">
                                    {row.prospect?.website ? (
                                        <a href={row.prospect.website} className="text-info underline" target="_blank" rel="noreferrer">
                                            site
                                        </a>
                                    ) : (
                                        "—"
                                    )}
                                </td>
                                <td className="px-3 py-2">{row.toEmail || "—"}</td>
                                <td className="px-3 py-2">{row.prospect?.score ?? "—"}</td>
                                <td className="px-3 py-2 min-w-[280px]">
                                    <input
                                        className="mb-1 w-full rounded border px-2 py-1 text-xs"
                                        value={row.subject}
                                        onChange={(e) =>
                                            setRows((prev) => prev.map((r) => (r._id === row._id ? {...r, subject: e.target.value} : r)))
                                        }
                                    />
                                    <textarea
                                        className="h-28 w-full rounded border px-2 py-1 text-xs"
                                        value={row.body}
                                        onChange={(e) =>
                                            setRows((prev) => prev.map((r) => (r._id === row._id ? {...r, body: e.target.value} : r)))
                                        }
                                    />
                                    <div className="mt-1 text-xs text-muted-foreground">Status: {row.status}</div>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex flex-col gap-1">
                                        <button
                                            className="rounded border px-2 py-1 text-xs"
                                            disabled={busyId === row._id}
                                            onClick={() => void act(row._id, "editDraft", {subject: row.subject, body: row.body})}
                                        >
                                            Save edit
                                        </button>
                                        <button
                                            className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
                                            disabled={busyId === row._id || !row.toEmail}
                                            onClick={() => void act(row._id, "approve")}
                                        >
                                            Approve
                                        </button>
                                        <button
                                            className="rounded border px-2 py-1 text-xs"
                                            disabled={busyId === row._id}
                                            onClick={() => void act(row._id, "skip")}
                                        >
                                            Skip
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {pending.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                                    No emails awaiting review for this campaign.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default compose(
    withLanguage("src/modules/swissOutreach/clients/panel/private/approval/index.tsx"),
    withDebug(true, true),
)(ApprovalPage);
