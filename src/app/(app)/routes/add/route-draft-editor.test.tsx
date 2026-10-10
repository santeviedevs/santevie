import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionary } from "@/lib/i18n/dictionary";

import type { DraftCenter } from "./route-draft-editor";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const saveRouteAction = vi.fn();
vi.mock("../actions", () => ({ saveRouteAction }));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast }));

// The real center search is a server-backed combobox with its own coverage;
// here a stub lets a test "pick" a center.
vi.mock("./center-search", () => ({
  CenterSearch: ({
    onSelect,
    excludedCenterIds,
  }: {
    onSelect: (c: unknown) => void;
    excludedCenterIds: Set<string>;
  }) => (
    <button
      type="button"
      data-excluded={[...excludedCenterIds].join(",")}
      onClick={() =>
        onSelect({
          id: "c9",
          name: "Brand New Center",
          code: "CL-9",
          territoryId: "t",
          typeName: "Pharmacy",
          territoryPath: "Zone › Town",
        })
      }
    >
      pick-center
    </button>
  ),
}));

const { RouteDraftEditor } = await import("./route-draft-editor");

const dict = getDictionary("en").routesPage;

const center = (n: number, extra: Partial<DraftCenter> = {}): DraftCenter => ({
  centerId: `c${n}`,
  name: `Center ${n}`,
  code: `CL-${n}`,
  typeName: "Hospital",
  territoryPath: "Dubai › Central",
  contacts: [],
  lockedContacts: [],
  ...extra,
});

const contact = (n: number, issue: "NOT_ASSOCIATED" | null = null) => ({
  contactId: `p${n}`,
  name: `Person ${n}`,
  code: `CON-${n}`,
  roleName: "Doctor",
  specialization: "Surgeon",
  issue,
});

function setup(props: Partial<React.ComponentProps<typeof RouteDraftEditor>> = {}) {
  return render(
    <RouteDraftEditor
      routeId={null}
      initialCenters={[]}
      readOnlyItems={[]}
      territories={[{ id: "t1", label: "Dubai › Central" }]}
      dict={dict}
      {...props}
    />,
  );
}

const savedSelections = () =>
  JSON.parse((saveRouteAction.mock.calls[0]![1] as FormData).get("selections") as string);

const sectionOf = (name: string) => screen.getByText(new RegExp(name)).closest("li") as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  saveRouteAction.mockResolvedValue({ error: null });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ contacts: [] }) })),
  );
});

describe("route editor — layout", () => {
  it("puts Territory and Add a center side by side on desktop, stacked on small screens", () => {
    setup();
    const row = screen.getByText("Territory").closest("div.grid") as HTMLElement;

    expect(row.className).toContain("md:grid-cols-2");
    expect(row).toContainElement(screen.getByText("Add a center"));
  });

  it("has no outer card and no card around a center — dividers instead", () => {
    const { container } = setup({ initialCenters: [center(1), center(2)] });

    expect((container.firstElementChild as HTMLElement).className).not.toMatch(
      /\bborder\b|rounded/,
    );
    const list = container.querySelector("section > ol") as HTMLElement;
    expect(list.className).toContain("divide-y");
    for (const li of list.children) expect(li.className).not.toMatch(/\bborder\b|rounded/);
  });

  it("has a Selected Centers heading and the empty message when there are none", () => {
    setup();

    expect(screen.getByRole("heading", { name: "Selected Centers" })).toBeInTheDocument();
    expect(screen.getByText("No centers added yet.")).toBeInTheDocument();
  });

  it("shows each center's name, code, type, territory path and contact count", () => {
    setup({ initialCenters: [center(1, { contacts: [contact(1), contact(2)] })] });

    const section = sectionOf("Center 1");
    expect(within(section).getByText(/1\. Center 1/)).toBeInTheDocument();
    expect(within(section).getByText("(CL-1)")).toBeInTheDocument();
    expect(
      within(section).getByText(/Hospital · Dubai › Central · 2 contacts/),
    ).toBeInTheDocument();
  });

  it("shows the contacts of each center underneath it, with the Selected badge and the empty state", async () => {
    setup({ initialCenters: [center(1, { contacts: [contact(1)] }), center(2)] });

    const first = sectionOf("Center 1");
    expect(await within(first).findByText("Person 1")).toBeInTheDocument();
    expect(within(first).getByText("Selected")).toBeInTheDocument();
    expect(within(first).getByRole("heading", { name: "Contacts (1)" })).toBeInTheDocument();

    expect(
      await within(sectionOf("Center 2")).findByText("No contacts selected."),
    ).toBeInTheDocument();
  });

  it("shows centers that already have a final status as read-only history", () => {
    setup({
      readOnlyItems: [
        {
          id: "i1",
          status: "COMPLETED",
          center: { name: "Done Center", code: "D-1" },
          contacts: [{ id: "k", name: "Dr. Done", code: "X", status: "COMPLETED" }],
        },
      ],
    });

    expect(screen.getByText("Done Center")).toBeInTheDocument();
    expect(screen.getByText("COMPLETED")).toBeInTheDocument();
    expect(screen.getByText("Dr. Done · COMPLETED")).toBeInTheDocument();
  });
});

