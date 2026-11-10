import {compose} from "redux";
import {IconPlus} from "@tabler/icons-react";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import EntityListPage, {EntityListCreateButton, EntityListHeader} from "@coreModule/components/entityPage/pages/entityListPage.tsx";
import type {SuppressedContact} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/suppressedContact/suppressedContact.dto.ts";

const LANGUAGE_PATH = "src/modules/swissOutreach/clients/panel/private/suppressedContacts/index.tsx";

/** The company's do-not-contact list. Entries are added or removed, never edited. */
function SuppressedContactsPage({resolveLanguageKey}: WithLanguageType) {
    return (
        <EntityListPage<SuppressedContact>
            apiUrl="/api/swissOutreach/suppressedContact"
            collectionName="swissoutreachsuppressedcontacts"
            accessModel="swissoutreachsuppressedcontacts"
            tableConfigKey="swissoutreachsuppressedcontacts"
            header={(ctx) => (
                <EntityListHeader ctx={ctx}>
                    <EntityListCreateButton ctx={ctx} path="/swissOutreach/doNotContact/create" icon={<IconPlus />} />
                </EntityListHeader>
            )}
            buildEditPath={() => "/swissOutreach/doNotContact"}
            rowActionMenu={{hideEdit: true}}
            resolveLanguageKey={resolveLanguageKey}
            sheetLanguagePath={LANGUAGE_PATH}
        />
    );
}

export default compose(
    withLanguage(LANGUAGE_PATH),
    withDebug(true, true, "swissoutreachsuppressedcontacts"),
)(SuppressedContactsPage);
