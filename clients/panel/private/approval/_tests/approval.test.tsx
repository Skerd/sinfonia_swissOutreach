import {act, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ComponentType} from "react";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";
import type {OutreachEmail} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/outreachEmail/outreachEmail.dto.ts";
import type {ProspectCompany} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/prospectCompany/prospectCompany.dto.ts";

// `post` answers the access map request of the real `AccessProvider`.
const {apiClientMock} = vi.hoisted(() => ({apiClientMock: Object.assign(vi.fn(), {post: vi.fn()})}));

vi.mock("@coreModule/helpers/apiClient/apiClient.ts", () => ({default: apiClientMock}));
vi.mock("sonner", () => ({toast: Object.assign(vi.fn(), {loading: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn()})}));
/** Echoes the key; a lookup that may miss (`orNull`) finds only the known reason codes, as the dictionary does. */
const {resolveKey} = vi.hoisted(() => ({
    resolveKey: (key: string, orNull?: boolean) => (orNull && !key.startsWith("lastErrorReasons.do_not_contact") ? null : key),
}));
vi.mock("@coreModule/helpers/hocs/withLanguage.tsx", () => ({
    default: () => (Wrapped: ComponentType<Record<string, unknown>>) =>
        (props: Record<string, unknown>) => <Wrapped {...props} resolveLanguageKey={resolveKey}/>,
}));
vi.mock("@coreModule/helpers/hocs/withDebug.tsx", () => ({
    default: () => (Wrapped: ComponentType<Record<string, unknown>>) => Wrapped,
}));
vi.mock("@coreModule/components/custom/sessionSetupScreen.tsx", () => ({SessionSetupScreen: () => null, SESSION_SETUP_TOTAL_STEPS: 3}));
// The campaign picker searches the select route (TD-B146); the stub shows what it holds and lets a test pick.
const picker = vi.hoisted(() => ({pick: (_value: string, _label?: string) => {}}));
vi.mock("@coreModule/components/viewEngine/widgets/inputs/apiSelect/apiSelect.tsx", () => ({
    ApiSelect: ({apiUrl, value, onValueChange, defaultOptions}: {
        apiUrl: string;
        value: string;
        onValueChange: (value: string, label?: string) => void;
        defaultOptions?: {value: string; label: string}[];
    }) => {
        picker.pick = onValueChange;
        return <output data-testid="campaign-picker" data-url={apiUrl} data-value={value}>{defaultOptions?.[0]?.label}</output>;
    },
}));

import ApprovalPage from "../index.tsx";
import {ALL_OUTREACH_ACTIONS, OUTREACH_ACCESS_ALL, SessionWith} from "../../_tests/accessHarness.tsx";

/** The page for a session holding `permissions` (every outreach action by default). */
function renderPage(props: {campaignId?: string} = {}, permissions: string[] = ALL_OUTREACH_ACTIONS) {
    return render(<SessionWith permissions={permissions}><ApprovalPage {...props}/></SessionWith>);
}

const campaign = (id: string, senderCompanyName: string): Campaign => ({
    _id: id, name: `${senderCompanyName} campaign`, jobDescription: "Painters", country: "CH", cantons: ["ZH"], maxCompanies: 20, language: "de", emailTone: "professional",
    sendAutomatically: false, senderCompanyName, senderName: "Sam", senderEmail: "sam@example.ch", status: "awaiting_approval",
    stats: {found: 2, enriched: 2, scored: 2, approved: 0, sent: 0, failed: 0},
});

const email = (id: string, overrides: Partial<OutreachEmail> = {}): OutreachEmail => ({
    _id: id, campaignId: "c1", prospectCompanyId: `pc-${id}`, toEmail: `${id}@example.ch`, subject: `Subject ${id}`, body: `Body ${id}`,
    language: "de", status: "draft", attempts: 0, ...overrides,
});

const prospect = (id: string, companyName: string, overrides: Partial<ProspectCompany> = {}): ProspectCompany => ({
    _id: id, campaignId: "c1", companyName, emails: [], phones: [], languages: [], services: [], status: "scored", dedupeKey: id, ...overrides,
});

const campaigns = [campaign("c1", "Alpha AG"), campaign("c2", "Beta GmbH")];
/** The campaign's emails; the email list answers with those in the queue filter's statuses. */
const emails = [
    email("e1", {prospectCompanyId: "pc1"}),
    email("e2", {status: "edited", toEmail: undefined}),
    email("e3", {status: "failed", lastError: "550 Mailbox unavailable"}),
    email("e4", {status: "sent"}),
    email("e5", {status: "skipped", lastError: "do_not_contact"}),
];
const prospects = [prospect("pc1", "Maler Meier", {score: 87, website: "https://meier.ch"})];

