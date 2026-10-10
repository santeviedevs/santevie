import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionary } from "@/lib/i18n/dictionary";

import type { LockedContact, SelectedContact } from "./contact-picker";

const { ContactPicker } = await import("./contact-picker");

const dict = getDictionary("en").routesPage;

const fetchMock = vi.fn();
const onAdd = vi.fn();
const onRemove = vi.fn();

function result(id: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name,
    code: `CON-${id}`,
    roleName: "Doctor",
    specialization: "Cardiology",
    ...extra,
  };
}

function respondWith(contacts: unknown[]) {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ contacts }) });
}

function setup(props: Partial<React.ComponentProps<typeof ContactPicker>> = {}) {
  return render(
    <ContactPicker
      routeId="r1"
      centerId="c1"
      selected={[]}
      locked={[]}
      onAdd={onAdd}
      onRemove={onRemove}
      disabled={false}
      dict={dict}
      {...props}
    />,
  );
}

const picked = (
  id: string,
  name: string,
  extra: Partial<SelectedContact> = {},
): SelectedContact => ({
  contactId: id,
  name,
  code: `CON-${id}`,
  roleName: "Doctor",
  specialization: "Surgeon",
  issue: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  respondWith([]);
});

describe("ContactPicker", () => {
  it("searches only this center's contacts, passing the route for scoping", async () => {
    setup();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "/api/routes/centers/c1/contacts?q=&routeId=r1",
    );
  });

  it("lists matching contacts as checkbox rows with name, code, role and specialization", async () => {
    respondWith([result("1", "Dr. Harsh Kumar")]);
    setup();

    expect(await screen.findByText("Dr. Harsh Kumar")).toBeInTheDocument();
    expect(screen.getByText("(CON-1)")).toBeInTheDocument();
    expect(screen.getByText("Doctor · Cardiology")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("ticks several contacts in one pass — each tick adds that contact", async () => {
    respondWith([result("1", "Dr. One"), result("2", "Dr. Two")]);
    setup();

    const boxes = await screen.findAllByRole("checkbox");
    fireEvent.click(boxes[0]!);
    fireEvent.click(boxes[1]!);

    expect(onAdd).toHaveBeenCalledTimes(2);
    expect(onAdd.mock.calls.map((c) => c[0].id)).toEqual(["1", "2"]);
  });

  it("lists chosen contacts first, checked and badged Selected, and unticking removes them", async () => {
    respondWith([result("2", "Dr. Two")]);
    setup({ selected: [picked("1", "Dr. Harsh Kumar")] });

    const row = (await screen.findByText("Dr. Harsh Kumar")).closest("li") as HTMLElement;
    expect(within(row).getByText("Selected")).toBeInTheDocument();
    expect(within(row).getByText("Doctor · Surgeon")).toBeInTheDocument();
    const box = within(row).getByRole("checkbox");
    expect(box).toBeChecked();

    fireEvent.click(box);
    expect(onRemove).toHaveBeenCalledWith("1");

    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("Dr. Harsh Kumar");
  });

  it("never shows a chosen contact twice, even when the search returns it", async () => {
    respondWith([result("1", "Dr. Harsh Kumar"), result("2", "Dr. Two")]);
    setup({ selected: [picked("1", "Dr. Harsh Kumar")] });

    await screen.findByText("Dr. Two");
    expect(screen.getAllByText("Dr. Harsh Kumar")).toHaveLength(1);
  });

  it("keeps a chosen contact visible even if the search no longer matches it", async () => {
    respondWith([]);
    setup({ selected: [picked("1", "Dr. Harsh Kumar")] });

    expect(await screen.findByText("Dr. Harsh Kumar")).toBeInTheDocument();
  });

  it("shows contacts that already have a final status as read-only rows with their status", async () => {
    respondWith([result("9", "Dr. Done")]);
    const done: LockedContact = {
      contactId: "9",
      name: "Dr. Done",
      code: "CON-9",
      roleName: "Doctor",
      specialization: null,
      status: "COMPLETED",
      issue: null,
    };
    setup({ locked: [done] });

    const row = (await screen.findByText("Dr. Done")).closest("li") as HTMLElement;
    expect(within(row).getByText("COMPLETED")).toBeInTheDocument();
    expect(within(row).queryByRole("checkbox")).not.toBeInTheDocument();
    // …and is never offered again as a result.
    expect(screen.getAllByText("Dr. Done")).toHaveLength(1);
  });

  it("flags a chosen contact whose link to the center was removed, so it can be unticked", async () => {
    setup({ selected: [picked("1", "Dr. Gone", { issue: "NOT_ASSOCIATED" })] });

    expect(await screen.findByText("No longer associated")).toBeInTheDocument();
    expect(screen.getByText("Selected")).toBeInTheDocument();
  });

  it("shows the empty message while nothing is selected, and drops it once something is", async () => {
    const { rerender } = setup();
    expect(await screen.findByText("No contacts selected.")).toBeInTheDocument();

    rerender(
      <ContactPicker
        routeId="r1"
        centerId="c1"
        selected={[picked("1", "Dr. One")]}
        locked={[]}
        onAdd={onAdd}
        onRemove={onRemove}
        disabled={false}
        dict={dict}
      />,
    );
    expect(screen.queryByText("No contacts selected.")).not.toBeInTheDocument();
  });

  it("says so when the center has no contacts at all, or a search matches none", async () => {
    setup();
    expect(
      await screen.findByText("No contacts are associated with this center."),
    ).toBeInTheDocument();

    respondWith([]);
    fireEvent.change(screen.getByLabelText(dict.searchContactsPlaceholder), {
      target: { value: "zzz" },
    });
    expect(await screen.findByText("No matching contacts.")).toBeInTheDocument();
  });

  it("debounces the search and sends the typed query", async () => {
    vi.useFakeTimers();
    setup();
    await vi.advanceTimersByTimeAsync(10);
    fetchMock.mockClear();

    fireEvent.change(screen.getByLabelText(dict.searchContactsPlaceholder), {
      target: { value: "kum" },
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("q=kum");
    vi.useRealTimers();
  });

  it("shows a failed search and a first-results hint when the cap is reached", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    setup();
    expect(await screen.findByText("Search failed. Try again.")).toBeInTheDocument();

    respondWith(Array.from({ length: 20 }, (_, i) => result(String(i), `Dr. ${i}`)));
    fireEvent.change(screen.getByLabelText(dict.searchContactsPlaceholder), {
      target: { value: "dr" },
    });
    expect(await screen.findByText(dict.showingFirstResults)).toBeInTheDocument();
  });

  it("disables every checkbox while saving", async () => {
    respondWith([result("2", "Dr. Two")]);
    setup({ selected: [picked("1", "Dr. One")], disabled: true });

    await screen.findByText("Dr. Two");
    for (const box of screen.getAllByRole("checkbox")) expect(box).toHaveAttribute("data-disabled");
  });
});
