import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionary } from "@/lib/i18n/dictionary";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const assignRouteAction = vi.fn();
const reassignRouteAction = vi.fn();
vi.mock("../actions", () => ({ assignRouteAction, reassignRouteAction }));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast }));

// The real combobox is a server-backed search (covered by its own tests);
// here a stub just lets a test "pick" an assignee.
vi.mock("@/components/search-combobox", () => ({
  SearchCombobox: ({
    onChange,
    placeholder,
  }: {
    onChange: (v: unknown) => void;
    placeholder: string;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange({ id: "u2", name: "New Delegate", employeeCode: "E2", roleName: "DELEGATE" })
      }
    >
      {placeholder}
    </button>
  ),
}));

const { ReassignForm } = await import("./reassign-form");

const dict = getDictionary("en").routesPage;

function setup(props: Partial<React.ComponentProps<typeof ReassignForm>> = {}) {
  return render(
    <ReassignForm
      routeId="r1"
      isAssigned
      minDate="2026-06-15"
      initialStartDate="2026-06-16"
      initialEndDate="2026-06-22"
      dict={dict}
      {...props}
    />,
  );
}

const pickAssignee = () =>
  fireEvent.click(screen.getByRole("button", { name: dict.searchAssigneesPlaceholder }));

beforeEach(() => {
  vi.clearAllMocks();
  reassignRouteAction.mockResolvedValue({ error: null });
  assignRouteAction.mockResolvedValue({ error: null });
});

describe("ReassignForm", () => {
  it("has the Reassign Route heading, the helper text, and the three fields with a primary button", () => {
    setup();

    expect(screen.getByRole("heading", { name: "Reassign Route" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Reassign this route to a different Delegate or update the assignment date range.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Assign To")).toBeInTheDocument();
    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reassign" })).toBeInTheDocument();
  });

  it("places Start date and End date side by side on desktop and stacked on small screens", () => {
    setup();
    const grid = screen.getByLabelText("Start date").closest("div.grid") as HTMLElement;

    expect(grid.className).toContain("sm:grid-cols-2");
    expect(grid.className).toContain("gap-4");
    expect(grid).toContainElement(screen.getByLabelText("End date"));
  });

  it("constrains the dates: start no earlier than today, end no earlier than the start", () => {
    setup();

    expect(screen.getByLabelText("Start date")).toHaveAttribute("min", "2026-06-15");
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-06-20" } });
    expect(screen.getByLabelText("End date")).toHaveAttribute("min", "2026-06-20");
  });

  it("pulls the end date forward when the start is moved past it", () => {
    setup();

    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-07-01" } });
    expect(screen.getByLabelText("End date")).toHaveValue("2026-07-01");
  });

  it("pre-fills the current range while it is still valid", () => {
    setup();

    expect(screen.getByLabelText("Start date")).toHaveValue("2026-06-16");
    expect(screen.getByLabelText("End date")).toHaveValue("2026-06-22");
  });

  it("leaves the range blank when the current one has already started in the past", () => {
    setup({ initialStartDate: "2026-06-01", initialEndDate: "2026-06-05" });

    expect(screen.getByLabelText("Start date")).toHaveValue("");
    expect(screen.getByLabelText("End date")).toHaveValue("");
  });

  it("won't submit without an assignee", async () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Reassign" }));

    expect(await screen.findByText(dict.assignFormIncomplete)).toBeInTheDocument();
    expect(reassignRouteAction).not.toHaveBeenCalled();
  });

  it("submits the route, assignee and range to the existing reassign action, then returns to the table", async () => {
    setup();
    pickAssignee();
    fireEvent.click(screen.getByRole("button", { name: "Reassign" }));

    await waitFor(() => expect(reassignRouteAction).toHaveBeenCalledTimes(1));
    const formData = reassignRouteAction.mock.calls[0]![1] as FormData;
    expect(formData.get("routeId")).toBe("r1");
    expect(formData.get("targetUserId")).toBe("u2");
    expect(formData.get("startDate")).toBe("2026-06-16");
    expect(formData.get("endDate")).toBe("2026-06-22");
    expect(assignRouteAction).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/routes/assign"));
    expect(toast.success).toHaveBeenCalledWith("Route reassigned");
  });

  it("shows a server refusal and stays put — nothing is bypassed by the form", async () => {
    reassignRouteAction.mockResolvedValue({
      error:
        "This route already has completed visits, so it can no longer be reassigned as a whole.",
    });
    setup();
    pickAssignee();
    fireEvent.click(screen.getByRole("button", { name: "Reassign" }));

    expect(await screen.findByText(/already has completed visits/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("assigns instead when the route has no assignee yet", async () => {
    setup({ isAssigned: false });
    expect(screen.getByRole("heading", { name: "Assign Route" })).toBeInTheDocument();

    pickAssignee();
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => expect(assignRouteAction).toHaveBeenCalledTimes(1));
    expect(reassignRouteAction).not.toHaveBeenCalled();
  });
});
