import {compose} from "redux";
import {useEffect, useState} from "react";
import {
    IconAlertTriangle,
    IconBuilding,
    IconMailForward,
    IconPercentage,
    IconPlayerPlay,
    IconSpeakerphone,
    IconStar,
    IconUsers,
} from "@tabler/icons-react";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import useHttpRequest, {type HttpRequest} from "@coreModule/helpers/hooks/useHttpRequest.ts";
import {KpiCard, type KpiCardProps} from "@coreModule/components/custom/kpiCard.tsx";
import CampaignPicker from "@swissOutreachModule/clients/panel/private/campaigns/campaignPicker.tsx";
import type {SwissOutreachDashboardSummary} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/dashboard/dashboard.dto.ts";
import type {DashboardSummaryFormType} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/dashboard/dashboardSummary.form.validator.ts";

const SUMMARY_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/dashboard/summary"};

const CARDS: {key: keyof SwissOutreachDashboardSummary; icon: KpiCardProps["icon"]; variant?: KpiCardProps["variant"]}[] = [
    {key: "companiesFound", icon: IconBuilding},
    {key: "companiesContacted", icon: IconUsers},
    {key: "emailsSent", icon: IconMailForward, variant: "success"},
    {key: "failures", icon: IconAlertTriangle, variant: "danger"},
    {key: "successRate", icon: IconPercentage},
    {key: "averageScore", icon: IconStar},
    {key: "campaignsTotal", icon: IconSpeakerphone},
    {key: "campaignsActive", icon: IconPlayerPlay, variant: "primary"},
];

/** The company's outreach counts, or one campaign's. */
function DashboardPage({resolveLanguageKey}: WithLanguageType) {
    // No campaign picked: the counts are the company's.
    const [campaignId, setCampaignId] = useState("");

    const [loadCount, setLoadCount] = useState(0);
    useEffect(() => {
        setLoadCount((count) => count + 1);
    }, [campaignId]);
    const body: DashboardSummaryFormType = campaignId ? {campaignId} : {};
    const request = useHttpRequest<{data: SwissOutreachDashboardSummary}>(SUMMARY_REQUEST, body, loadCount);
    const summary = request.data?.data ?? null;

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold">{resolveLanguageKey("title")}</h1>
                <CampaignPicker
                    value={campaignId}
                    onChange={setCampaignId}
                    placeholder={String(resolveLanguageKey("allCampaigns"))}
                    resolveLanguageKey={resolveLanguageKey}
                    className="w-64"
                />
            </div>
            {request.loading && <p className="text-sm text-muted-foreground">{resolveLanguageKey("loading")}</p>}
            {request.error && <p className="text-sm text-destructive">{resolveLanguageKey("loadFailed")}</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {summary && CARDS.map(({key, icon, variant}) => (
                    <KpiCard key={key} title={resolveLanguageKey(`cards.${key}`)} value={summary[key]} icon={icon} variant={variant} compact />
                ))}
            </div>
        </div>
    );
}

export default compose(
    withLanguage("src/modules/swissOutreach/clients/panel/private/dashboard/index.tsx"),
    withDebug(true, true, "swissOutreachCampaigns"),
)(DashboardPage);
