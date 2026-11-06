import {lazy} from "react";
import type {
    RouteConfigArgs,
    RouteConfigContribution,
} from "@coreModule/helpers/types/routeConfigContribution.types.ts";

// Pages load on first visit (D21); the panel shell's Suspense boundary shows the loader.
const CampaignsPage = lazy(() => import("@swissOutreachModule/clients/panel/private/campaigns/index.tsx"));
const CreateCampaignPage = lazy(() => import("@swissOutreachModule/clients/panel/private/campaigns/createCampaign.tsx"));
const CampaignDetailPage = lazy(() => import("@swissOutreachModule/clients/panel/private/campaigns/campaignDetail.tsx"));
const ApprovalPage = lazy(() => import("@swissOutreachModule/clients/panel/private/approval/index.tsx"));
const DashboardPage = lazy(() => import("@swissOutreachModule/clients/panel/private/dashboard/index.tsx"));
const ProspectsPage = lazy(() => import("@swissOutreachModule/clients/panel/private/prospects/index.tsx"));

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
