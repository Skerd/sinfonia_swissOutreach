import {compose} from "redux";
import {useEffect, useState} from "react";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import apiClient from "@coreModule/helpers/axiosClients/apiClient.ts";
import type {SwissOutreachDashboardSummary} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/dashboard/dashboard.dto.ts";

function DashboardPage({}: WithLanguageType) {
    const [summary, setSummary] = useState<SwissOutreachDashboardSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void (async () => {
            setLoading(true);
            try {
                const res = await apiClient.get<{data: SwissOutreachDashboardSummary}>("/api/swissOutreach/dashboard/summary");
                setSummary(res.data.data);
            } catch (e: any) {
                setError(e?.message || "Failed to load dashboard");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const cards = summary
        ? [
              {label: "Companies found", value: summary.companiesFound},
              {label: "Companies contacted", value: summary.companiesContacted},
              {label: "Emails sent", value: summary.emailsSent},
              {label: "Failures", value: summary.failures},
              {label: "Success rate %", value: summary.successRate},
              {label: "Average score", value: summary.averageScore},
              {label: "Campaigns", value: summary.campaignsTotal},
              {label: "Active campaigns", value: summary.campaignsActive},
              {label: "Replies (future)", value: summary.repliesReceived},
          ]
        : [];

    return (
        <div className="flex flex-col gap-4 p-4">
            <h1 className="text-xl font-semibold">Swiss Outreach Dashboard</h1>
            {loading && <p className="text-sm text-muted-foreground">Loading metrics…</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((c) => (
                    <div key={c.label} className="rounded-md border border-border p-4">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
                        <div className="mt-2 text-2xl font-semibold">{c.value}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default compose(
    withLanguage("src/modules/swissOutreach/clients/panel/private/dashboard/index.tsx"),
    withDebug(true, true),
)(DashboardPage);
