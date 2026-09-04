import { describe, expect, it } from "vitest";
import {
  formatTeamResourceLabel,
  parseTeamResourceLabel,
} from "@/modules/deals/teamResourceLabel";

describe("teamResourceLabel", () => {
  it("formats name and role", () => {
    expect(
      formatTeamResourceLabel({ name: "Maria Lopez", role: "PM" }),
    ).toBe("Maria Lopez — PM");
  });

  it("parses name and role", () => {
    expect(parseTeamResourceLabel("Maria Lopez — Project manager")).toEqual({
      name: "Maria Lopez",
      role: "Project manager",
    });
  });

  it("round-trips", () => {
    const label = formatTeamResourceLabel({
      name: "Alex",
      role: "Owner",
    });
    expect(parseTeamResourceLabel(label)).toEqual({
      name: "Alex",
      role: "Owner",
    });
  });
});
