import {fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ComponentType} from "react";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";
import type {OutreachEmail} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/outreachEmail/outreachEmail.dto.ts";
import type {ProspectCompany} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/prospectCompany/prospectCompany.dto.ts";

// `post` answers the access map request of the real `AccessProvider`.
const {apiClientMock} = vi.hoisted(() => ({apiClientMock: Object.assign(vi.fn(), {post: vi.fn()})}));

vi.mock("@coreModule/helpers/apiClient/apiClient.ts", () => ({default: apiClientMock}));
vi.mock("sonner", () => ({toast: Object.assign(vi.fn(), {loading: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn()})}));
vi.mock("@coreModule/helpers/hocs/withLanguage.tsx", () => ({
    default: () => (Wrapped: ComponentType<Record<string, unknown>>) =>
        (props: Record<string, unknown>) => <Wrapped {...props} resolveLanguageKey={(key: string) => key}/>,
}));
vi.mock("@coreModule/helpers/hocs/withDebug.tsx", () => ({
    default: () => (Wrapped: ComponentType<Record<string, unknown>>) => Wrapped,
}));
vi.mock("@coreModule/components/custom/sessionSetupScreen.tsx", () => ({SessionSetupScreen: () => null, SESSION_SETUP_TOTAL_STEPS: 3}));

import ApprovalPage from "../index.tsx";
import {ALL_OUTREACH_ACTIONS, OUTREACH_ACCESS_ALL, SessionWith} from "../../_tests/accessHarness.tsx";

/** The page for a session holding `permissions` (every outreach action by default). */
function renderPage(props: {campaignId?: string} = {}, permissions: string[] = ALL_OUTREACH_ACTIONS) {
    return render(<SessionWith permissions={permissions}><ApprovalPage {...props}/></SessionWith>);
}

const campaign = (id: string, senderCompanyName: string): Campaign => ({
    _id: id, jobDescription: "Painters", country: "CH", cantons: ["ZH"], maxCompanies: 20, language: "de", emailTone: "professional",
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
const emails = [
    email("e1", {prospectCompanyId: "pc1"}),
    email("e2", {status: "edited", toEmail: undefined}),
    email("e3", {status: "sent"}),
    email("e4", {status: "skipped"}),
];
const prospects = [prospect("pc1", "Maler Meier", {score: 87, website: "https://meier.ch"})];

type Call = {method: string; url: string; data: Record<string, unknown>};

function serve({actionError}: {actionError?: unknown} = {}) {
    apiClientMock.mockImplementation(({method, url}: Call) => {
        if (method === "post" && url === "/api/swissOutreach/campaign") return Promise.resolve({data: {data: campaigns}});
        if (url.endsWith("/emails")) return Promise.resolve({data: {data: emails}});
        if (url.endsWith("/prospects")) return Promise.resolve({data: {data: prospects}});
        if (actionError) return Promise.reject(actionError);
        return Promise.resolve({data: {data: {}}});
    });
}

const calls = (): Call[] => apiClientMock.mock.calls.map(([config]) => config);
const actionCalls = () => calls()
    .filter((c) => c.url.startsWith("/api/swissOutreach/outreachEmail/") || c.url === "/api/swissOutreach/campaign/approveAll")
    .map(({url, data}) => ({url, data}));
const queueLoads = (campaignId: string) => calls().filter((c) => c.url === `/api/swissOutreach/campaign/${campaignId}/emails`).length;

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

    it("opens the first campaign when none is given, and loads its emails and prospects", async () => {
        serve();
        renderPage();

        await rowOf("Maler Meier");
        expect(screen.getByRole("combobox", {name: "campaign"})).toHaveValue("c1");
        expect(calls().map((c) => c.url)).toEqual(expect.arrayContaining([
            "/api/swissOutreach/campaign/c1/emails",
            "/api/swissOutreach/campaign/c1/prospects",
        ]));
    });

    it("opens the campaign it was linked to", async () => {
        serve();
        renderPage({campaignId: "c2"});

        await waitFor(() => expect(queueLoads("c2")).toBe(1));
        expect(queueLoads("c1")).toBe(0);
    });

    it("queues only emails still to decide, joined with their prospect", async () => {
        serve();
        renderPage();

        const row = await rowOf("Maler Meier");
        expect(within(row).getByRole("link", {name: "websiteLink"})).toHaveAttribute("href", "https://meier.ch");
        expect(within(row).getByText("87")).toBeInTheDocument();
        // A prospect that did not load shows its id; sent and skipped emails are not in the queue.
        expect(screen.getByText("pc-e2")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("Subject e3")).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue("Subject e4")).not.toBeInTheDocument();
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

    it("approves the whole shown campaign at once", async () => {
        serve();
        renderPage();
        await rowOf("Maler Meier");

        fireEvent.change(screen.getByRole("combobox", {name: "campaign"}), {target: {value: "c2"}});
        await waitFor(() => expect(queueLoads("c2")).toBe(1));
        fireEvent.click(screen.getByRole("button", {name: "approveAll"}));

        await waitFor(() => expect(actionCalls()).toEqual([{url: "/api/swissOutreach/campaign/approveAll", data: {campaignId: "c2"}}]));
    });

    it("shows no action, and no editable draft, to a role without the outreach actions", async () => {
        serve();
        renderPage({}, []);
        const row = await rowOf("Maler Meier");

        expect(within(row).queryByRole("button")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "approveAll"})).not.toBeInTheDocument();
        expect(within(row).getByRole("textbox", {name: "subject"})).toHaveAttribute("readonly");
        expect(within(row).getByRole("textbox", {name: "body"})).toHaveAttribute("readonly");
    });

    it("shows each action only with its own permission", async () => {
        serve();
        renderPage({}, ["swissoutreachemails[action:skip]", "swissoutreachcampaigns[action:approveAll]"]);
        const row = await rowOf("Maler Meier");

        expect(within(row).getAllByRole("button").map((b) => b.textContent)).toEqual(["skip"]);
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
});
