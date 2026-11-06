import {compose} from "redux";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import useHttpRequest, {type HttpRequest} from "@coreModule/helpers/hooks/useHttpRequest.ts";
import type {SwissOutreachDashboardSummary} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/dashboard/dashboard.dto.ts";

const SUMMARY_REQUEST: HttpRequest = {method: "get", url: "/api/swissOutreach/dashboard/summary"};

const CARD_KEYS = [
    "companiesFound",
    "companiesContacted",
    "emailsSent",
    "failures",
    "successRate",
    "averageScore",
    "campaignsTotal",
    "campaignsActive",
    "repliesReceived",
] as const satisfies readonly (keyof SwissOutreachDashboardSummary)[];

function DashboardPage({resolveLanguageKey}: WithLanguageType) {
    const request = useHttpRequest<{data: SwissOutreachDashboardSummary}>(SUMMARY_REQUEST, {}, 1);
    const summary = request.data?.data ?? null;

    return (
        <div className="flex flex-col gap-4 p-4">
            <h1 className="text-xl font-semibold">{resolveLanguageKey("title")}</h1>
            {request.loading && <p className="text-sm text-muted-foreground">{resolveLanguageKey("loading")}</p>}
            {request.error && <p className="text-sm text-destructive">{resolveLanguageKey("loadFailed")}</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {summary && CARD_KEYS.map((key) => (
                    <div key={key} className="rounded-md border border-border p-4">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{resolveLanguageKey(`cards.${key}`)}</div>
                        <div className="mt-2 text-2xl font-semibold">{summary[key]}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default compose(
    withLanguage("src/modules/swissOutreach/clients/panel/private/dashboard/index.tsx"),
    withDebug(true, true, "swissOutreachCampaigns"),
)(DashboardPage);
