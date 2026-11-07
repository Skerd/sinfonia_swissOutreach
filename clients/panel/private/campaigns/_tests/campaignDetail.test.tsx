import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ComponentType} from "react";
import {MemoryRouter} from "react-router-dom";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";
import type {CampaignStatusValue} from "armonia/src/modules/swissOutreach/types/constants.ts";

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

import CampaignDetail from "../campaignDetail.tsx";
import {ALL_OUTREACH_ACTIONS, OUTREACH_ACCESS_ALL, SessionWith} from "../../_tests/accessHarness.tsx";

const campaign = (status: CampaignStatusValue, overrides: Partial<Campaign> = {}): Campaign => ({
    _id: "c1", jobDescription: "Painters in Zürich", country: "CH", cantons: ["ZH"], maxCompanies: 20, language: "de", emailTone: "professional",
    sendAutomatically: false, senderCompanyName: "Alpha AG", senderName: "Sam", senderEmail: "sam@example.ch", status,
    stats: {found: 2, enriched: 1, scored: 1, approved: 0, sent: 0, failed: 0}, ...overrides,
});

type Call = {method: string; url: string; data: Record<string, unknown>};
type Handlers = {single?: () => Promise<unknown>; action?: (url: string) => Promise<unknown>};

function serve(status: CampaignStatusValue, {single, action}: Handlers = {}) {
    apiClientMock.mockImplementation(({url}: Call) => {
        if (url === "/api/swissOutreach/campaign/single") return single ? single() : Promise.resolve({data: campaign(status)});
        if (url.endsWith("/prospects")) return Promise.resolve({data: {data: []}});
        if (url.endsWith("/logs")) return Promise.resolve({data: {data: [{_id: "l1", step: "search", level: "info", message: "Found 2 companies"}]}});
        return action ? action(url) : Promise.resolve({data: {}});
    });
}

const calls = (): Call[] => apiClientMock.mock.calls.map(([config]) => config);
const singleLoads = () => calls().filter((c) => c.url === "/api/swissOutreach/campaign/single").length;
const actionCalls = () => calls()
    .filter((c) => ["start", "cancel", "approveAll", "sendApproved"].some((a) => c.url === `/api/swissOutreach/campaign/${a}`))
    .map(({url, data}) => ({url, data}));

/** The page for a session holding `permissions` (every outreach action by default). */
function renderDetail(permissions: string[] = ALL_OUTREACH_ACTIONS) {
    return render(<SessionWith permissions={permissions}><MemoryRouter><CampaignDetail campaignId="c1"/></MemoryRouter></SessionWith>);
}

const button = (name: string) => screen.getByRole("button", {name});

/** Which campaign actions are offered, by status. */
const enabled = () => Object.fromEntries(["restart", "cancel", "approveAll", "sendApproved"].map((name) => [name, !button(name).hasAttribute("disabled")]));

