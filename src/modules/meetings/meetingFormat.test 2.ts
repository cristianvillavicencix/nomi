import { describe, expect, it } from "vitest";
import {
  inferMeetingFormat,
  isMeetingRecord,
  isVideoMeetingRecord,
  normalizeMeetingFormatWriteData,
} from "@/modules/meetings/meetingFormat";

describe("meetingFormat", () => {
  it("infers legacy video meetings from meeting_url", () => {
    expect(
      inferMeetingFormat({ meeting_url: "https://meet.jit.si/demo" }),
    ).toBe("video");
  });

  it("detects meetings by format or legacy url", () => {
    expect(isMeetingRecord({ meeting_format: "phone" })).toBe(true);
    expect(isMeetingRecord({ meeting_url: "https://meet.jit.si/demo" })).toBe(
      true,
    );
    expect(isMeetingRecord({})).toBe(false);
  });

  it("clears meeting_url for phone and in-person formats", () => {
    expect(
      normalizeMeetingFormatWriteData({
        meeting_format: "phone",
        meeting_url: "https://meet.jit.si/demo",
        location: "Call from office line",
      }).meeting_url,
    ).toBeNull();

    expect(
      normalizeMeetingFormatWriteData({
        meeting_format: "in_person",
        meeting_url: "https://meet.jit.si/demo",
        location: "123 Main St",
      }),
    ).toEqual({
      meeting_format: "in_person",
      meeting_url: null,
      location: "123 Main St",
    });
  });

  it("identifies video meetings", () => {
    expect(
      isVideoMeetingRecord({
        meeting_format: "video",
        meeting_url: "https://meet.jit.si/demo",
      }),
    ).toBe(true);
    expect(isVideoMeetingRecord({ meeting_format: "phone" })).toBe(false);
  });
});
