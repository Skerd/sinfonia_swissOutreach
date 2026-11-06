import {compose} from "redux";
import {useNavigate} from "react-router-dom";
import {IconExternalLink, IconPlus} from "@tabler/icons-react";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import EntityListPage, {EntityListCreateButton, EntityListHeader} from "@coreModule/components/entityPage/pages/entityListPage.tsx";
import {DropdownMenuItem} from "@coreModule/components/ui/dropdown-menu.tsx";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";

const LANGUAGE_PATH = "src/modules/swissOutreach/clients/panel/private/campaigns/index.tsx";

export function campaignDetailPath(campaign: {_id: string}) {
    return `/swissOutreach/campaigns/detail?campaignId=${campaign._id}`;
}

/** Campaigns have no edit form: a row opens its pipeline detail page. */
function CampaignsPage({resolveLanguageKey}: WithLanguageType) {
    const navigate = useNavigate();
    return (
        <EntityListPage<Campaign>
            apiUrl="/api/swissOutreach/campaign"
            collectionName="swissoutreachcampaigns"
            accessModel="swissOutreachCampaigns"
            tableConfigKey="swissoutreachcampaigns"
            header={(ctx) => (
                <EntityListHeader ctx={ctx}>
                    <EntityListCreateButton ctx={ctx} path="/swissOutreach/campaigns/create" icon={<IconPlus />} />
                </EntityListHeader>
            )}
            buildEditPath={campaignDetailPath}
            rowActionMenu={{hideEdit: true}}
            resolveLanguageKey={resolveLanguageKey}
            sheetLanguagePath={LANGUAGE_PATH}
            renderActionMenuChildren={(campaign) => (
                <DropdownMenuItem onClick={() => navigate(campaignDetailPath(campaign))}>
                    <IconExternalLink size={16} />
                    {resolveLanguageKey("open")}
                </DropdownMenuItem>
            )}
        />
    );
}

export default compose(
    withLanguage(LANGUAGE_PATH),
    withDebug(true, true, "swissOutreachCampaigns"),
)(CampaignsPage);