describe("route editor — centers", () => {
  it("adds a center from the search, with its type and path, and won't offer it again", () => {
    setup();

    fireEvent.click(screen.getByText("pick-center"));

    const section = sectionOf("Brand New Center");
    expect(within(section).getByText(/Pharmacy · Zone › Town · 0 contacts/)).toBeInTheDocument();
    expect(screen.getByText("pick-center")).toHaveAttribute("data-excluded", "c9");
  });

  it("removes a center", () => {
    setup({ initialCenters: [center(1), center(2)] });

    fireEvent.click(within(sectionOf("Center 1")).getByRole("button", { name: "Remove" }));

    expect(screen.queryByText(/Center 1/)).not.toBeInTheDocument();
    expect(screen.getByText(/1\. Center 2/)).toBeInTheDocument();
  });

  it("reorders with move up / move down, renumbering, and disables the ends", () => {
    setup({ initialCenters: [center(1), center(2), center(3)] });

    expect(within(sectionOf("Center 1")).getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(within(sectionOf("Center 3")).getByRole("button", { name: "Move down" })).toBeDisabled();

    fireEvent.click(within(sectionOf("Center 3")).getByRole("button", { name: "Move up" }));
    const order = screen
      .getAllByText(/^\d\. Center/)
      .map((el) => el.textContent?.match(/^\d\. Center \d/)?.[0]);
    expect(order).toEqual(["1. Center 1", "2. Center 3", "3. Center 2"]);
  });

  it("won't remove a center that has a completed contact", () => {
    setup({
      initialCenters: [
        center(1, {
          lockedContacts: [
            {
              contactId: "p9",
              name: "Dr. Done",
              code: "X",
              roleName: null,
              specialization: null,
              status: "COMPLETED",
              issue: null,
            },
          ],
        }),
      ],
    });

    expect(within(sectionOf("Center 1")).getByRole("button", { name: "Remove" })).toBeDisabled();
  });
});

describe("route editor — collapsing contacts", () => {
  it("starts expanded, folds the contacts away and back again, with aria-expanded", () => {
    setup({ initialCenters: [center(1)] });
    const section = sectionOf("Center 1");
    const toggle = within(section).getByRole("button", { name: "Hide contacts" });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const region = document.getElementById(
      toggle.getAttribute("aria-controls") as string,
    ) as HTMLElement;
    expect(region).not.toHaveAttribute("hidden");

    fireEvent.click(toggle);
    expect(within(section).getByRole("button", { name: "Show contacts" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(region).toHaveAttribute("hidden");

    fireEvent.click(within(section).getByRole("button", { name: "Show contacts" }));
    expect(region).not.toHaveAttribute("hidden");
  });

  it("folds one center without touching the others", () => {
    setup({ initialCenters: [center(1), center(2)] });

    fireEvent.click(within(sectionOf("Center 1")).getByRole("button", { name: "Hide contacts" }));

    expect(
      within(sectionOf("Center 2")).getByRole("button", { name: "Hide contacts" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps a center open — and its toggle locked — while it holds a flagged contact", () => {
    setup({ initialCenters: [center(1, { contacts: [contact(1, "NOT_ASSOCIATED")] })] });

    const toggle = within(sectionOf("Center 1")).getByRole("button", { name: "Hide contacts" });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});

describe("route editor — saving", () => {
  it("saves the centers in order with each center's chosen contacts, then returns to the list", async () => {
    setup({
      initialCenters: [
        center(1, { contacts: [contact(1), contact(2)] }),
        center(2, { contacts: [contact(3)] }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saveRouteAction).toHaveBeenCalledTimes(1));
    expect(savedSelections()).toEqual([
      { centerId: "c1", contactIds: ["p1", "p2"] },
      { centerId: "c2", contactIds: ["p3"] },
    ]);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/routes/add"));
    expect(toast.success).toHaveBeenCalledWith("Route saved");
  });

  it("sends the route id when editing and none when adding", async () => {
    setup({ routeId: "r7", initialCenters: [center(1)] });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveRouteAction).toHaveBeenCalled());

    expect((saveRouteAction.mock.calls[0]![1] as FormData).get("routeId")).toBe("r7");
  });

  it("submits the reordered list after a move", async () => {
    setup({ initialCenters: [center(1), center(2)] });
    fireEvent.click(within(sectionOf("Center 2")).getByRole("button", { name: "Move up" }));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveRouteAction).toHaveBeenCalled());

    expect(savedSelections().map((s: { centerId: string }) => s.centerId)).toEqual(["c2", "c1"]);
  });

  it("refuses to save while a contact is flagged, without calling the server", async () => {
    setup({ initialCenters: [center(1, { contacts: [contact(1, "NOT_ASSOCIATED")] })] });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(dict.flaggedContactsBlockSave)).toBeInTheDocument();
    expect(saveRouteAction).not.toHaveBeenCalled();
  });

  it("shows the server's error and stays on the page", async () => {
    saveRouteAction.mockResolvedValue({ error: "This center is already on the route." });
    setup({ initialCenters: [center(1)] });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("This center is already on the route.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