type Call = {method: string; url: string; data: Record<string, unknown>};

/** The statuses a list request is filtered to. */
const statusesOf = (call: Call) => (call.data.filter as {rules: {field: string; value: unknown}[]}).rules.find((rule) => rule.field === "status")?.value;

function serve({actionError, actionData = {}, emailsTotal}: {actionError?: unknown; actionData?: Record<string, unknown>; emailsTotal?: number} = {}) {
    apiClientMock.mockImplementation((call: Call) => {
        const {method, url} = call;
        if (method === "post" && url === "/api/swissOutreach/campaign") return Promise.resolve({data: {data: campaigns.slice(0, Number(call.data.limit))}});
        if (method === "post" && url === "/api/swissOutreach/campaign/single") {
            return Promise.resolve({data: campaigns.find((c) => c._id === call.data._id)});
        }
        if (url === "/api/swissOutreach/outreachEmail") {
            const statuses = statusesOf(call);
            const shown = emails.filter((e) => Array.isArray(statuses) && statuses.includes(e.status));
            return Promise.resolve({data: {data: shown, total: emailsTotal ?? shown.length}});
        }
        if (url === "/api/swissOutreach/prospectCompany") return Promise.resolve({data: {data: prospects, total: prospects.length}});
        if (actionError) return Promise.reject(actionError);
        return Promise.resolve({data: {data: actionData}});
    });
}

const calls = (): Call[] => apiClientMock.mock.calls.map(([config]) => config);
const actionCalls = () => calls()
    .filter((c) => c.url.startsWith("/api/swissOutreach/outreachEmail/") || c.url === "/api/swissOutreach/campaign/approveAll")
    .map(({url, data}) => ({url, data}));
/** The campaign a list request is filtered to. */
const campaignOf = (call: Call) => (call.data.filter as {rules: {field: string; value: unknown}[]}).rules.find((rule) => rule.field === "campaignId")?.value;
const queueCalls = () => calls().filter((c) => c.url === "/api/swissOutreach/outreachEmail");
const queueLoads = (campaignId: string) => queueCalls().filter((c) => campaignOf(c) === campaignId).length;

async function rowOf(text: string) {
    const tr = (await screen.findByText(text)).closest("tr");
    if (!tr) throw new Error(`expected a row for ${text}`);
    return tr;
}

