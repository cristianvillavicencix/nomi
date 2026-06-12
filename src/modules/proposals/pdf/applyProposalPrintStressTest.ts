import type { ProposalPrintModel } from "@/modules/proposals/pdf/proposalPrintTypes";

const LONG_PARAGRAPH =
  "This paragraph is intentionally long to stress-test PDF pagination. " +
  "The generator must wrap text within page margins, continue on the next page without clipping, " +
  "and keep section headers with their following content readable. " +
  "Latinos Business Support builds contractor websites with mobile-first performance, local SEO, and conversion-focused calls to action. ".repeat(
    4,
  );

const STRESS_TERMS_MARKDOWN = `# Master service agreement (stress test)

## 1. Scope of work
The Provider will deliver the services described in the proposal, including design, development, launch, and handoff.

### 1.1 Change requests
- **Standard changes** — Minor copy or image swaps included during review windows.
- **Material changes** — New pages, integrations, or scope shifts require a written change order.
- **Timeline impact** — Approved changes may shift milestones and payment dates.

## 2. Payment terms
1. Deposit — Due upon signature to reserve production capacity.
2. Progress payments — Billed per the schedule in the proposal.
3. Final balance — Due before DNS cutover unless otherwise agreed in writing.

## 3. Client responsibilities
Provide brand assets, content, approvals, and access to DNS/hosting within **five (5) business days** when requested.

> Late client inputs may move launch dates without penalty to the Provider.

## 4. Warranty & support
- Thirty (30) day technical warranty on Provider-built functionality.
- Excludes third-party outages, client edits, and force majeure.

${"Additional clause block for pagination testing. ".repeat(30)}
`;

/** Expands any proposal model with extreme line counts and long legal copy. */
export const applyProposalPrintStressTest = (
  model: ProposalPrintModel,
): ProposalPrintModel => {
  const extraLineItems = Array.from({ length: 14 }, (_, index) => ({
    description: `Stress-test add-on service #${index + 1} — extended description that must wrap cleanly inside the investment table`,
    sublabel: index % 3 === 0 ? ("monthly" as const) : undefined,
    amount: `$${(199 + index * 50).toLocaleString("en-US")}.00`,
    isRecurring: index % 3 === 0,
  }));

  const extraInstallments = Array.from({ length: 10 }, (_, index) => ({
    badge: String(index + 2),
    label: `Progress payment ${index + 1}`,
    sublabel: `Due week ${(index + 2) * 2}`,
    amount: `$${(1500 + index * 250).toLocaleString("en-US")}.00`,
  }));

  return {
    ...model,
    filenameBase: `${model.filenameBase}-STRESS`,
    intro: {
      ...model.intro,
      bodyMarkdown: `${model.intro.bodyMarkdown}\n\n${LONG_PARAGRAPH}\n\n${LONG_PARAGRAPH}`.trim(),
    },
    investment: {
      ...model.investment,
      notes: `${model.investment.notes ?? ""}\n\n${LONG_PARAGRAPH}`.trim(),
      lineItems: [...model.investment.lineItems, ...extraLineItems],
      installments: [...model.investment.installments, ...extraInstallments],
      paymentNotes: `${model.investment.paymentNotes ?? ""}\n\n${LONG_PARAGRAPH}`.trim(),
      warranty: model.investment.warranty
        ? {
            ...model.investment.warranty,
            bodyMarkdown: `${model.investment.warranty.bodyMarkdown}\n\n${LONG_PARAGRAPH}`,
          }
        : {
            title: "Warranty (stress)",
            bodyMarkdown: LONG_PARAGRAPH,
          },
    },
    terms: {
      title: "Contract terms (stress test)",
      markdown: STRESS_TERMS_MARKDOWN,
    },
    sections: model.sections.map((section, index) => ({
      ...section,
      bodyMarkdown: `${section.bodyMarkdown}\n\n${LONG_PARAGRAPH.slice(0, 400 + index * 50)}`.trim(),
    })),
  };
};
