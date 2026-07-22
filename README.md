# Swiss Outreach Module (Sinfonia)

Panel UI for Swiss B2B outreach: create campaigns from a job description, monitor pipeline progress, review/approve drafted emails, and inspect discovered prospects.

Types and validators come from **armonia**; API calls target **maestro** routes under `/api/swissOutreach/`.

Enable via `VITE_ENABLED_MODULES=core,swissOutreach` (maestro must also list `swissOutreach` in `ENABLED_MODULES`).

Platform docs: [`docs/swiss-outreach/`](../../../../docs/swiss-outreach/).

## Scope

Operators paste a job/project description, pick Swiss cantons and language/tone, then let the backend discover companies (ZEFIX), enrich contacts, score fit, and draft personalized quotation emails (de/fr/it/en). By default, emails require human approval before send.

## Directory layout

```
swissOutreach/
├── assets/languages/                 # Module i18n (en-US, de-CH, fr-CH, it-CH, sq-AL)
└── clients/panel/
    ├── private/
    │   ├── dashboard/                # Aggregate campaign metrics
    │   ├── campaigns/                # List, create, detail (+ live status)
    │   ├── approval/                 # Edit / approve / skip drafts; approve-all
    │   └── prospects/                # Prospect companies for a campaign
    ├── sidebarContribution.tsx       # Swiss Outreach nav group
    ├── routeConfigContribution.tsx   # /swissOutreach/* routes
    └── widgetContribution.tsx        # Placeholder (no widgets yet)
```

## Panel pages

Routes are registered in `routeConfigContribution.tsx` and appear under the **Swiss Outreach** sidebar group (`order: 55`).

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/swissOutreach/dashboard` | Summary counters from `/api/swissOutreach/dashboard/summary` |
| Campaigns | `/swissOutreach/campaigns` | Campaign list |
| Create campaign | `/swissOutreach/campaigns/create` | Job text, cantons, max companies, language/tone, sender identity |
| Campaign detail | `/swissOutreach/campaigns/detail?campaignId=` | Status, stats, prospects, pipeline logs; restart / cancel; link to approval |
| Approval | `/swissOutreach/approval?campaignId=` | Draft queue: edit, approve, skip, approve-all |
| Prospects | `/swissOutreach/prospects?campaignId=` | Companies discovered/enriched for a campaign |

Campaign detail polls every 5s while the pipeline is non-terminal (`completed` / `failed` / `cancelled`).

## Operator flow

1. **Create** — submit job description + cantons + sender → `PUT /api/swissOutreach/campaign`
2. **Watch** — detail page shows pipeline status and prospect list
3. **Approve** — review drafts on the approval page (`approve` / `editDraft` / `skip` / `approveAll`)
4. **Send** — maestro sends approved emails (or auto-sends when `sendAutomatically` was set at create)

## Contributions

- **Sidebar** (`order: 55`) — Dashboard, Campaigns, Approval, Prospects
- **Routes** (`order: 55`) — maps `swissOutreach` menu/subview segments to page components
- **Widgets** — empty contribution reserved for future dashboard tiles

## Path alias

```ts
import CampaignsPage from "@swissOutreachModule/clients/panel/private/campaigns/index.tsx";
```

Configured in `sinfonia/tsconfig.json` as `@swissOutreachModule/*` → `src/modules/swissOutreach/*`.

## Related packages

| Package | Location |
|---------|----------|
| Armonia contracts | [`armonia/src/modules/swissOutreach`](../../../../armonia/src/modules/swissOutreach/README.md) |
| API / pipeline | [`maestro/modules/swissOutreach`](../../../../maestro/modules/swissOutreach/README.md) |
| Platform docs | [`docs/swiss-outreach/`](../../../../docs/swiss-outreach/) |
