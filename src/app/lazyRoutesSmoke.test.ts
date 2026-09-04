import { describe, expect, it, vi } from "vitest";

vi.stubEnv(
  "VITE_SUPABASE_URL",
  "https://qjglkywmqwqdoaboakao.supabase.co",
);
vi.stubEnv("VITE_SB_PUBLISHABLE_KEY", "sb_publishable_test_key");

/**
 * Smoke: every lazy route / Resource barrel target must dynamic-import cleanly.
 * Catches broken paths, missing exports, and circular import failures after bundle splits.
 */
const lazyRouteModules = [
  ["MailPage", () => import("@/modules/mail/MailPage")],
  ["MessagesPage", () => import("@/modules/messages/MessagesPage")],
  ["TicketsOverview", () => import("@/modules/tickets/TicketsOverview")],
  ["TicketShow", () => import("@/modules/tickets/TicketShow")],
  ["TicketCreate", () => import("@/modules/tickets/TicketCreate")],
  ["ClientBillingPage", () => import("@/modules/billing/ClientBillingPage")],
  [
    "StandaloneInvoiceCreatePage",
    () => import("@/modules/billing/StandaloneInvoiceCreatePage"),
  ],
  [
    "StandaloneInvoiceEditPage",
    () => import("@/modules/billing/StandaloneInvoiceEditPage"),
  ],
  ["ProposalsList", () => import("@/modules/proposals/ProposalsList")],
  ["ProposalCreate", () => import("@/modules/proposals/ProposalCreate")],
  ["ProposalEdit", () => import("@/modules/proposals/ProposalEdit")],
  ["ProposalViewPage", () => import("@/modules/proposals/ProposalViewPage")],
  ["ContractsList", () => import("@/modules/contracts/ContractsList")],
  ["ContractShow", () => import("@/modules/contracts/ContractShow")],
  ["FormsListPage", () => import("@/modules/forms/FormsListPage")],
  ["FormBuilderPage", () => import("@/modules/forms/builder/FormBuilderPage")],
  [
    "SubmissionsListPage",
    () => import("@/modules/forms/submissions/SubmissionsListPage"),
  ],
  [
    "SubmissionDetailPage",
    () => import("@/modules/forms/submissions/SubmissionDetailPage"),
  ],
  [
    "FormAnalyticsPage",
    () => import("@/modules/forms/analytics/FormAnalyticsPage"),
  ],
  ["SettingsPage", () => import("@/components/atomic-crm/settings/SettingsPage")],
  ["ReportsPage", () => import("@/reports/ReportsPage")],
  [
    "WebAgencyMetricsReportPage",
    () => import("@/reports/WebAgencyMetricsReportPage"),
  ],
  ["FormPublicEntry", () => import("@/modules/forms/public/FormPublicEntry")],
  [
    "WebsiteBriefPreviewPage",
    () => import("@/modules/forms/public/WebsiteBriefPreviewPage"),
  ],
  [
    "PublicProposalPage",
    () => import("@/modules/proposals/public/PublicProposalPage"),
  ],
  [
    "PublicInvoicePage",
    () => import("@/modules/billing/public/PublicInvoicePage"),
  ],
  ["ClientPortalPage", () => import("@/modules/portal/ClientPortalPage")],
  [
    "VoiceCallProviderInner",
    () => import("@/modules/voice/VoiceCallProviderInner"),
  ],
  ["MailComposeProvider", () => import("@/modules/mail/MailComposeProvider")],
] as const;

describe("lazy route smoke", () => {
  it.each(lazyRouteModules)("imports %s", async (_name, loader) => {
    const module = await loader();
    expect(module).toBeTruthy();
    expect(Object.keys(module).length).toBeGreaterThan(0);
  });
});

describe("async vendor smoke", () => {
  it("loads pdfmake via getPdfMake", async () => {
    const { getPdfMake } = await import("@/modules/proposals/pdf/initPdfMake");
    const pdfMake = await getPdfMake();
    expect(pdfMake.createPdf).toBeTypeOf("function");
  });

  it("loads mathjs for formula evaluation", async () => {
    const { buildFormulaAnswers } = await import(
      "@/lib/forms-v2/formulaEvaluator"
    );
    const answers = await buildFormulaAnswers(
      {
        sections: [
          {
            fields: [
              { key: "total", type: "formula", formula: "1 + 2" },
            ],
          },
        ],
      },
      {},
    );
    expect(answers.total).toBe(3);
  });
});
