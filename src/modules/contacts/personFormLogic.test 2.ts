import { describe, expect, it } from "vitest";
import {
  defaultPersonFormValues,
  getPersonCreateLeadStageLabel,
  personKindToStatus,
  resolveCompanySectionVariant,
  resolvePersonFormVisibility,
  shouldShowContactIdentity,
  statusToPersonKind,
  syncPersonKindFields,
  PERSON_CREATE_LEAD_STAGE_ID,
} from "./personFormLogic";

describe("personFormLogic", () => {
  describe("personKindToStatus / statusToPersonKind", () => {
    it("maps prospect to lead status", () => {
      expect(personKindToStatus("prospect")).toBe("lead");
      expect(statusToPersonKind("lead")).toBe("prospect");
    });

    it("maps contact_only without exposing client", () => {
      expect(personKindToStatus("contact_only")).toBe("contact_only");
      expect(statusToPersonKind("contact_only")).toBe("contact_only");
      expect(statusToPersonKind("client")).toBe("contact_only");
    });

    it("treats legacy prospect status as prospect kind", () => {
      expect(statusToPersonKind("prospect")).toBe("prospect");
    });
  });

  describe("syncPersonKindFields", () => {
    it("sets lead_stage to new for prospects only", () => {
      expect(syncPersonKindFields("prospect")).toEqual({
        person_kind: "prospect",
        status: "lead",
        lead_stage: PERSON_CREATE_LEAD_STAGE_ID,
      });
      expect(syncPersonKindFields("contact_only").lead_stage).toBeNull();
    });
  });

  describe("getPersonCreateLeadStageLabel", () => {
    it("returns New for create badge", () => {
      expect(getPersonCreateLeadStageLabel()).toBe("New");
    });
  });

  describe("defaultPersonFormValues", () => {
    it("defaults pipeline mode to prospect", () => {
      const values = defaultPersonFormValues("pipeline", 7);
      expect(values.person_kind).toBe("prospect");
      expect(values.status).toBe("lead");
      expect(values.lead_stage).toBe("new");
      expect(values.assigned_member_ids).toEqual([7]);
    });

    it("defaults directory mode to contact_only", () => {
      const values = defaultPersonFormValues("directory");
      expect(values.person_kind).toBe("contact_only");
      expect(values.status).toBe("contact_only");
      expect(values.lead_stage).toBeNull();
    });
  });

  describe("shouldShowContactIdentity", () => {
    it("hides identity for business prospect without primary contact", () => {
      expect(shouldShowContactIdentity("prospect", "business", false)).toBe(
        false,
      );
      expect(shouldShowContactIdentity("prospect", "business", true)).toBe(
        true,
      );
    });

    it("always shows identity for contact_only", () => {
      expect(shouldShowContactIdentity("contact_only", "business", false)).toBe(
        true,
      );
    });
  });

  describe("resolveCompanySectionVariant", () => {
    it("uses inline draft for pipeline business prospect", () => {
      expect(
        resolveCompanySectionVariant({
          mode: "pipeline",
          personKind: "prospect",
          leadType: "business",
        }),
      ).toBe("inline_draft");
    });

    it("shows optional company picker for pipeline individual prospect", () => {
      expect(
        resolveCompanySectionVariant({
          mode: "pipeline",
          personKind: "prospect",
          leadType: "individual",
        }),
      ).toBe("picker");
    });

    it("uses picker for directory", () => {
      expect(
        resolveCompanySectionVariant({
          mode: "directory",
          personKind: "contact_only",
          leadType: "individual",
        }),
      ).toBe("picker");
    });

    it("hides company when locked", () => {
      expect(
        resolveCompanySectionVariant({
          mode: "directory",
          personKind: "contact_only",
          leadType: "individual",
          lockCompanyId: 42,
        }),
      ).toBe("hidden");
    });
  });

  describe("resolvePersonFormVisibility", () => {
    it("orders full directory flow with type selector and no sales", () => {
      const visibility = resolvePersonFormVisibility({
        mode: "directory",
        personKind: "contact_only",
        leadType: "individual",
        addPrimaryContact: true,
        expanded: true,
      });

      expect(visibility.showTypeSelector).toBe(true);
      expect(visibility.showSalesSection).toBe(false);
      expect(visibility.showLeadStageBadge).toBe(false);
      expect(visibility.assignmentMulti).toBe(false);
      expect(visibility.showInactiveDirectoryStatus).toBe(true);
    });

    it("locks pipeline to prospect with sales and multi assignment", () => {
      const visibility = resolvePersonFormVisibility({
        mode: "pipeline",
        personKind: "prospect",
        leadType: "individual",
        addPrimaryContact: true,
        expanded: true,
      });

      expect(visibility.showTypeSelector).toBe(false);
      expect(visibility.showSalesSection).toBe(true);
      expect(visibility.showLeadStageBadge).toBe(true);
      expect(visibility.assignmentMulti).toBe(true);
      expect(visibility.showLeadProfileToggle).toBe(true);
    });

    it("compact collapsed shows only preview sections", () => {
      const visibility = resolvePersonFormVisibility({
        mode: "compact",
        personKind: "contact_only",
        leadType: "individual",
        addPrimaryContact: true,
        expanded: false,
      });

      expect(visibility.compactCollapsed).toBe(true);
      expect(visibility.showSalesSection).toBe(false);
      expect(visibility.showAssignmentSection).toBe(false);
      expect(visibility.showMoreOptions).toBe(false);
    });
  });
});
