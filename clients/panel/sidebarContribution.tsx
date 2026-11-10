import {IconChartBar, IconMail, IconMailOff, IconSpeakerphone, IconSquareCheck} from "@tabler/icons-react";
import type {SidebarContribution} from "@coreModule/helpers/types/sidebarContribution.types.ts";
import type {NavGroup, NavItem} from "@coreModule/helpers/types/sidebarNav.types.ts";
import type {ResolveLanguageKey} from "@coreModule/helpers/hocs/withLanguage.tsx";

const swissOutreachSidebarContribution: SidebarContribution = {
    id: "swissOutreach",
    order: 55,
    getNavGroups(resolveLanguageKey: ResolveLanguageKey): NavGroup[] {
        // Each page shows only to a user who may read its records (FE-04).
        const items: NavItem[] = [
            {
                title: resolveLanguageKey("menus.swissOutreach.dashboard.title"),
                url: "/swissOutreach/dashboard",
                icon: IconChartBar,
                permissions: ["swissoutreachcampaigns"],
                usersPermissions: [],
                atLeastOnePermission: true,
            },
            {
                title: resolveLanguageKey("menus.swissOutreach.campaigns.title"),
                url: "/swissOutreach/campaigns",
                icon: IconSpeakerphone,
                permissions: ["swissoutreachcampaigns"],
                usersPermissions: [],
                atLeastOnePermission: true,
            },
            {
                title: resolveLanguageKey("menus.swissOutreach.approval.title"),
                url: "/swissOutreach/approval",
                icon: IconSquareCheck,
                permissions: ["swissoutreachemails"],
                usersPermissions: [],
                atLeastOnePermission: true,
            },
            {
                title: resolveLanguageKey("menus.swissOutreach.prospects.title"),
                url: "/swissOutreach/prospects",
                icon: IconMail,
                permissions: ["swissoutreachprospectcompanies"],
                usersPermissions: [],
                atLeastOnePermission: true,
            },
            {
                title: resolveLanguageKey("menus.swissOutreach.doNotContact.title"),
                url: "/swissOutreach/doNotContact",
                icon: IconMailOff,
                permissions: ["swissoutreachsuppressedcontacts"],
                usersPermissions: [],
                atLeastOnePermission: true,
            },
        ];
        return [
            {
                title: resolveLanguageKey("menus.swissOutreach.title"),
                permissions: [],
                usersPermissions: [],
                atLeastOnePermission: true,
                items,
            },
        ];
    },
};

export default swissOutreachSidebarContribution;
