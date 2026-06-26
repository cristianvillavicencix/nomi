import { describe, expect, it } from "vitest";
import {
  expandSignature,
  parseMessageBodyWithSignature,
  resolveOrganizationSmsSignature,
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

  it("forces signature for scoped users when org signature is disabled", () => {
    const context = {
      user_first_name: "Harold",
      user_last_name: "Hernandez",
      user_full_name: "Harold Hernandez",
      org_name: "LBS",
    };

    const { signature, signatureRequired } = resolveOrganizationSmsSignature({
      template: "- {{user_full_name}} | {{org_name}}",
      orgEnabled: false,
      forceUserSignature: true,
      context,
    });

    expect(signature).toBe("- Harold Hernandez | LBS");
    expect(signatureRequired).toBe(true);
  });

  it("does not force signature for admins when org signature is disabled", () => {
    const { signature, signatureRequired } = resolveOrganizationSmsSignature({
      template: "- {{user_full_name}} | {{org_name}}",
      orgEnabled: false,
      forceUserSignature: false,
      context: {
        user_first_name: "Admin",
        user_last_name: "User",
        user_full_name: "Admin User",
        org_name: "LBS",
      },
    });

    expect(signature).toBe("");
    expect(signatureRequired).toBe(false);
  });
});
