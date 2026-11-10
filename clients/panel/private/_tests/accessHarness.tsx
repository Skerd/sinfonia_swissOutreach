import {useState, type ReactNode} from "react";
import {Provider} from "react-redux";
import {configureStore} from "@reduxjs/toolkit";
import type {AccessAllFormResponseType} from "armonia/src/modules/core/api/user/private/permissions/accessAll.form.response.type.ts";
import {AccessProvider, useAccessHydrated} from "@coreModule/helpers/context/accessContext.tsx";

const grants = {read: true, write: true, create: true, delete: true, restore: true, tableConfiguration: false};

/** What `/access/all` returns for the outreach models: loose, so no `others` (keyed by collection, as maestro does). */
export const OUTREACH_ACCESS_ALL: AccessAllFormResponseType = {
    swissoutreachcampaigns: {self: grants},
    swissoutreachemails: {self: grants},
};

/** Every outreach `@action` tag, as a role granting them all carries them. */
export const ALL_OUTREACH_ACTIONS = [
    "swissoutreachemails[action:approve]",
    "swissoutreachemails[action:skip]",
    "swissoutreachemails[action:editDraft]",
    "swissoutreachemails[action:doNotContact]",
    "swissoutreachcampaigns[action:approveAll]",
    "swissoutreachcampaigns[action:sendApproved]",
    "swissoutreachcampaigns[action:start]",
    "swissoutreachcampaigns[action:cancel]",
];

/** Renders once the access map has loaded, so a test never sees the pre-load verdict. */
function WhenHydrated({children}: {children: ReactNode}) {
    return useAccessHydrated() ? <>{children}</> : null;
}

/**
 * The session (its role permissions) and the real `AccessProvider`. The test's `apiClient` mock must answer
 * `apiClient.post("/api/user/permissions/access/all")` with {@link OUTREACH_ACCESS_ALL}.
 */
export function SessionWith({permissions, children}: {permissions: string[]; children: ReactNode}) {
    const [store] = useState(() => configureStore({reducer: {authentication: () => ({token: "t", user: {permissions}})}}));
    return (
        <Provider store={store}>
            <AccessProvider>
                <WhenHydrated>{children}</WhenHydrated>
            </AccessProvider>
        </Provider>
    );
}
