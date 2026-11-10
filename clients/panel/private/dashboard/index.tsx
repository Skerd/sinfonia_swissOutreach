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
import {NativeSelect, NativeSelectOption} from "@coreModule/components/ui/native-select.tsx";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";
import type {SwissOutreachDashboardSummary} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/dashboard/dashboard.dto.ts";
import type {DashboardSummaryFormType} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/dashboard/dashboardSummary.form.validator.ts";

const SUMMARY_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/dashboard/summary"};
const CAMPAIGNS_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/campaign"};

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
    const campaignsRequest = useHttpRequest<{data: Campaign[]}>(CAMPAIGNS_REQUEST, {offset: 0, limit: 100}, 1);
    const campaigns = campaignsRequest.data?.data ?? [];
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
                <NativeSelect
                    aria-label={resolveLanguageKey("campaign")}
                    value={campaignId}
                    onChange={(event) => setCampaignId(event.target.value)}
                >
                    <NativeSelectOption value="">{resolveLanguageKey("allCampaigns")}</NativeSelectOption>
                    {campaigns.map((campaign) => (
                        <NativeSelectOption key={campaign._id} value={campaign._id}>
                            {campaign.name}
                        </NativeSelectOption>
                    ))}
                </NativeSelect>
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
