import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calendarEventPreviewController } from "@/modules/calendar/calendarEventPreviewController";

describe("calendarEventPreviewController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    calendarEventPreviewController.closeImmediately();
  });

  afterEach(() => {
    vi.useRealTimers();
    calendarEventPreviewController.closeImmediately();
  });

  it("opens one preview after delay", () => {
    const seen: Array<string | null> = [];
    calendarEventPreviewController.subscribe((id) => seen.push(id));

    calendarEventPreviewController.scheduleOpen("a");
    expect(seen).toEqual([null]);

    vi.advanceTimersByTime(220);
    expect(seen).toEqual([null, "a"]);
  });

  it("switches instantly between previews when one is already open", () => {
    const seen: Array<string | null> = [];
    calendarEventPreviewController.subscribe((id) => seen.push(id));

    calendarEventPreviewController.scheduleOpen("a");
    vi.advanceTimersByTime(220);
    calendarEventPreviewController.scheduleOpen("b");

    expect(seen.at(-1)).toBe("b");
  });

  it("closes after leave delay", () => {
    const seen: Array<string | null> = [];
    calendarEventPreviewController.subscribe((id) => seen.push(id));

    calendarEventPreviewController.scheduleOpen("a");
    vi.advanceTimersByTime(220);
    calendarEventPreviewController.scheduleClose("a");
    vi.advanceTimersByTime(140);

    expect(seen.at(-1)).toBe(null);
  });

  it("cancels close when pointer enters popover content", () => {
    const seen: Array<string | null> = [];
    calendarEventPreviewController.subscribe((id) => seen.push(id));

    calendarEventPreviewController.scheduleOpen("a");
    vi.advanceTimersByTime(220);
    calendarEventPreviewController.scheduleClose("a");
    vi.advanceTimersByTime(50);
    calendarEventPreviewController.cancelClose();
    calendarEventPreviewController.scheduleOpen("a");
    vi.advanceTimersByTime(140);

    expect(seen.at(-1)).toBe("a");
  });
});
