import {compose} from "redux";
import {useCallback, useEffect, useState} from "react";
import {Link} from "react-router-dom";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import apiClient from "@coreModule/helpers/axiosClients/apiClient.ts";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";

function CampaignsPage({}: WithLanguageType) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.post<{data: Campaign[]}>("/api/swissOutreach/campaign", {
                offset: 0,
                limit: 50,
            });
            setCampaigns(res.data.data || []);
        } catch (e: any) {
            setError(e?.message || "Failed to load campaigns");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-semibold">Swiss Outreach Campaigns</h1>
                <Link
                    to="/swissOutreach/campaigns/create"
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
                >
                    New campaign
                </Link>
            </div>
            {loading && <p className="text-sm text-slate-500">Loading…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-3 py-2">Sender</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Language</th>
                            <th className="px-3 py-2">Found</th>
                            <th className="px-3 py-2">Sent</th>
                            <th className="px-3 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {campaigns.map((c) => (
                            <tr key={c._id} className="border-t border-slate-100">
                                <td className="px-3 py-2">{c.senderCompanyName}</td>
                                <td className="px-3 py-2">{c.status}</td>
                                <td className="px-3 py-2">{c.language}</td>
                                <td className="px-3 py-2">{c.stats?.found ?? 0}</td>
                                <td className="px-3 py-2">{c.stats?.sent ?? 0}</td>
                                <td className="px-3 py-2">
                                    <Link
                                        className="text-sky-700 underline"
                                        to={`/swissOutreach/campaigns/detail?campaignId=${c._id}`}
                                    >
                                        Open
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {!loading && campaigns.length === 0 && (
                            <tr>
                                <td className="px-3 py-6 text-slate-500" colSpan={6}>
                                    No campaigns yet.
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
    withLanguage("src/modules/swissOutreach/clients/panel/private/campaigns/index.tsx"),
    withDebug(true, true),
)(CampaignsPage);
