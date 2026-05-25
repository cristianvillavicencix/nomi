import { describe, expect, it } from "vitest";
import {
  expandSignature,
  parseMessageBodyWithSignature,
} from "@/lib/signatures/signatureExpansion";

describe("signatureExpansion", () => {
  it("expands template variables", () => {
    const result = expandSignature(
      "- {{user_first_name}} {{user_last_name}} | {{org_name}}",
      {
        user_first_name: "Cristian",
        user_last_name: "Villavicencio",
        user_full_name: "Cristian Villavicencio",
        org_name: "LBS",
      },
    );

    expect(result).toBe("- Cristian Villavicencio | LBS");
  });

  it("splits trailing signature line from message body", () => {
    const parsed = parseMessageBodyWithSignature(
      "Thanks for reaching out.\n- Cristian | LBS Team",
    );

    expect(parsed.content).toBe("Thanks for reaching out.");
    expect(parsed.signature).toBe("- Cristian | LBS Team");
  });
});
