import {IconPlus} from "@tabler/icons-react";
import {createGenericCreatePage} from "@coreModule/components/entityPage/pages/createGenericCreatePage.tsx";
import {createSuppressedContactFormSchema} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/suppressedContact/createSuppressedContact.form.validator.ts";
import type {CreateSuppressedContactFormType} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/suppressedContact/suppressedContact.schema-def.ts";

export default createGenericCreatePage<CreateSuppressedContactFormType>({
    languagePath: "src/modules/swissOutreach/clients/panel/private/suppressedContacts/createSuppressedContact.tsx",
    collectionName: "swissoutreachsuppressedcontacts",
    accessModel: "swissoutreachsuppressedcontacts",
    apiUrl: "/api/swissOutreach/suppressedContact",
    schema: createSuppressedContactFormSchema,
    defaultValues: {},
    successPath: "/swissOutreach/doNotContact",
    submitIcon: <IconPlus />,
});
