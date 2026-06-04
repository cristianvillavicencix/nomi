import { Check, Monitor, RefreshCw, Shield } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isClientBillingSkipped } from "@/lbs/billing/clientBillingProvider";
import { isPackageLine } from "@/lbs/proposals/proposalCatalogUtils";
import { EditableBlock } from "@/lbs/proposals/document/EditableBlock";
import { ProposalFormalSection } from "@/lbs/proposals/document/ProposalFormalSection";
import { ProposalIntroSection } from "@/lbs/proposals/document/ProposalIntroSection";
import "./proposal-formal.css";
import { ProposalDocumentAcceptSection } from "@/lbs/proposals/document/ProposalDocumentAcceptSection";
import { partitionProposalDeckSections } from "@/lbs/proposals/document/proposalDeckSectionOrder";
import {
  buildProposalDocumentSections,
  visibleProposalCustomSections,
} from "@/lbs/proposals/document/proposalDocumentSections";
import {
  getProposalDocumentCopy,
  proposalDateLocale,
  type ProposalLocale,
} from "@/lbs/proposals/document/proposalDocumentI18n";
import { resolveProposalDocumentContent } from "@/lbs/proposals/document/proposalLocalizedContent";
import { useProposalLocaleOptional } from "@/lbs/proposals/document/ProposalLocaleContext";
import type { ProposalDocumentContent } from "@/lbs/proposals/document/proposalDocumentTypes";
import type { ProposalDocumentDataSnapshot } from "@/lbs/proposals/document/mapPublicProposalDocumentData";
import {
  formatProposalMoney,
  lineItemTotal,
  useProposalDocumentData,
} from "@/lbs/proposals/document/useProposalDocumentData";
import { ProposalDocumentSidebar } from "@/lbs/proposals/document/ProposalDocumentSidebar";
import { useSectionSpy } from "@/lbs/proposals/document/useSectionSpy";
import {
  buildProposalVariableContext,
  mergeProposalDocumentContent,
  mergeTextVariables,
} from "@/lbs/proposals/document/proposalVariableMerge";
import type { ProposalLineItem } from "@/lbs/types";
import { PROPOSAL_PDF_ROOT_ID } from "@/lbs/proposals/proposalPdfExport";

/** Inline icon — avoids production bundle missing lucide `CreditCard` export. */
const PaymentCardIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </svg>
);

