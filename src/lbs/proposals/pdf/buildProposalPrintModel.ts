import type { ProposalDocumentDataSnapshot } from "@/lbs/proposals/document/mapPublicProposalDocumentData";
import {
  getProposalDocumentCopy,
  proposalDateLocale,
  type ProposalLocale,
} from "@/lbs/proposals/document/proposalDocumentI18n";
import type { ProposalDocumentContent } from "@/lbs/proposals/document/proposalDocumentTypes";
import { partitionProposalDeckSections } from "@/lbs/proposals/document/proposalDeckSectionOrder";
import { visibleProposalCustomSections } from "@/lbs/proposals/document/proposalDocumentSections";
import {
  formatProposalMoney,
  lineItemTotal,
} from "@/lbs/proposals/document/useProposalDocumentData";
import { isPackageLine } from "@/lbs/proposals/proposalCatalogUtils";
import type {
  ProposalPrintBlock,
  ProposalPrintModel,
  ProposalPrintSection,
} from "@/lbs/proposals/pdf/proposalPrintTypes";
import type { ProposalCustomSection } from "@/lbs/proposals/document/proposalDocumentTypes";
import { weekLabelFromBar } from "@/lbs/proposals/document/proposalTimeline";

const sectionKicker = (
  sectionId: string,
  locale: ProposalLocale,
): string => {
  const copy = getProposalDocumentCopy(locale);
  const map: Record<string, string> = {
    "about-us": copy.nav.aboutUs,
    "work-reviews": copy.nav.workReviews,
    "what-we-deliver": copy.nav.whatWeDeliver,
    "website-features": copy.nav.websiteFeatures,
    process: copy.nav.process,
    "content-management": copy.nav.contentManagement,
    timeline: copy.nav.timeline,
    "project-timeline": copy.nav.timeline,
  };
  return map[sectionId] ?? copy.nav.custom;
};

