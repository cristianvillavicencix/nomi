import { describe, expect, it } from "vitest";
import { prepareContactWriteData } from "@/components/atomic-crm/providers/supabase/dataProviderWriteHelpers";

describe("prepareContactWriteData", () => {
  it("strips UI-only lead_type so PostgREST never sees a missing column", () => {
    const prepared = prepareContactWriteData({
      first_name: "Ada",
      last_name: "Lovelace",
      lead_type: "individual",
      person_kind: "lead",
      interested_services: ["Web"],
      email_jsonb: [{ email: "ada@example.com", type: "Work" }],
      phone_jsonb: [],
    });

    expect(prepared).not.toHaveProperty("lead_type");
    expect(prepared).not.toHaveProperty("person_kind");
    expect(prepared).not.toHaveProperty("interested_services");
    expect(prepared.interested_service).toBe("Web");
    expect(prepared.first_name).toBe("Ada");
  });
});
