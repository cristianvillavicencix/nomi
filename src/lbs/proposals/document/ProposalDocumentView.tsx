import { Check, CreditCard, Monitor, RefreshCw, Shield, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/atomic-crm/misc/Markdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isClientBillingSkipped } from "@/lbs/billing/clientBillingProvider";
import { isPackageLine } from "@/lbs/proposals/proposalCatalogUtils";
import { EditableBlock } from "@/lbs/proposals/document/EditableBlock";
import { ProposalDocumentAcceptSection } from "@/lbs/proposals/document/ProposalDocumentAcceptSection";
import { buildProposalDocumentSections } from "@/lbs/proposals/document/proposalDocumentSections";
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
  mergeProposalVariables,
} from "@/lbs/proposals/document/proposalVariableMerge";
import type { ProposalLineItem } from "@/lbs/types";

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

const SectionEyebrow = ({ children }: { children: string }) => (
  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
    {children}
  </p>
);

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
    });
  }, [resolvedProposal, company, contact, deal, member]);

  const mergedContent = useMemo(() => {
    const merged = mergeProposalVariables(
      localizedContent as Record<string, string | undefined>,
      variables,
    );
    return { ...localizedContent, ...merged } as ProposalDocumentContent;
  }, [localizedContent, variables]);

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
    partial: { title?: string; body?: string },
  ) => {
    const next = (content.custom_sections ?? []).map((section) =>
      section.id === customSectionId ? { ...section, ...partial } : section,
    );
    patch({ custom_sections: next });
  };

  const termsMarkdown =
    mergedContent.terms_body?.trim() ||
    contractTerms?.body_markdown?.slice(0, 4000) ||
    "";

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
      className={cn(
        "mx-auto space-y-10 px-4 py-6 md:px-8 md:py-8",
        showSectionNav ? "max-w-3xl" : "max-w-4xl",
      )}
    >
      {!showSectionNav ? metaLine : null}
      {/* Hero */}
          <section className="rounded-xl bg-primary px-6 py-8 text-primary-foreground shadow-sm md:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-widest opacity-80">
              {copy.serviceProposal}
            </p>
            <EditableBlock
              as="h2"
              editable={editable}
              value={mergedContent.hero_title ?? resolvedProposal.title}
              onChange={(hero_title) => patch({ hero_title })}
              className="mt-2 text-primary-foreground"
              placeholder="Proposal title"
            />
            <EditableBlock
              editable={editable}
              value={
                mergedContent.hero_subtitle ??
                `Prepared for ${variables.empresa ?? "your company"} by Latinos Business Support`
              }
              onChange={(hero_subtitle) => patch({ hero_subtitle })}
              className="mt-2 text-primary-foreground/90"
              placeholder="Subtitle"
            />
            <div className="mt-6 grid gap-3 text-xs uppercase tracking-wide opacity-90 sm:grid-cols-3">
              <div>
                <p className="opacity-70">{copy.date}</p>
                <p className="mt-0.5 font-medium normal-case">
                  {formatDisplayDate(new Date().toISOString().slice(0, 10))}
                </p>
              </div>
              <div>
                <p className="opacity-70">{copy.preparedBy}</p>
                <p className="mt-0.5 font-medium normal-case">
                  {variables.preparada_por}
                </p>
              </div>
              <div>
                <p className="opacity-70">{copy.validFor}</p>
                <p className="mt-0.5 font-medium normal-case">
                  {resolvedProposal.validity_days ?? 30} {copy.days}
                </p>
              </div>
            </div>
          </section>

          {/* Intro */}
          <section id="intro" className="scroll-mt-6 space-y-3">
            <SectionEyebrow>{copy.sections.intro}</SectionEyebrow>
            <EditableBlock
              as="h2"
              editable={editable}
              value={mergedContent.intro_title ?? ""}
              onChange={(intro_title) => patch({ intro_title })}
              placeholder="Section title"
            />
            <EditableBlock
              editable={editable}
              value={mergedContent.intro_body ?? ""}
              onChange={(intro_body) => patch({ intro_body })}
              placeholder="Click to write the introduction…"
            />
          </section>

          {/* Includes */}
          <section id="includes" className="scroll-mt-6 space-y-4">
            <div>
              <SectionEyebrow>{copy.sections.includes}</SectionEyebrow>
              <h2 className="text-2xl font-semibold tracking-tight">
                {copy.includesTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {copy.includesSubtitle}
              </p>
            </div>

            {resolvedBasePackageLine ? (
              <Card>
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
          </section>

          {/* Investment */}
          <section id="investment" className="scroll-mt-6 space-y-4">
            <div>
              <SectionEyebrow>{copy.sections.investment}</SectionEyebrow>
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

            <Card>
              <CardContent className="space-y-0 p-0">
                <div className="flex justify-between gap-4 border-b px-4 py-3 text-sm">
                  <span>{copy.oneTimePayment}</span>
                  <span className="font-semibold tabular-nums">
                    {formatProposalMoney(resolvedOneTimeTotal, resolvedCurrency)}
                  </span>
                </div>
                {displayRecurringSubtotal > 0 ? (
                  <div className="flex justify-between gap-4 border-b px-4 py-3 text-sm">
                    <span className="text-primary">{copy.recurringServices}</span>
                    <span className="font-semibold tabular-nums text-primary">
                      {formatProposalMoney(displayRecurringSubtotal, resolvedCurrency)}
                      /mo
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 bg-primary px-4 py-3 text-sm text-primary-foreground">
                  <span className="font-medium">{copy.totalInvestment}</span>
                  <span className="font-bold tabular-nums">
                    {formatProposalMoney(resolvedOneTimeTotal, resolvedCurrency)}
                    {displayRecurringSubtotal > 0
                      ? ` + ${formatProposalMoney(displayRecurringSubtotal, resolvedCurrency)}/mo`
                      : ""}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="size-4 text-primary" />
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
          </section>

          {/* Warranty */}
          <section id="warranty" className="scroll-mt-6 space-y-3">
            <SectionEyebrow>{copy.sections.warranty}</SectionEyebrow>
            <EditableBlock
              as="h2"
              editable={editable}
              value={mergedContent.warranty_title ?? ""}
              onChange={(warranty_title) => patch({ warranty_title })}
              placeholder="Warranty title"
            />
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="flex gap-3 p-4">
                <Shield className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <EditableBlock
                  editable={editable}
                  value={mergedContent.warranty_body ?? ""}
                  onChange={(warranty_body) => patch({ warranty_body })}
                  placeholder="Warranty details…"
                />
              </CardContent>
            </Card>
          </section>

          {(content.custom_sections ?? []).map((section) => (
            <section
              key={section.id}
              id={`custom-${section.id}`}
              className="scroll-mt-6 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <SectionEyebrow>{copy.sections.custom}</SectionEyebrow>
                {editable && onRemoveCustomSection ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveCustomSection(section.id)}
                    aria-label="Remove section"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              <EditableBlock
                as="h2"
                editable={editable}
                value={section.title}
                onChange={(title) => patchCustomSection(section.id, { title })}
                placeholder="Section title"
              />
              <EditableBlock
                editable={editable}
                value={section.body}
                onChange={(body) => patchCustomSection(section.id, { body })}
                placeholder="Section content…"
              />
            </section>
          ))}

          {/* Terms */}
          <section id="terms" className="scroll-mt-6 space-y-3">
            <SectionEyebrow>{copy.sections.terms}</SectionEyebrow>
            <EditableBlock
              as="h2"
              editable={editable}
              value={mergedContent.terms_title ?? copy.termsDefaultTitle}
              onChange={(terms_title) => patch({ terms_title })}
              placeholder="Section title"
            />
            {editable ? (
              <>
                <EditableBlock
                  editable
                  value={mergedContent.terms_body ?? ""}
                  onChange={(terms_body) => patch({ terms_body })}
                  placeholder="Leave empty to use Settings → Commercial contract terms…"
                />
                <p className="text-xs text-muted-foreground">
                  Markdown supported. Empty uses your organization&apos;s active contract
                  terms.
                </p>
              </>
            ) : null}
            <Card>
              <CardContent className="prose prose-sm dark:prose-invert max-w-none p-4">
                {termsMarkdown ? (
                  <Markdown>{termsMarkdown}</Markdown>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {copy.termsEmpty}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          {resolvedAcceptMode !== "off" ? (
            <section id="accept" className="scroll-mt-6 space-y-3 pb-12">
              <SectionEyebrow>{copy.sections.accept}</SectionEyebrow>
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
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="hidden h-full shrink-0 md:block">
        <ProposalDocumentSidebar
          proposal={resolvedProposal}
          sections={navSections}
          activeId={activeId}
          onSectionClick={scrollTo}
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