describe("swissOutreach approval queue", () => {
    beforeEach(() => {
        apiClientMock.mockReset();
        apiClientMock.post.mockResolvedValue({data: OUTREACH_ACCESS_ALL});
    });

    it("opens the first campaign when none is given, and loads its emails and prospects through their lists", async () => {
        serve();
        renderPage();

        await rowOf("Maler Meier");
        const picked = screen.getByTestId("campaign-picker");
        expect(picked).toHaveAttribute("data-value", "c1");
        expect(picked).toHaveAttribute("data-url", "/api/swissOutreach/campaign/select");
        // Only the first campaign is listed; the picker searches the rest
        expect(calls().find((c) => c.url === "/api/swissOutreach/campaign")?.data).toMatchObject({limit: 1});
        await waitFor(() => expect(picked).toHaveTextContent("Alpha AG campaign"));
        const prospectsLoad = calls().find((c) => c.url === "/api/swissOutreach/prospectCompany");
        expect(prospectsLoad && campaignOf(prospectsLoad)).toBe("c1");
        expect(queueLoads("c1")).toBe(1);
    });

    it("opens the campaign it was linked to", async () => {
        serve();
        renderPage({campaignId: "c2"});

        await waitFor(() => expect(queueLoads("c2")).toBe(1));
        expect(queueLoads("c1")).toBe(0);
    });

    it("asks the email list for the emails still to decide, and joins them with their prospect", async () => {
        serve();
        renderPage();

        const row = await rowOf("Maler Meier");
        expect(within(row).getByRole("link", {name: "websiteLink"})).toHaveAttribute("href", "https://meier.ch");
        expect(within(row).getByText("87")).toBeInTheDocument();
        // A prospect that did not load shows its id.
        expect(screen.getByText("pc-e2")).toBeInTheDocument();
        const queueLoad = calls().find((c) => c.url === "/api/swissOutreach/outreachEmail")!;
        expect((queueLoad.data.filter as {rules: unknown[]}).rules).toEqual(expect.arrayContaining([
            expect.objectContaining({field: "status", operator: "in", value: ["draft", "edited", "approved"]}),
        ]));
    });

    it("cannot approve an email without a recipient", async () => {
        serve();
        renderPage();

        expect(within(await rowOf("pc-e2")).getByRole("button", {name: "approve"})).toBeDisabled();
        expect(within(await rowOf("Maler Meier")).getByRole("button", {name: "approve"})).toBeEnabled();
    });

    it("saves an edited subject together with the unchanged body, then reloads the queue", async () => {
        serve();
        renderPage();
        const row = await rowOf("Maler Meier");

        fireEvent.change(within(row).getByRole("textbox", {name: "subject"}), {target: {value: "Neue Malerarbeiten"}});
        fireEvent.click(within(row).getByRole("button", {name: "saveEdit"}));

        await waitFor(() => expect(actionCalls()).toEqual([
            {url: "/api/swissOutreach/outreachEmail/editDraft", data: {emailId: "e1", subject: "Neue Malerarbeiten", body: "Body e1"}},
        ]));
        await waitFor(() => expect(queueLoads("c1")).toBe(2));
        // The reload replaces the local edit with what the server holds.
        expect(within(await rowOf("Maler Meier")).getByRole("textbox", {name: "subject"})).toHaveValue("Subject e1");
    });

    it("cannot approve while an edit is unsaved, and says to save first", async () => {
        serve();
        renderPage();
        const row = await rowOf("Maler Meier");
        const subject = within(row).getByRole("textbox", {name: "subject"});

        fireEvent.change(subject, {target: {value: "Neue Malerarbeiten"}});
        const approve = within(row).getByRole("button", {name: "approve"});
        expect(approve).toBeDisabled();
        expect(approve).toHaveAccessibleDescription("saveBeforeApprove");
        fireEvent.click(approve);
        expect(actionCalls()).toEqual([]);

        // Typing the stored text back leaves nothing to save.
        fireEvent.change(subject, {target: {value: "Subject e1"}});
        expect(within(row).getByRole("button", {name: "approve"})).toBeEnabled();
        expect(within(row).queryByText("saveBeforeApprove")).not.toBeInTheDocument();
    });

    it("approves and skips one email by id", async () => {
        serve();
        renderPage();
        const row = await rowOf("Maler Meier");

        fireEvent.click(within(row).getByRole("button", {name: "approve"}));
        await waitFor(() => expect(actionCalls()).toHaveLength(1));
        fireEvent.click(within(await rowOf("Maler Meier")).getByRole("button", {name: "skip"}));

        await waitFor(() => expect(actionCalls()).toEqual([
            {url: "/api/swissOutreach/outreachEmail/approve", data: {emailId: "e1"}},
            {url: "/api/swissOutreach/outreachEmail/skip", data: {emailId: "e1"}},
        ]));
    });

    it("puts the recipient on the do-not-contact list, and offers it only for an email with a recipient", async () => {
        serve();
        renderPage();

        expect(within(await rowOf("pc-e2")).getByRole("button", {name: "doNotContact"})).toBeDisabled();
        fireEvent.click(within(await rowOf("Maler Meier")).getByRole("button", {name: "doNotContact"}));

        await waitFor(() => expect(actionCalls()).toEqual([{url: "/api/swissOutreach/outreachEmail/doNotContact", data: {emailId: "e1"}}]));
    });

    it("approves the whole shown campaign at once", async () => {
        serve();
        renderPage();
        await rowOf("Maler Meier");

        act(() => picker.pick("c2", "Beta GmbH campaign"));
        await waitFor(() => expect(queueLoads("c2")).toBe(1));
        fireEvent.click(screen.getByRole("button", {name: "approveAll"}));

        await waitFor(() => expect(actionCalls()).toEqual([{url: "/api/swissOutreach/campaign/approveAll", data: {campaignId: "c2"}}]));
    });

    it("shows no action, and no editable draft, to a role without the outreach actions", async () => {
        serve();
        renderPage({}, []);
        const row = await rowOf("Maler Meier");

        // Only the email's details, which reading the queue allows.
        expect(within(row).getAllByRole("button").map((b) => b.textContent)).toEqual(["details"]);
        expect(screen.queryByRole("button", {name: "approveAll"})).not.toBeInTheDocument();
        for (const name of ["toEmail", "subject", "body"]) expect(within(row).getByRole("textbox", {name})).toHaveAttribute("readonly");
    });

    it("shows each action only with its own permission", async () => {
        serve();
        renderPage({}, ["swissoutreachemails[action:skip]", "swissoutreachcampaigns[action:approveAll]"]);
        const row = await rowOf("Maler Meier");

        expect(within(row).getAllByRole("button").map((b) => b.textContent)).toEqual(["skip", "details"]);
        expect(screen.getByRole("button", {name: "approveAll"})).toBeInTheDocument();
    });

    it("does not take a scoped tag for the loose email model's permission", async () => {
        serve();
        renderPage({}, ["swissoutreachemails[action:self:approve]"]);

        expect(within(await rowOf("Maler Meier")).queryByRole("button", {name: "approve"})).not.toBeInTheDocument();
    });

    it("shows the server's reason when an action is refused", async () => {
        serve({actionError: {response: {status: 400, data: {message: "Email has no recipient"}}}});
        renderPage();

        fireEvent.click(within(await rowOf("Maler Meier")).getByRole("button", {name: "skip"}));

        expect(await screen.findByText("Email has no recipient")).toBeInTheDocument();
    });

    it("loads only the prospects of the emails it shows", async () => {
        serve();
        renderPage();
        await rowOf("Maler Meier");

        const prospectsLoad = calls().find((c) => c.url === "/api/swissOutreach/prospectCompany")!;
        expect(prospectsLoad.data).toMatchObject({offset: 0, limit: 2, ids: ["pc1", "pc-e2"]});
    });

    // Regression: failed emails were filtered out of the queue and their error was never shown, so they were stranded.
    it("shows the failed emails with their last error, and lets them be approved again", async () => {
        serve();
        renderPage();
        await rowOf("Maler Meier");
        expect(screen.queryByText("pc-e3")).not.toBeInTheDocument();

        fireEvent.change(screen.getByRole("combobox", {name: "view"}), {target: {value: "failed"}});

        const row = await rowOf("pc-e3");
        expect(statusesOf(queueCalls().at(-1)!)).toEqual(["failed"]);
        expect(within(row).getByText("lastError: 550 Mailbox unavailable")).toBeInTheDocument();
        expect(screen.queryByText("Maler Meier")).not.toBeInTheDocument();
        fireEvent.click(within(row).getByRole("button", {name: "approve"}));
        await waitFor(() => expect(actionCalls()).toEqual([{url: "/api/swissOutreach/outreachEmail/approve", data: {emailId: "e3"}}]));
    });

    it("shows sent emails as history: nothing to rewrite, approve or skip", async () => {
        serve();
        renderPage();
        await rowOf("Maler Meier");

        fireEvent.change(screen.getByRole("combobox", {name: "view"}), {target: {value: "sent"}});

        const row = await rowOf("pc-e4");
        expect(within(row).getAllByRole("button").map((b) => b.textContent)).toEqual(["doNotContact", "details"]);
        for (const name of ["toEmail", "subject", "body"]) expect(within(row).getByRole("textbox", {name})).toHaveAttribute("readonly");
    });

    // Regression: an email drafted without a recipient could not be approved, and nothing could set one.
    it("sets the recipient of an email that has none, then lets it be approved", async () => {
        serve();
        renderPage();
        const row = await rowOf("pc-e2");

        fireEvent.change(within(row).getByRole("textbox", {name: "toEmail"}), {target: {value: "offerte@meier.ch"}});
        expect(within(row).getByRole("button", {name: "approve"})).toHaveAccessibleDescription("saveBeforeApprove");
        fireEvent.click(within(row).getByRole("button", {name: "saveEdit"}));

        await waitFor(() => expect(actionCalls()).toEqual([
            {url: "/api/swissOutreach/outreachEmail/editDraft", data: {emailId: "e2", subject: "Subject e2", body: "Body e2", toEmail: "offerte@meier.ch"}},
        ]));
    });

    it("shows a known reason code translated and a provider's error as it came (D126)", async () => {
        serve();
        renderPage();
        await rowOf("Maler Meier");

        fireEvent.change(screen.getByRole("combobox", {name: "view"}), {target: {value: "skipped"}});
        expect(within(await rowOf("pc-e5")).getByText("lastError: lastErrorReasons.do_not_contact")).toBeInTheDocument();
    });

    it("says so when approving skipped the email because its recipient is on the do-not-contact list", async () => {
        serve({actionData: {...email("e1"), status: "skipped"}});
        renderPage();

        fireEvent.click(within(await rowOf("Maler Meier")).getByRole("button", {name: "approve"}));

        expect(await screen.findByText("skippedDoNotContact")).toBeInTheDocument();
    });

    // Regression (TD-F49): the queue loaded at most 200 emails, while a campaign may hold 500.
    it("pages through a long queue", async () => {
        serve({emailsTotal: 45});
        renderPage();
        await rowOf("Maler Meier");
        expect(queueCalls().at(-1)!.data).toMatchObject({offset: 0, limit: 20});

        fireEvent.click(screen.getByRole("button", {name: "nextPage"}));

        await waitFor(() => expect(queueCalls().at(-1)!.data).toMatchObject({offset: 20, limit: 20}));
    });
});
