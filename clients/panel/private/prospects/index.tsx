import {compose} from "redux";
import {useState} from "react";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import useHttpRequest, {type HttpRequest} from "@coreModule/helpers/hooks/useHttpRequest.ts";
import EntityListPage, {EntityListHeader} from "@coreModule/components/entityPage/pages/entityListPage.tsx";
import {NativeSelect, NativeSelectOption} from "@coreModule/components/ui/native-select.tsx";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";
import type {ProspectCompany} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/prospectCompany/prospectCompany.dto.ts";

const LANGUAGE_PATH = "src/modules/swissOutreach/clients/panel/private/prospects/index.tsx";
const CAMPAIGNS_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/campaign"};

type Props = WithLanguageType & {campaignId?: string};

/** Prospect companies of one campaign; without a campaign in the URL, the first one is shown. */
function ProspectsPage({campaignId: initialCampaignId, resolveLanguageKey}: Props) {
    const campaignsRequest = useHttpRequest<{data: Campaign[]}>(CAMPAIGNS_REQUEST, {offset: 0, limit: 100}, 1);
    const campaigns = campaignsRequest.data?.data ?? [];
    const [pickedCampaignId, setCampaignId] = useState(initialCampaignId || "");
    const campaignId = pickedCampaignId || campaigns[0]?._id || "";

    if (!campaignId) {
        return campaignsRequest.loading ? null : <p className="p-4 text-sm text-muted-foreground">{resolveLanguageKey("noCampaigns")}</p>;
    }

    return (
        <EntityListPage<ProspectCompany>
            key={campaignId}
            apiUrl="/api/swissOutreach/prospectCompany"
            collectionName="swissoutreachprospectcompanies"
            accessModel="swissOutreachProspectCompanies"
            tableConfigKey="swissoutreachprospectcompanies"
            header={(ctx) => (
                <EntityListHeader ctx={ctx}>
                    <NativeSelect
                        aria-label={String(resolveLanguageKey("campaign"))}
                        value={campaignId}
                        onChange={(e) => setCampaignId(e.target.value)}
                    >
                        {campaigns.map((c) => (
                            <NativeSelectOption key={c._id} value={c._id}>
                                {c.senderCompanyName}
                            </NativeSelectOption>
                        ))}
                    </NativeSelect>
                </EntityListHeader>
            )}
            buildEditPath={(row) => `/swissOutreach/prospects?campaignId=${row.campaignId}`}
            rowActionMenu={{hideEdit: true}}
            extraFilters={{campaignId}}
            resolveLanguageKey={resolveLanguageKey}
            sheetLanguagePath={LANGUAGE_PATH}
        />
    );
}

export default compose(
    withLanguage(LANGUAGE_PATH),
    withDebug(true, true, "swissOutreachProspectCompanies"),
)(ProspectsPage);
