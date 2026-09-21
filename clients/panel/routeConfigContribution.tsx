import CampaignsPage from "@swissOutreachModule/clients/panel/private/campaigns/index.tsx";
import CreateCampaignPage from "@swissOutreachModule/clients/panel/private/campaigns/createCampaign.tsx";
import CampaignDetailPage from "@swissOutreachModule/clients/panel/private/campaigns/campaignDetail.tsx";
import ApprovalPage from "@swissOutreachModule/clients/panel/private/approval/index.tsx";
import DashboardPage from "@swissOutreachModule/clients/panel/private/dashboard/index.tsx";
import ProspectsPage from "@swissOutreachModule/clients/panel/private/prospects/index.tsx";
import type {
    RouteConfigArgs,
    RouteConfigContribution,
} from "@coreModule/helpers/types/routeConfigContribution.types.ts";

const swissOutreachRouteConfigContribution: RouteConfigContribution = {
    id: "swissOutreach",
    order: 55,
    contributeRoutes({menu, subview, segments, searchParams}: RouteConfigArgs) {
        if (menu !== "swissOutreach") return undefined;
        const action = segments[2];
        const campaignId = searchParams.get("campaignId") || undefined;

        if (subview === "dashboard") return <DashboardPage />;
        if (subview === "approval") return <ApprovalPage campaignId={campaignId} />;
        if (subview === "prospects") return <ProspectsPage campaignId={campaignId} />;
        if (subview === "campaigns") {
            if (action === "create") return <CreateCampaignPage />;
            if (action === "detail" && campaignId) return <CampaignDetailPage campaignId={campaignId} />;
            return <CampaignsPage />;
        }
        return undefined;
    },
};

export default swissOutreachRouteConfigContribution;