describe("swissOutreach campaign detail", () => {
    beforeEach(() => {
        apiClientMock.mockReset();
        apiClientMock.post.mockResolvedValue({data: OUTREACH_ACCESS_ALL});
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each<[CampaignStatusValue, ReturnType<typeof enabled>]>([
        ["draft", {restart: true, cancel: true, approveAll: false, sendApproved: false}],
        ["searching", {restart: false, cancel: true, approveAll: false, sendApproved: false}],
        ["awaiting_approval", {restart: true, cancel: false, approveAll: true, sendApproved: true}],
        ["completed", {restart: false, cancel: false, approveAll: true, sendApproved: true}],
        ["failed", {restart: true, cancel: false, approveAll: true, sendApproved: true}],
        ["cancelled", {restart: false, cancel: false, approveAll: false, sendApproved: false}],
    ])("a %s campaign offers %o", async (status, expected) => {
        serve(status);
        renderDetail();
        await screen.findByRole("heading", {name: "Alpha AG"});

        expect(enabled()).toEqual(expected);
    });

    it("shows no campaign action to a role without the outreach actions, but keeps the approval link", async () => {
        serve("awaiting_approval");
        renderDetail([]);
        await screen.findByRole("heading", {name: "Alpha AG"});

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(screen.getByRole("link", {name: "approval"})).toBeInTheDocument();
    });

    it("shows each campaign action only with its own permission", async () => {
        serve("awaiting_approval");
        renderDetail(["swissoutreachcampaigns[action:cancel]", "swissoutreachcampaigns[action:sendApproved]"]);
        await screen.findByRole("heading", {name: "Alpha AG"});

        expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["cancel", "sendApproved"]);
    });

    it("explains why a running campaign cannot be restarted", async () => {
        serve("enriching");
        renderDetail();
        await screen.findByRole("heading", {name: "Alpha AG"});

        expect(button("restart")).toHaveAttribute("title", "alreadyRunning");
        expect(screen.getByText("activity.running")).toBeInTheDocument();
        expect(screen.getByText("latest: [info] search: Found 2 companies")).toBeInTheDocument();
    });

    it("explains why a completed campaign cannot be restarted", async () => {
        serve("completed");
        renderDetail();
        await screen.findByRole("heading", {name: "Alpha AG"});

        expect(button("restart")).toBeDisabled();
        expect(button("restart")).toHaveAttribute("title", "cannotRestart");
    });

    it("shows a requested start as running at once, then posts it for this campaign", async () => {
        let finishStart: (value: unknown) => void = () => undefined;
        serve("failed", {action: () => new Promise((resolve) => { finishStart = resolve; })});
        renderDetail();
        await screen.findByRole("heading", {name: "Alpha AG"});

        fireEvent.click(button("restart"));

        expect(screen.getByText("activity.running")).toBeInTheDocument();
        expect(screen.getByText("startRequested")).toBeInTheDocument();
        await waitFor(() => expect(actionCalls()).toEqual([{url: "/api/swissOutreach/campaign/start", data: {campaignId: "c1"}}]));
        expect(button("restart")).toBeDisabled();

        await act(async () => finishStart({data: {}}));
        // The reload replaces the optimistic state with the server's.
        await waitFor(() => expect(screen.queryByText("startRequested")).not.toBeInTheDocument());
        expect(singleLoads()).toBe(2);
    });

    it("drops the optimistic start and shows the reason when the start is refused", async () => {
        serve("failed", {action: () => Promise.reject({response: {status: 409, data: {message: "Campaign cannot start"}}})});
        renderDetail();
        await screen.findByRole("heading", {name: "Alpha AG"});

        fireEvent.click(button("restart"));

        expect(await screen.findByText("Campaign cannot start")).toBeInTheDocument();
        expect(screen.queryByText("startRequested")).not.toBeInTheDocument();
        expect(screen.getByText("activity.failed")).toBeInTheDocument();
    });

    it("sends approved emails for this campaign", async () => {
        serve("awaiting_approval");
        renderDetail();
        await screen.findByRole("heading", {name: "Alpha AG"});

        fireEvent.click(button("sendApproved"));

        await waitFor(() => expect(actionCalls()).toEqual([{url: "/api/swissOutreach/campaign/sendApproved", data: {campaignId: "c1"}}]));
    });

    it("links to this campaign's approval queue", async () => {
        serve("awaiting_approval");
        renderDetail();

        expect(await screen.findByRole("link", {name: "approval"})).toHaveAttribute("href", "/swissOutreach/approval?campaignId=c1");
    });

    it("says the campaign was not found when it cannot be loaded", async () => {
        serve("draft", {single: () => Promise.reject({response: {status: 404, data: {message: "nope"}}})});
        renderDetail();

        expect(await screen.findByText("notFound")).toBeInTheDocument();
    });

    it("polls a running campaign every 1.5 s and stops once it waits for approval", async () => {
        vi.useFakeTimers();
        let status: CampaignStatusValue = "scoring";
        serve("scoring", {single: () => Promise.resolve({data: campaign(status)})});
        renderDetail();
        await act(() => vi.advanceTimersByTimeAsync(0));
        expect(singleLoads()).toBe(1);

        await act(() => vi.advanceTimersByTimeAsync(1500));
        expect(singleLoads()).toBe(2);

        status = "awaiting_approval";
        await act(() => vi.advanceTimersByTimeAsync(1500));
        expect(singleLoads()).toBe(3);

        await act(() => vi.advanceTimersByTimeAsync(20000));
        expect(singleLoads()).toBe(3);
    });
});