const formatDate = (value: string | null | undefined, locale: ProposalLocale) => {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(proposalDateLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/** Extra PDF blocks (team, timeline, …). Section prose uses `bodyMarkdown` like terms. */
const blocksForSection = (
  section: ProposalCustomSection,
  content: ProposalDocumentContent,
): ProposalPrintBlock[] => {
  if (section.id === "about-us") {
    return [
      {
        type: "stats",
        rows: [
          {
            value: content.about_stats?.websites ?? "120+",
            label: "Websites launched",
          },
          {
            value: content.about_stats?.years ?? "8 yrs",
            label: "Years in business",
          },
          {
            value: content.about_stats?.leads ?? "3.4×",
            label: "Avg. lead increase",
          },
          {
            value: content.about_stats?.retention ?? "98%",
            label: "Client retention",
          },
        ],
      },
      {
        type: "team",
        members: (content.team_members ?? []).map((member) => ({
          name: member.name,
          role: member.role,
          bio: member.bio?.trim() || undefined,
        })),
      },
    ];
  }

  if (section.id === "work-reviews") {
    const logos = (content.client_logos ?? []).filter(
      (logo) => logo.image_url?.trim() || logo.name?.trim(),
    );
    return [
      ...(logos.length
        ? [
            {
              type: "client_logos" as const,
              logos: logos.map((logo) => ({ name: logo.name })),
            },
          ]
        : []),
      {
        type: "portfolio",
        items: (content.portfolio_items ?? []).map((item) => ({
          title: item.title,
          subtitle: item.subtitle,
        })),
      },
    ];
  }

  if (section.id === "timeline" || section.id === "project-timeline") {
    const bars = content.timeline_bars ?? [];
    return [
      {
        type: "timeline",
        bars: bars.map((bar) => ({
          label: bar.label,
          weekLabel: bar.week_label?.trim() || weekLabelFromBar(bar),
          leftPercent: bar.left_percent,
          widthPercent: bar.width_percent,
          tone: bar.tone,
        })),
      },
    ];
  }

  return [];
};

export const buildProposalPrintModel = ({
  content,
  snapshot,
  locale,
  variables,
}: {
  content: ProposalDocumentContent;
  snapshot: ProposalDocumentDataSnapshot;
  locale: ProposalLocale;
  variables: {
    empresa?: string;
    cliente?: string;
    preparada_por?: string;
    deal?: string;
    proposal_number?: string;
    valid_until?: string;
    fecha?: string;
  };
}): ProposalPrintModel => {
  const copy = getProposalDocumentCopy(locale);
  const { proposal, lineDrafts, paymentInstallments, oneTimeTotal, recurringSubtotal, currency } =
    snapshot;

  const deck = partitionProposalDeckSections(
    visibleProposalCustomSections(content.custom_sections),
  );

  const toPrintSection = (section: ProposalCustomSection): ProposalPrintSection => ({
    kicker: sectionKicker(section.id, locale),
    title: section.title,
    bodyMarkdown: section.body ?? "",
    blocks: blocksForSection(section, content),
  });

  const sections: ProposalPrintSection[] = deck.narrative.map(toPrintSection);

  if (deck.timeline) {
    sections.push(toPrintSection(deck.timeline));
  }

  const basePackage = lineDrafts.find((line) => isPackageLine(line));
  const addonLines = lineDrafts.filter((line) => !isPackageLine(line));

  const depositInstallment = paymentInstallments.find((row) =>
    row.label.toLowerCase().includes("deposit"),
  );
  const balanceInstallments = paymentInstallments.filter(
    (row) => !row.label.toLowerCase().includes("deposit"),
  );

  const termsMarkdown =
    snapshot.termsMarkdown?.trim() ||
    content.terms_body?.trim() ||
    snapshot.contractTerms?.body_markdown?.trim() ||
    "";

  const termsTitle =
    snapshot.termsTitle?.trim() ||
    content.terms_title?.trim() ||
    snapshot.contractTerms?.title?.trim() ||
    copy.termsDefaultTitle;

  return {
    locale,
    filenameBase: proposal.proposal_number ?? `proposal-${proposal.id}`,
    hero: {
      tag: copy.serviceProposal,
      title: content.hero_title ?? proposal.title,
      subtitle:
        content.hero_subtitle ??
        `Prepared for ${variables.empresa ?? "your company"} by Latinos Business Support`,
      meta: [
        { label: copy.date, value: variables.fecha ?? formatDate(new Date().toISOString().slice(0, 10), locale) },
        { label: copy.preparedBy, value: variables.preparada_por ?? "Latinos Business Support" },
        {
          label: copy.validFor,
          value: `${proposal.validity_days ?? 30} ${copy.days}`,
        },
      ],
    },
    intro: {
      title: content.intro_title ?? "",
      bodyMarkdown: content.intro_body ?? "",
      signatory:
        content.intro_signatory_name?.trim() ||
        variables.preparada_por ||
        undefined,
      signatoryOrg:
        content.intro_signatory_company?.trim() ||
        "Latinos Business Support",
    },
    sections,
    investment: {
      kicker: copy.sections.investment,
      title: content.investment_title ?? copy.investmentDefaultTitle,
      notes: content.investment_notes?.trim() || undefined,
      packageLine: basePackage
        ? {
            description: basePackage.description,
            amount: formatProposalMoney(lineItemTotal(basePackage), currency),
          }
        : undefined,
      lineItems: addonLines.map((line) => ({
        description: line.description,
        sublabel:
          line.billing_type === "recurring"
            ? line.billing_interval ?? "monthly"
            : undefined,
        amount: formatProposalMoney(lineItemTotal(line), currency),
        isRecurring: line.billing_type === "recurring",
      })),
      oneTimeLabel: copy.oneTimePayment,
      oneTimeAmount: formatProposalMoney(oneTimeTotal, currency),
      recurringLabel:
        recurringSubtotal > 0 ? copy.recurringServices : undefined,
      recurringAmount:
        recurringSubtotal > 0
          ? `${formatProposalMoney(recurringSubtotal, currency)}/mo`
          : undefined,
      grandLabel: copy.totalInvestment,
      grandAmount:
        recurringSubtotal > 0
          ? `${formatProposalMoney(oneTimeTotal, currency)} + ${formatProposalMoney(recurringSubtotal, currency)}/mo`
          : formatProposalMoney(oneTimeTotal, currency),
      paymentsTitle: copy.paymentsTitle,
      installments: [
        ...(depositInstallment
          ? [
              {
                badge: copy.depositBadge,
                label: copy.depositLabel,
                sublabel: copy.depositSub,
                amount: formatProposalMoney(depositInstallment.amount, currency),
              },
            ]
          : []),
        ...balanceInstallments.map((row, index) => ({
          badge: String(row.installment_number ?? index + 1),
          label: row.label,
          sublabel: formatDate(row.due_date, locale),
          amount: formatProposalMoney(row.amount, currency),
        })),
      ],
      paymentNotes: content.payment_notes?.trim() || undefined,
      warranty:
        content.warranty_body?.trim()
          ? {
              title: content.warranty_title ?? copy.sections.warranty,
              bodyMarkdown: content.warranty_body,
            }
          : undefined,
    },
    terms: termsMarkdown
      ? { title: termsTitle, markdown: termsMarkdown }
      : undefined,
    accept: {
      kicker: copy.sections.accept,
      title: content.accept_title ?? copy.acceptDefaultTitle,
      bodyMarkdown: content.accept_body ?? copy.acceptIntro,
      pdfNote: copy.pdfAcceptNote,
    },
  };
};
