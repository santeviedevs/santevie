import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionary } from "@/lib/i18n/dictionary";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const cancelRouteAssignmentAction = vi.fn();
vi.mock("../actions", () => ({ cancelRouteAssignmentAction }));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast }));

const { CancelAssignmentButton } = await import("./cancel-assignment-button");

const dict = getDictionary("en").routesPage;

beforeEach(() => {
  vi.clearAllMocks();
  cancelRouteAssignmentAction.mockResolvedValue({ error: null });
});

describe("CancelAssignmentButton", () => {
  it("is a red outlined 'Cancel Current Assignment' button with an icon", () => {
    render(<CancelAssignmentButton routeId="r1" dict={dict} />);
    const button = screen.getByRole("button", { name: "Cancel Current Assignment" });

    expect(button.className).toContain("text-destructive");
    expect(button.className).toContain("border-destructive");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("asks for confirmation first — clicking the button cancels nothing", async () => {
    render(<CancelAssignmentButton routeId="r1" dict={dict} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel Current Assignment" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Cancel this assignment?")).toBeInTheDocument();
    expect(cancelRouteAssignmentAction).not.toHaveBeenCalled();
  });

  it("explains it cancels the assignment, not the route, and keeps completed work and history", async () => {
    render(<CancelAssignmentButton routeId="r1" dict={dict} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel Current Assignment" }));

    const body = await screen.findByText(/cancels the current assignment/i);
    expect(body).toHaveTextContent("not deleted");
    expect(body).toHaveTextContent("completed work");
    expect(body).toHaveTextContent("history");
  });

  it("closes without cancelling when the user keeps the assignment", async () => {
    render(<CancelAssignmentButton routeId="r1" dict={dict} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel Current Assignment" }));

    fireEvent.click(await screen.findByRole("button", { name: "Keep assignment" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(cancelRouteAssignmentAction).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("on confirmation runs the existing cancel action for this route, then returns to the table", async () => {
    render(<CancelAssignmentButton routeId="r1" dict={dict} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel Current Assignment" }));

    fireEvent.click(await screen.findByRole("button", { name: "Cancel assignment" }));

    await waitFor(() => expect(cancelRouteAssignmentAction).toHaveBeenCalledTimes(1));
    const formData = cancelRouteAssignmentAction.mock.calls[0]![1] as FormData;
    expect(formData.get("routeId")).toBe("r1");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/routes/assign"));
    expect(toast.success).toHaveBeenCalledWith("Assignment cancelled");
  });

  it("shows the server's refusal and stays on the page", async () => {
    cancelRouteAssignmentAction.mockResolvedValue({ error: "You can only act on your own route." });
    render(<CancelAssignmentButton routeId="r1" dict={dict} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel Current Assignment" }));

    fireEvent.click(await screen.findByRole("button", { name: "Cancel assignment" }));

    expect(await screen.findByText("You can only act on your own route.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
