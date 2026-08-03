import {compose} from "redux";
import {useCallback, useEffect, useState} from "react";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import apiClient from "@coreModule/helpers/axiosClients/apiClient.ts";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";
import type {ProspectCompany} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/prospectCompany/prospectCompany.dto.ts";

type Props = WithLanguageType & {campaignId?: string};

function ProspectsPage({campaignId: initialCampaignId}: Props) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [campaignId, setCampaignId] = useState(initialCampaignId || "");
    const [prospects, setProspects] = useState<ProspectCompany[]>([]);

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
        const res = await apiClient.get<{data: ProspectCompany[]}>(`/api/swissOutreach/campaign/${campaignId}/prospects`);
        setProspects(res.data.data || []);
    }, [campaignId]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-semibold">Prospects</h1>
                <select className="rounded-md border px-2 py-2 text-sm" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                    {campaigns.map((c) => (
                        <option key={c._id} value={c._id}>
                            {c.senderCompanyName}
                        </option>
                    ))}
                </select>
            </div>
            <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-muted">
                        <tr>
                            <th className="px-3 py-2">Company</th>
                            <th className="px-3 py-2">UID</th>
                            <th className="px-3 py-2">Canton</th>
                            <th className="px-3 py-2">Score</th>
                            <th className="px-3 py-2">Summary</th>
                        </tr>
                    </thead>
                    <tbody>
                        {prospects.map((p) => (
                            <tr key={p._id} className="border-t align-top">
                                <td className="px-3 py-2">{p.companyName}</td>
                                <td className="px-3 py-2">{p.uid || "—"}</td>
                                <td className="px-3 py-2">{p.canton || "—"}</td>
                                <td className="px-3 py-2">{p.score ?? "—"}</td>
                                <td className="px-3 py-2 max-w-md text-xs text-muted-foreground">{p.summary || p.scoreReason || "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default compose(
    withLanguage("src/modules/swissOutreach/clients/panel/private/prospects/index.tsx"),
    withDebug(true, true),
)(ProspectsPage);