const formatDisplayDate = (
  value?: string | null,
  locale: ProposalLocale = "en",
) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(proposalDateLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const ProposalDocumentView = ({
  proposalId,
  content,
  onContentChange,
  editable = false,
  clientView = false,
  showAcceptPlaceholder = true,
  showSectionNav = false,
  pageScroll = false,
  onRemoveCustomSection,
  acceptMode,
  publicToken,
  onPublicRefresh,
  contractSnapshot,
  publicDocumentData,
  documentData,
  locale: localeOverride,
  onDownloadPdf,
  isExportingPdf = false,
  sidebarLanguageToggle,
  onAddSection,
}: {
  proposalId: string | number;
  content: ProposalDocumentContent;
  onContentChange?: (patch: Partial<ProposalDocumentContent>) => void;
  editable?: boolean;
  clientView?: boolean;
  showAcceptPlaceholder?: boolean;
  /** Section index sidebar (scroll-spy). On for draft/review; off for client-facing views. */
  showSectionNav?: boolean;
  /** Scroll the page (parent) instead of a fixed inner panel — use for standalone client preview. */
  pageScroll?: boolean;
  onRemoveCustomSection?: (customSectionId: string) => void;
  acceptMode?: "off" | "editor" | "preview" | "live";
  publicToken?: string;
  onPublicRefresh?: () => void;
  contractSnapshot?: {
    signed_at: string | null;
    deposit_paid_at?: string | null;
    terms_snapshot: string | null;
  } | null;
  /** When set (public client link), skip authenticated CRM data fetches. */
  publicDocumentData?: ProposalDocumentDataSnapshot;
  /** Preloaded CRM data (e.g. client preview) — avoids duplicate fetches. */
  documentData?: ProposalDocumentDataSnapshot;
  locale?: ProposalLocale;
  onDownloadPdf?: () => void;
  isExportingPdf?: boolean;
  sidebarLanguageToggle?: React.ReactNode;
  /** Editor only — adds a custom section to the deck. */
  onAddSection?: () => void;
}) => {
  const localeContext = useProposalLocaleOptional();
  const locale = localeOverride ?? localeContext?.locale ?? "en";
  const copy = getProposalDocumentCopy(locale);

  const skipDataHook = Boolean(publicDocumentData || documentData);

  const {
    proposal: hookProposal,
    isLoading,
    isError,
    error,
    lineDrafts: hookLineDrafts,
    paymentInstallments: hookPaymentInstallments,
    company: hookCompany,
    contact: hookContact,
    deal: hookDeal,
    member: hookMember,
    contractTerms: hookContractTerms,
    linkedContract,
    oneTimeTotal: hookOneTimeTotal,
    currency: hookCurrency,
  } = useProposalDocumentData(proposalId, {
    enabled: !skipDataHook,
    fetchLinkedContract: !contractSnapshot,
    fetchContractTerms: !clientView,
  });

  const dataSource = publicDocumentData ?? documentData;
  const proposal = dataSource?.proposal ?? hookProposal;
  const lineDrafts = dataSource?.lineDrafts ?? hookLineDrafts;
  const paymentInstallments =
    dataSource?.paymentInstallments ?? hookPaymentInstallments;
  const company = dataSource?.company ?? hookCompany;
  const contact = dataSource?.contact ?? hookContact;
  const deal = dataSource?.deal ?? hookDeal;
  const member = dataSource?.member ?? hookMember;
  const contractTerms = dataSource?.contractTerms ?? hookContractTerms;
  const resolvedTermsMarkdownFromSource = dataSource?.termsMarkdown ?? null;
  const oneTimeTotal = dataSource?.oneTimeTotal ?? hookOneTimeTotal;
  const currency = dataSource?.currency ?? hookCurrency;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setScrollRoot(scrollContainerRef.current);
  }, [showSectionNav, isLoading]);

  const localizedContent = useMemo(
    () => resolveProposalDocumentContent(content, locale),
    [content, locale],
  );

  const navSections = useMemo(
    () => buildProposalDocumentSections(localizedContent, locale),
    [localizedContent, locale],
  );

  const sectionIds = navSections.map((section) => section.id);
  const { activeId, scrollTo } = useSectionSpy(
    sectionIds,
    "-8% 0px -55% 0px",
    showSectionNav,
    scrollRoot,
  );

  const resolvedProposal = proposal;

  const variables = useMemo(() => {
    if (!resolvedProposal) return {};
    return buildProposalVariableContext({
      proposal: resolvedProposal,
      company,
      contact,
      deal,
      member,
      organizationName: dataSource?.organization?.name,
    });
  }, [resolvedProposal, company, contact, deal, member, dataSource?.organization?.name]);

  const mergedContent = useMemo(
    () => mergeProposalDocumentContent(localizedContent, variables),
    [localizedContent, variables],
  );

  const deckSections = useMemo(
    () =>
      partitionProposalDeckSections(
        visibleProposalCustomSections(
          editable
            ? localizedContent.custom_sections
            : mergedContent.custom_sections,
        ),
      ),
    [
      editable,
      localizedContent.custom_sections,
      mergedContent.custom_sections,
    ],
  );

  const resolvedAcceptMode =
    acceptMode ??
    (!showAcceptPlaceholder
      ? "off"
      : clientView && publicToken
        ? "live"
        : clientView
          ? "preview"
          : editable
            ? "editor"
            : "off");

  const contractForAccept =
    contractSnapshot ??
    (linkedContract
      ? {
          signed_at: linkedContract.signed_at ?? null,
          deposit_paid_at: linkedContract.deposit_paid_at ?? null,
          terms_snapshot:
            linkedContract.terms_snapshot ??
            contractTerms?.body_markdown ??
            null,
        }
      : null);

  const stripeSkipped = isClientBillingSkipped();

  const resolvedLineDrafts = lineDrafts;
  const resolvedPaymentInstallments = paymentInstallments;
  const resolvedOneTimeTotal = oneTimeTotal;
  const resolvedCurrency = currency;
  const resolvedBasePackageLine = resolvedLineDrafts.find((line) =>
    isPackageLine(line),
  );
  const resolvedRecurringLines = resolvedLineDrafts.filter(
    (line) => line.billing_type === "recurring",
  );
  const resolvedRecurringFromLines = resolvedRecurringLines.reduce(
    (sum, line) => sum + lineItemTotal(line),
    0,
  );
  const displayRecurringSubtotal =
    dataSource?.recurringSubtotal ?? resolvedRecurringFromLines;

  const resolvedDepositInstallment = resolvedPaymentInstallments.find((row) =>
    row.label.toLowerCase().includes("deposit"),
  );
  const resolvedBalanceInstallments = resolvedPaymentInstallments.filter(
    (row) => !row.label.toLowerCase().includes("deposit"),
  );
  const resolvedPerBalancePayment = resolvedBalanceInstallments[0]?.amount ?? 0;

  if (!skipDataHook && isError) {
    return (
      <p className="p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load proposal."}
      </p>
    );
  }

  if (!skipDataHook && (isLoading || !proposal)) {
    return <p className="text-sm text-muted-foreground">{copy.loading}</p>;
  }

  if (!resolvedProposal) {
    return <p className="text-sm text-muted-foreground">{copy.loading}</p>;
  }

  const patch = (partial: Partial<ProposalDocumentContent>) => {
    onContentChange?.(partial);
  };

  const patchCustomSection = (
    customSectionId: string,
    partial: { title?: string; body?: string; image_url?: string | null },
  ) => {
    const next = (content.custom_sections ?? []).map((section) =>
      section.id === customSectionId ? { ...section, ...partial } : section,
    );
    patch({ custom_sections: next });
  };

  const proposalOrgId = Number(resolvedProposal?.org_id ?? 0);
  const proposalNumericId = Number(resolvedProposal?.id ?? proposalId);

  const termsMarkdownRaw =
    contractForAccept?.terms_snapshot?.trim() ||
    mergedContent.terms_body?.trim() ||
    resolvedTermsMarkdownFromSource?.trim() ||
    contractTerms?.body_markdown?.trim() ||
    "";

  const termsMarkdown = termsMarkdownRaw
    ? mergeTextVariables(termsMarkdownRaw, variables)
    : "";

  const metaLine =
    resolvedProposal.proposal_number || resolvedProposal.valid_until ? (
      <p className="text-xs text-muted-foreground">
        {resolvedProposal.proposal_number
          ? `#${resolvedProposal.proposal_number}`
          : null}
        {resolvedProposal.proposal_number && resolvedProposal.valid_until
          ? " · "
          : null}
        {resolvedProposal.valid_until
          ? `${copy.validUntil} ${formatDisplayDate(resolvedProposal.valid_until, locale)}`
          : null}
      </p>
    ) : null;

  const documentBody = (
    <div
      id={PROPOSAL_PDF_ROOT_ID}
      className={cn(
        "proposal-formal mx-auto space-y-0 px-6 py-8 md:px-10 md:py-10",
        showSectionNav ? "max-w-[820px]" : "max-w-4xl",
      )}
    >
      {!showSectionNav ? metaLine : null}

      <section
        id="intro"
        className="pf-section proposal-pdf-page scroll-mt-6"
      >
        <div className="pf-hero relative">
          <div className="pf-hero-grid" aria-hidden />
          <div className="relative px-6 py-10 md:px-10 md:py-12">
            <div className="pf-hero-tag">
              <span className="size-1.5 rounded-full bg-[#f59e0b]" aria-hidden />
              {copy.serviceProposal}
            </div>
            <EditableBlock
              as="h1"
              editable={editable}
              value={mergedContent.hero_title ?? resolvedProposal.title}
              onChange={(hero_title) => patch({ hero_title })}
              className="text-white"
              placeholder="Proposal title"
            />
            <EditableBlock
              editable={editable}
              value={
                mergedContent.hero_subtitle ??
                `Prepared for ${variables.empresa ?? "your company"} by Latinos Business Support`
              }
              onChange={(hero_subtitle) => patch({ hero_subtitle })}
              className="mt-2 max-w-xl text-sm text-white/85 md:text-base"
              placeholder="Subtitle"
            />
            <div className="mt-8 grid gap-4 text-xs uppercase tracking-wide text-white/70 sm:grid-cols-3">
              <div>
                <p className="pf-mono text-[10px]">{copy.date}</p>
                <p className="mt-1 font-semibold normal-case text-white">
                  {formatDisplayDate(new Date().toISOString().slice(0, 10), locale)}
                </p>
              </div>
              <div>
                <p className="pf-mono text-[10px]">{copy.preparedBy}</p>
                <p className="mt-1 font-semibold normal-case text-white">
                  {variables.preparada_por}
                </p>
              </div>
              <div>
                <p className="pf-mono text-[10px]">{copy.validFor}</p>
                <p className="mt-1 font-semibold normal-case text-white">
                  {resolvedProposal.validity_days ?? 30} {copy.days}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <ProposalIntroSection
            variant="formal"
            embedded
            eyebrow={copy.sections.intro}
            title={mergedContent.intro_title ?? ""}
            body={mergedContent.intro_body ?? ""}
            signatory={
              mergedContent.intro_signatory_name?.trim() ||
              variables.preparada_por
            }
            signatoryCompany={
              mergedContent.intro_signatory_company?.trim() ||
              "Latinos Business Support"
            }
            signatoryImageUrl={mergedContent.intro_signatory_image_url}
            signatoryNamePlaceholder={copy.introSignatoryNamePlaceholder}
            signatoryCompanyPlaceholder={copy.introSignatoryCompanyPlaceholder}
            signatoryHint={editable ? copy.introSignatoryHint : undefined}
            orgId={proposalOrgId}
            proposalId={proposalNumericId}
            editable={editable}
            onTitleChange={(intro_title) => patch({ intro_title })}
            onBodyChange={(intro_body) => patch({ intro_body })}
            onSignatoryNameChange={(intro_signatory_name) =>
              patch({ intro_signatory_name })
            }
            onSignatoryCompanyChange={(intro_signatory_company) =>
              patch({ intro_signatory_company })
            }
            onSignatoryImageChange={(intro_signatory_image_url) =>
              patch({ intro_signatory_image_url })
            }
            titlePlaceholder={copy.introTitlePlaceholder}
            bodyPlaceholder={copy.introBodyPlaceholder}
            editHint={editable ? copy.introEditHint : undefined}
          />
        </div>
      </section>

      {deckSections.narrative.map((section) => (
        <ProposalFormalSection
          key={section.id}
          section={section}
          content={mergedContent}
          copy={copy}
          editable={editable}
          orgId={proposalOrgId}
          proposalId={proposalNumericId}
          preparadaPor={variables.preparada_por}
          onPatchSection={patchCustomSection}
          onPatchContent={patch}
          onRemove={onRemoveCustomSection}
        />
      ))}

      {deckSections.timeline ? (
        <ProposalFormalSection
          section={deckSections.timeline}
          content={mergedContent}
          copy={copy}
          editable={editable}
          orgId={proposalOrgId}
          proposalId={proposalNumericId}
          onPatchSection={patchCustomSection}
          onPatchContent={patch}
          onRemove={onRemoveCustomSection}
        />
      ) : null}

      <section
        id="investment"
        className="pf-section proposal-pdf-page scroll-mt-6 space-y-4"
      >
            <div>
              <div className="pf-kicker">{copy.sections.investment}</div>
              <EditableBlock
                as="h2"
                editable={editable}
                value={
                  mergedContent.investment_title ?? copy.investmentDefaultTitle
                }
                onChange={(investment_title) => patch({ investment_title })}
                placeholder="Section title"
              />
              <EditableBlock
                editable={editable}
                value={mergedContent.investment_notes ?? ""}
                onChange={(investment_notes) => patch({ investment_notes })}
                placeholder="Optional notes above the investment summary…"
                className="mt-2 text-sm text-muted-foreground"
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold tracking-tight">
                {copy.sections.packageLines}
              </h3>
              <p className="text-sm text-muted-foreground">{copy.includesSubtitle}</p>
            </div>

            <div className="pf-invest">
            {resolvedBasePackageLine ? (
              <Card className="rounded-none border-0 shadow-none">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Monitor className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {resolvedBasePackageLine.description}
                      </p>
                      <Badge variant="secondary" className="text-[10px]">
                        {copy.basePackage}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">
                      {formatProposalMoney(
                        lineItemTotal(resolvedBasePackageLine),
                        resolvedCurrency,
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{copy.oneTime}</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardContent className="divide-y p-0">
                {resolvedLineDrafts
                  .filter((line) => !isPackageLine(line))
                  .map((line) => (
                    <LineItemRow
                      key={line.key}
                      line={line}
                      currency={resolvedCurrency}
                    />
                  ))}
                {resolvedLineDrafts.filter((line) => !isPackageLine(line)).length ===
                0 ? (
                  <p className="p-4 text-sm text-muted-foreground">{copy.noAddons}</p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-none border-0 border-t shadow-none">
              <CardContent className="space-y-0 p-0">
                <div className="flex justify-between gap-4 border-b px-4 py-3 text-sm">
                  <span>{copy.oneTimePayment}</span>
                  <span className="font-semibold tabular-nums">
                    {formatProposalMoney(resolvedOneTimeTotal, resolvedCurrency)}
                  </span>
                </div>
                {displayRecurringSubtotal > 0 ? (
                  <div className="flex justify-between gap-4 border-b px-4 py-3 text-sm">
                    <span className="text-[#1E5FA8]">{copy.recurringServices}</span>
                    <span className="font-semibold tabular-nums text-[#1E5FA8]">
                      {formatProposalMoney(displayRecurringSubtotal, resolvedCurrency)}
                      /mo
                    </span>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="pf-inv-grand">
              <span className="font-semibold">{copy.totalInvestment}</span>
              <span className="text-xl font-bold tabular-nums">
                {formatProposalMoney(resolvedOneTimeTotal, resolvedCurrency)}
                {displayRecurringSubtotal > 0
                  ? ` + ${formatProposalMoney(displayRecurringSubtotal, resolvedCurrency)}/mo`
                  : ""}
              </span>
            </div>
            </div>

            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <PaymentCardIcon className="size-4 text-primary" />
                  {copy.paymentsTitle}
                </div>
                {resolvedDepositInstallment ? (
                  <PaymentRow
                    badge={copy.depositBadge}
                    label={copy.depositLabel}
                    sub={copy.depositSub}
                    amount={resolvedDepositInstallment.amount}
                    currency={resolvedCurrency}
                  />
                ) : null}
                {resolvedBalanceInstallments.length > 0 ? (
                  <PaymentRow
                    badge={`${resolvedBalanceInstallments.length}x`}
                    label={copy.installmentsLabel(
                      resolvedBalanceInstallments.length,
                    )}
                    sub={copy.installmentsSub}
                    amount={resolvedPerBalancePayment}
                    currency={resolvedCurrency}
                  />
                ) : null}
                {displayRecurringSubtotal > 0 ? (
                  <PaymentRow
                    badge={<RefreshCw className="size-3" />}
                    label={copy.recurringLabel}
                    sub={copy.recurringSub}
                    amount={displayRecurringSubtotal}
                    currency={resolvedCurrency}
                    suffix="/mo"
                  />
                ) : null}
                {!stripeSkipped ? (
                  <p className="text-xs text-muted-foreground">
                    {copy.stripeNote}
                  </p>
                ) : null}
                <EditableBlock
                  editable={editable}
                  value={mergedContent.payment_notes ?? ""}
                  onChange={(payment_notes) => patch({ payment_notes })}
                  placeholder="Notes about payments (optional)…"
                  className="text-xs text-muted-foreground"
                />
              </CardContent>
            </Card>

            {mergedContent.warranty_body?.trim() ? (
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="flex gap-3 p-4">
                  <Shield className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="min-w-0 space-y-2">
                    <EditableBlock
                      as="h3"
                      editable={editable}
                      value={mergedContent.warranty_title ?? copy.sections.warranty}
                      onChange={(warranty_title) => patch({ warranty_title })}
                      placeholder="Warranty title"
                      className="font-semibold"
                    />
                    <EditableBlock
                      editable={editable}
                      value={mergedContent.warranty_body ?? ""}
                      onChange={(warranty_body) => patch({ warranty_body })}
                      placeholder="Warranty details…"
                      className="text-sm text-muted-foreground"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </section>

          {resolvedAcceptMode !== "off" ? (
            <section
              id="accept"
              className="pf-section proposal-pdf-page scroll-mt-6 space-y-3 pb-12"
            >
              <div className="pf-kicker">{copy.sections.accept}</div>
              <ProposalDocumentAcceptSection
                locale={locale}
                mode={
                  resolvedAcceptMode === "live"
                    ? "live"
                    : "preview"
                }
                proposalId={Number(resolvedProposal.id)}
                depositAmount={resolvedProposal.deposit_amount ?? 0}
                currency={resolvedCurrency}
                acceptedAt={resolvedProposal.accepted_at}
                contract={contractForAccept}
                termsMarkdown={termsMarkdown}
                termsTitle={dataSource?.termsTitle ?? contractTerms?.title ?? null}
                publicToken={publicToken}
                onRefresh={onPublicRefresh}
                editable={resolvedAcceptMode === "editor"}
                acceptTitle={mergedContent.accept_title}
                acceptBody={mergedContent.accept_body}
                onAcceptTitleChange={(accept_title) => patch({ accept_title })}
                onAcceptBodyChange={(accept_body) => patch({ accept_body })}
              />
            </section>
          ) : null}
    </div>
  );

  if (!showSectionNav) {
    if (pageScroll) {
      return documentBody;
    }
    return (
      <div
        ref={scrollContainerRef}
        className="h-full min-h-0 overflow-y-auto overscroll-contain"
      >
        {documentBody}
      </div>
    );
  }

  return (
    <div className="proposal-formal-shell flex h-full min-h-0 w-full overflow-hidden">
      <div className="hidden h-full shrink-0 md:block">
        <ProposalDocumentSidebar
          proposal={resolvedProposal}
          sections={navSections}
          activeId={activeId}
          onSectionClick={scrollTo}
          downloadPdfLabel={copy.downloadPdf}
          onDownloadPdf={onDownloadPdf}
          isExportingPdf={isExportingPdf}
          languageToggle={sidebarLanguageToggle}
          onAddSection={editable ? onAddSection : undefined}
          addSectionLabel={copy.addSection}
        />
      </div>
      <div
        ref={scrollContainerRef}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {documentBody}
      </div>
    </div>
  );
};

const LineItemRow = ({
  line,
  currency,
}: {
  line: { key: string; description: string; quantity?: number; unit_price?: number; billing_type?: string; billing_interval?: string | null };
  currency: string;
}) => (
  <div className="flex items-start gap-3 px-4 py-3">
    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">{line.description}</p>
      {line.billing_type === "recurring" ? (
        <p className="text-xs text-muted-foreground capitalize">
          {line.billing_interval ?? "monthly"}
        </p>
      ) : null}
    </div>
    <p className="shrink-0 text-sm font-semibold tabular-nums">
      {formatProposalMoney(lineItemTotal(line as ProposalLineItem), currency)}
      {line.billing_type === "recurring" ? (
        <span className="text-xs font-normal text-muted-foreground">/mo</span>
      ) : null}
    </p>
  </div>
);

const PaymentRow = ({
  badge,
  label,
  sub,
  amount,
  currency,
  suffix,
}: {
  badge: ReactNode;
  label: string;
  sub: string;
  amount: number;
  currency: string;
  suffix?: string;
}) => (
  <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
    <Badge variant="secondary" className="shrink-0 tabular-nums">
      {badge}
    </Badge>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
    <p className="shrink-0 font-bold tabular-nums">
      {formatProposalMoney(amount, currency)}
      {suffix ? (
        <span className="text-xs font-normal text-muted-foreground">{suffix}</span>
      ) : null}
    </p>
  </div>
);
