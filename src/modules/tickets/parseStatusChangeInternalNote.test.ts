import { describe, expect, it } from "vitest";
import {
  formatStatusChangeInternalNoteBody,
  isStatusChangeInternalNote,
  parseStatusChangeInternalNote,
  previewStatusChangeInternalNote,
} from "./parseStatusChangeInternalNote";

describe("parseStatusChangeInternalNote", () => {
  it("parses legacy markdown status notes", () => {
    const body = "**Status:** open -> waiting\n\na la espera";
    expect(isStatusChangeInternalNote(body)).toBe(true);
    expect(parseStatusChangeInternalNote(body)).toEqual({
      fromStatus: "open",
      toStatus: "waiting",
      note: "a la espera",
    });
    expect(previewStatusChangeInternalNote(body)).toBe(
      "Status open → waiting · a la espera",
    );
  });

  it("parses unicode arrow format", () => {
    const body = "Status: open → waiting\n\nWaiting on client files.";
    expect(parseStatusChangeInternalNote(body)).toEqual({
      fromStatus: "open",
      toStatus: "waiting",
      note: "Waiting on client files.",
    });
  });

  it("formats new notes without markdown asterisks", () => {
    expect(
      formatStatusChangeInternalNoteBody("open", "waiting", "a la espera"),
    ).toBe("Status: open → waiting\n\na la espera");
  });
});
