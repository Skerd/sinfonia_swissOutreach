import {IconSend} from "@tabler/icons-react";
import {createGenericCreatePage} from "@coreModule/components/entityPage/pages/createGenericCreatePage.tsx";
import {createCampaignFormSchema} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/createCampaign.form.validator.ts";
import type {CreateCampaignFormType} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.schema-def.ts";

/** Creating a campaign starts its pipeline on the server (`afterCreate`). */
export default createGenericCreatePage<CreateCampaignFormType>({
    languagePath: "src/modules/swissOutreach/clients/panel/private/campaigns/createCampaign.tsx",
    collectionName: "swissoutreachcampaigns",
    accessModel: "swissOutreachCampaigns",
    apiUrl: "/api/swissOutreach/campaign",
    schema: createCampaignFormSchema,
    defaultValues: {
        country: "Switzerland",
        cantons: ["BS", "BL"],
        maxCompanies: 20,
        language: "de",
        emailTone: "professional",
        sendAutomatically: false,
    },
    successPath: "/swissOutreach/campaigns",
    submitIcon: <IconSend />,
});
