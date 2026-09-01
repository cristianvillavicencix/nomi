import { useMutation } from "@tanstack/react-query";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useGetMany,
  useNotify,
  useRefresh,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  BillToClientSearch,
  type BillToSelection,
} from "@/modules/billing/BillToClientSearch";
import { billToSelectionFromClient } from "@/modules/billing/billingUtils";
import {
  resolveBillingRecipientEmail,
  resolveBillingRecipientPhone,
} from "@/modules/billing/billingRecipientResolution";
import type { InvoiceLineDraft } from "@/modules/billing/invoiceLineUtils";
import { SubscriptionCreateReviewPanel } from "@/modules/billing/subscriptions/SubscriptionCreateReviewPanel";
import { SubscriptionLineItemsEditor } from "@/modules/billing/subscriptions/SubscriptionLineItemsEditor";
import {
  subscriptionLinesFromRecord,
  subscriptionLinesToPayload,
  subscriptionNameFromLines,
  sumSubscriptionLinesAmount,
} from "@/modules/billing/subscriptions/subscriptionLineUtils";
import {
  SavedCardSelect,
  resolveSavedCardPaymentMethodId,
  savedCardOptionValue,
} from "@/modules/billing/subscriptions/SavedCardSelect";
import { useClientSavedPaymentMethod } from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import {
  SubscriptionStaffCardForm,
  type SubscriptionStaffCardFormHandle,
} from "@/modules/billing/subscriptions/SubscriptionStaffCardForm";
import { resolvePublicAppBaseUrl, resolveSubscriptionSetupShareUrl } from "@/lib/publicAppUrl";
import { buildDefaultSubscriptionSetupMessage, formatSubscriptionAmountLabel } from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import {
  computeSubscriptionEndsAt,
  inferSubscriptionPaymentMode,
  parseIsoDateAtStartOfDay,
  resolveDurationFromSubscription,
  SUBSCRIPTION_DURATION_OPTIONS,
  todayIsoDate,
  type SubscriptionDurationValue,
  type SubscriptionEnrollmentMode,
  type SubscriptionPaymentMode,
} from "@/modules/billing/subscriptions/subscriptionScheduleUtils";
import { BILLING_INTERVALS } from "@/modules/proposals/proposalCommercialConstants";
import type { ClientSubscription, LbsDeal } from "@/modules/types";
import {
  FloatingFieldShell,
  floatingFieldControlClassName,
} from "@/components/ui/floating-field";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContractDocumentMarkdown } from "@/modules/billing/subscriptions/ContractDocumentMarkdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Eye, FileText } from "lucide-react";
import { SubscriptionAgreementClientView } from "@/modules/billing/subscriptions/SubscriptionAgreementClientView";
import { SignedSubscriptionAgreementDialog } from "@/modules/billing/subscriptions/SignedSubscriptionAgreementDialog";
import {
  buildSubscriptionContractVariables,
  fillAgreementTermsMarkdown,
  mergeSubscriptionContractTerms,
  resolveDefaultContractTermsIdFromPackages,
} from "@/modules/billing/subscriptions/subscriptionAgreementMerge";
import { resolveFilledAgreementTermsMarkdown } from "@/modules/billing/subscriptions/resolveFilledAgreementTermsMarkdown";
import type {
  OrganizationContractTerms,
  ServicePackage,
} from "@/modules/types";
import {
  CreateFormFieldRow,
  CreateFormSection,
} from "@/modules/shared/createForm/CreateFormLayout";

const floatingSelectTriggerClassName =
  "h-9 w-full border-0 bg-transparent px-3 shadow-none hover:bg-transparent focus:ring-0 data-[size=default]:h-9";

const FloatingSelectField = ({
  id,
  label,
  value,
  onValueChange,
  disabled,
  children,
  activeWhenEmpty = false,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
  activeWhenEmpty?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const active = open || activeWhenEmpty || Boolean(value && value !== "none");
  return (
    <FloatingFieldShell active={active} label={label} htmlFor={id}>
      <Select
        value={value}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
        onValueChange={onValueChange}
      >
        <SelectTrigger id={id} className={floatingSelectTriggerClassName}>
          <SelectValue placeholder=" " />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </FloatingFieldShell>
  );
};
export type SubscriptionFormEditorHandle = {
  submit: () => void;
  canSubmit: boolean;
  isPending: boolean;
};

type SubscriptionFormEditorProps = {
  mode: "create" | "edit";
  subscription?: ClientSubscription | null;
  readOnly?: boolean;
  hideReviewActions?: boolean;
  /** When "parent", the embedded workspace shell owns vertical scroll. */
  scrollContainer?: "self" | "parent";
  /** Pre-select payment option when opening Edit from the toolbar. */
  initialPaymentMode?: SubscriptionPaymentMode | null;
  onSaved?: (result?: {
    setup_link_stale?: boolean;
    used_saved_card?: boolean;
    used_staff_card?: boolean;
  }) => void;
  onCancel?: () => void;
  onStateChange?: (state: { canSubmit: boolean; isPending: boolean }) => void;
};

export const SubscriptionFormEditor = forwardRef<
  SubscriptionFormEditorHandle,
  SubscriptionFormEditorProps
>(function SubscriptionFormEditor(
  {
    mode,
    subscription,
    readOnly = false,
    hideReviewActions = false,
    scrollContainer = "self",
    onSaved,
    onCancel,
    onStateChange,
    initialPaymentMode = null,
  },
  ref,
) {
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();
  const { title: orgTitle } = useConfigurationContext();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const staffCardRef = useRef<SubscriptionStaffCardFormHandle>(null);

  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: subscription?.company_id ? [subscription.company_id] : [] },
    { enabled: mode === "edit" && Boolean(subscription?.company_id) },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: subscription?.contact_id ? [subscription.contact_id] : [] },
    { enabled: mode === "edit" && Boolean(subscription?.contact_id) },
  );
  const company = companies[0];
  const contact = contacts[0];

  const [billTo, setBillTo] = useState<BillToSelection | null>(null);
  const [lines, setLines] = useState<InvoiceLineDraft[]>([]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [dealId, setDealId] = useState<string>("");
  const [billingInterval, setBillingInterval] = useState<
    "weekly" | "monthly" | "yearly"
  >("monthly");
  const [startsAt, setStartsAt] = useState(todayIsoDate());
  const [duration, setDuration] =
    useState<SubscriptionDurationValue>("ongoing");
  const [customEndDate, setCustomEndDate] = useState("");
  const [referenceFocused, setReferenceFocused] = useState(false);
  const [startsFocused, setStartsFocused] = useState(false);
  const [endsFocused, setEndsFocused] = useState(false);
  const [messageFocused, setMessageFocused] = useState(false);
  const [paymentMode, setPaymentMode] =
    useState<SubscriptionPaymentMode>("request_setup");
  const [enrollmentMode, setEnrollmentMode] =
    useState<SubscriptionEnrollmentMode>("direct");
  const [agreementTermsMarkdown, setAgreementTermsMarkdown] = useState("");
  const [agreementTermsEdited, setAgreementTermsEdited] = useState(false);
  const [selectedContractTermsId, setSelectedContractTermsId] = useState<
    number | null
  >(null);
  const [contractPickedManually, setContractPickedManually] = useState(false);
  const [termsEditMode, setTermsEditMode] = useState(false);
  const [changeContractOpen, setChangeContractOpen] = useState(false);
  const [agreementPreviewOpen, setAgreementPreviewOpen] = useState(false);
  const [signedAgreementOpen, setSignedAgreementOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendSms, setSendSms] = useState(false);
  const [message, setMessage] = useState("");
  const [messageEdited, setMessageEdited] = useState(false);
  const [selectedSavedCardValue, setSelectedSavedCardValue] = useState<
    string | null
  >(null);
  const [hydrated, setHydrated] = useState(mode === "create");
  /** After request_setup create: stay open until client card is saved, then activate. */
  const [waitingForCard, setWaitingForCard] = useState(false);
  const [pendingSubscriptionId, setPendingSubscriptionId] = useState<
    number | null
  >(null);
  const cardArrivedNotifiedRef = useRef(false);
  const prevSavedCardCountRef = useRef(0);

  const isCanceled = subscription?.status === "canceled";
  const isPendingSetup =
    subscription?.status === "pending_setup" ||
    (mode === "create" && waitingForCard);
  const isActiveLike =
    subscription?.status === "active" ||
    subscription?.status === "paused" ||
    subscription?.status === "past_due" ||
    subscription?.status === "trialing";
  const paymentSectionLocked =
    readOnly ||
    isCanceled ||
    (isActiveLike && Boolean(subscription?.stripe_subscription_id));
  const formDisabled = readOnly || isCanceled;
  const fieldsLocked = formDisabled || waitingForCard;

  const {
    savedCard,
    allSavedCards,
    isPending: savedCardPending,
    refetch: refetchSavedCards,
  } = useClientSavedPaymentMethod(billTo);

  const clientCardReady = waitingForCard && allSavedCards.length > 0;

  const selectedSavedCard = useMemo(
    () =>
      allSavedCards.find(
        (card) => savedCardOptionValue(card) === selectedSavedCardValue,
      ) ??
      savedCard ??
      null,
    [allSavedCards, selectedSavedCardValue, savedCard],
  );

  const cardOnFile = selectedSavedCard
    ? { brand: selectedSavedCard.brand, last4: selectedSavedCard.last4 }
    : subscription?.payment_method_last4
      ? {
          brand: subscription.payment_method_brand,
          last4: subscription.payment_method_last4,
        }
      : null;

  const recipientEmail = useMemo(
    () =>
      resolveBillingRecipientEmail({
        company: billTo?.company,
        contact: billTo?.contact,
      }),
    [billTo],
  );

  const recipientPhone = useMemo(
    () =>
      resolveBillingRecipientPhone({
        company: billTo?.company,
        contact: billTo?.contact,
      }),
    [billTo],
  );

  const { data: contractTemplates = [] } =
    useGetList<OrganizationContractTerms>(
      "organization_contract_terms",
      {
        pagination: { page: 1, perPage: 100 },
        sort: { field: "title", order: "ASC" },
        filter: { "is_active@eq": true },
      },
      { enabled: mode === "create" && enrollmentMode === "agreement" },
    );

  const packageIdsOnLines = useMemo(
    () =>
      [
        ...new Set(
          lines
            .map((line) =>
              line.package_id != null ? Number(line.package_id) : null,
            )
            .filter((id): id is number => id != null && Number.isFinite(id)),
        ),
      ],
    [lines],
  );

  const { data: packagesForLines = [] } = useGetMany<ServicePackage>(
    "service_packages",
    { ids: packageIdsOnLines },
    {
      enabled:
        mode === "create" &&
        enrollmentMode === "agreement" &&
        packageIdsOnLines.length > 0,
    },
  );

  const selectedTemplate = useMemo(
    () =>
      contractTemplates.find(
        (row) => Number(row.id) === Number(selectedContractTermsId),
      ) ?? null,
    [contractTemplates, selectedContractTermsId],
  );

  const clientCompanyName = useMemo(
    () => billTo?.company?.name?.trim() || "",
    [billTo],
  );

  const clientRepresentativeName = useMemo(() => {
    const contact = billTo?.contact;
    if (!contact) return "";
    return [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
  }, [billTo]);

  /** Legal client = company when available; otherwise the contact. */
  const clientDisplayName = useMemo(
    () => clientCompanyName || clientRepresentativeName || "Client",
    [clientCompanyName, clientRepresentativeName],
  );

  const clientAddress = useMemo(() => {
    const company = billTo?.company as
      | (Company & {
          address?: string | null;
          city?: string | null;
          state_abbr?: string | null;
          zipcode?: string | null;
        })
      | undefined;
    if (!company) return "—";
    const parts = [
      company.address,
      company.city,
      company.state_abbr,
      company.zipcode,
    ]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean);
    return parts.join(", ") || "—";
  }, [billTo]);

  useEffect(() => {
    if (enrollmentMode !== "agreement") return;
    if (contractPickedManually) return;
    const packagesById = new Map(
      packagesForLines.map((pkg) => [
        Number(pkg.id),
        {
          default_contract_terms_id:
            pkg.default_contract_terms_id != null
              ? Number(pkg.default_contract_terms_id)
              : null,
        },
      ]),
    );
    const orgDefault = contractTemplates.find((row) => row.is_default);
    const resolved = resolveDefaultContractTermsIdFromPackages({
      lineItems: lines.map((line) => ({
        package_id: line.package_id != null ? Number(line.package_id) : null,
      })),
      packagesById,
      orgDefaultTermsId: orgDefault ? Number(orgDefault.id) : null,
      activeTermsIds: contractTemplates.map((row) => Number(row.id)),
    });
    setSelectedContractTermsId(resolved);
  }, [
    enrollmentMode,
    contractPickedManually,
    lines,
    packagesForLines,
    contractTemplates,
  ]);

  useEffect(() => {
    if (enrollmentMode !== "agreement") return;
    if (agreementTermsEdited || termsEditMode) return;
    if (!selectedTemplate?.body_markdown?.trim()) {
      setAgreementTermsMarkdown("");
      return;
    }
    const vars = buildSubscriptionContractVariables({
      clientName: clientDisplayName,
      clientAddress,
      clientRepresentative: clientRepresentativeName,
      providerRepresentative: identity?.fullName?.trim() || null,
      subscriptionDescription: null,
      subscriptionName: subscriptionNameFromLines(lines) || "Subscription",
      subscriptionNumber: null,
      amount: sumSubscriptionLinesAmount(lines),
      currency: "USD",
      billingInterval,
      lineItems: subscriptionLinesToPayload(lines),
      termsVersion: selectedTemplate.version || "1.0",
      defaultVariables: selectedTemplate.default_variables ?? null,
    });
    setAgreementTermsMarkdown(
      mergeSubscriptionContractTerms(selectedTemplate.body_markdown, vars),
    );
  }, [
    enrollmentMode,
    agreementTermsEdited,
    termsEditMode,
    selectedTemplate,
    clientDisplayName,
    clientRepresentativeName,
    clientAddress,
    identity?.fullName,
    lines,
    billingInterval,
  ]);

  useEffect(() => {
    if (paymentMode !== "request_setup") return;
    if (sendEmail || sendSms) return;
    if (recipientEmail && recipientPhone) {
      setSendEmail(true);
      setSendSms(true);
    } else if (recipientEmail) {
      setSendEmail(true);
    } else if (recipientPhone) {
      setSendSms(true);
    }
  }, [paymentMode, recipientEmail, recipientPhone, sendEmail, sendSms]);

  const subscriptionName = subscriptionNameFromLines(lines);
  const amount = sumSubscriptionLinesAmount(lines);
  const lineItemsPayload = subscriptionLinesToPayload(lines);
  const previewShareUrl = resolveSubscriptionSetupShareUrl({
    setup_share_url: subscription?.setup_share_url,
    setup_short_code: subscription?.setup_short_code,
    enrollment_mode: subscription?.enrollment_mode ?? enrollmentMode,
  });

  const defaultMessage = useMemo(
    () =>
      buildDefaultSubscriptionSetupMessage({
        orgLabel: orgTitle ?? "Latino Business Support",
        subscriptionName,
        subscriptionNumber: (subscription?.subscription_number ?? referenceNumber) || null,
        amountLabel: formatSubscriptionAmountLabel(
          amount,
          subscription?.currency ?? "USD",
          billingInterval,
        ),
        shareUrl: previewShareUrl,
      }),
    [
      orgTitle,
      subscriptionName,
      subscription?.subscription_number,
      referenceNumber,
      amount,
      subscription?.currency,
      billingInterval,
      previewShareUrl,
    ],
  );

  const deliveryMessage = messageEdited ? message.trim() || defaultMessage : defaultMessage;

  const endsAtIso = useMemo(() => {
    const startDate = new Date(`${startsAt}T00:00:00`);
    if (Number.isNaN(startDate.getTime())) return null;
    const end = computeSubscriptionEndsAt({
      startsAt: startDate,
      duration,
      customEndDate,
    });
    return end ? end.toISOString() : null;
  }, [startsAt, duration, customEndDate]);

  const endsAtDateForReview = useMemo(() => {
    if (duration === "ongoing") return null;
    if (duration === "custom") return customEndDate || null;
    const startDate = parseIsoDateAtStartOfDay(startsAt);
    if (!startDate) return null;
    const end = computeSubscriptionEndsAt({
      startsAt: startDate,
      duration,
      customEndDate,
    });
    return end ? end.toISOString().slice(0, 10) : null;
  }, [startsAt, duration, customEndDate]);

  useEffect(() => {
    if (mode !== "edit" || !subscription || hydrated) return;
    const schedule = resolveDurationFromSubscription(subscription);
    setLines(subscriptionLinesFromRecord(subscription));
    setBillingInterval(subscription.billing_interval);
    setStartsAt(subscription.starts_at?.slice(0, 10) ?? todayIsoDate());
    setDuration(schedule.duration);
    setCustomEndDate(schedule.customEndDate);
    setReferenceNumber(subscription.reference_number ?? "");
    setDealId(subscription.deal_id ? String(subscription.deal_id) : "");
    setPaymentMode(inferSubscriptionPaymentMode(subscription));
    if (initialPaymentMode && isPendingSetup) {
      setPaymentMode(initialPaymentMode);
    }
    setHydrated(true);
  }, [mode, subscription, hydrated, initialPaymentMode, isPendingSetup]);

  useEffect(() => {
    if (mode !== "edit" || !initialPaymentMode || !isPendingSetup || !hydrated) {
      return;
    }
    setPaymentMode(initialPaymentMode);
  }, [mode, initialPaymentMode, isPendingSetup, hydrated]);

  useEffect(() => {
    prevSavedCardCountRef.current = 0;
  }, [billTo?.contactId, billTo?.companyId]);

  useEffect(() => {
    if (formDisabled || savedCardPending || paymentSectionLocked) return;
    const count = allSavedCards.length;
    const prev = prevSavedCardCountRef.current;
    if (count > 0 && prev === 0) {
      // Cards just became available for this client → land on card on file.
      setPaymentMode((current) =>
        current === "staff_card" ? current : "saved_card",
      );
    } else if (count === 0) {
      setPaymentMode((current) =>
        current === "saved_card" ? "request_setup" : current,
      );
    }
    prevSavedCardCountRef.current = count;
  }, [
    formDisabled,
    allSavedCards.length,
    savedCardPending,
    paymentSectionLocked,
    billTo?.contactId,
    billTo?.companyId,
  ]);

  useEffect(() => {
    if (allSavedCards.length === 0) {
      setSelectedSavedCardValue(null);
      return;
    }
    setSelectedSavedCardValue((current) => {
      if (
        current &&
        allSavedCards.some((card) => savedCardOptionValue(card) === current)
      ) {
        return current;
      }
      return savedCardOptionValue(allSavedCards[0]);
    });
  }, [allSavedCards]);

  // While waiting for client card: poll saved cards and auto-select when one appears.
  useEffect(() => {
    if (!waitingForCard) return;
    const tick = () => {
      void refetchSavedCards();
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [waitingForCard, refetchSavedCards]);

  useEffect(() => {
    if (!waitingForCard) {
      cardArrivedNotifiedRef.current = false;
      return;
    }
    if (allSavedCards.length === 0) return;
    setPaymentMode("saved_card");
    setSelectedSavedCardValue(savedCardOptionValue(allSavedCards[0]));
    if (!cardArrivedNotifiedRef.current) {
      cardArrivedNotifiedRef.current = true;
      notify("Client card saved — review and activate the subscription", {
        type: "info",
      });
    }
  }, [waitingForCard, allSavedCards, notify]);

  const selectedSavedPaymentMethodId = useMemo(
    () =>
      resolveSavedCardPaymentMethodId(allSavedCards, selectedSavedCardValue),
    [allSavedCards, selectedSavedCardValue],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Activate a pending subscription created via request_setup wait flow.
      if (
        mode === "create" &&
        waitingForCard &&
        pendingSubscriptionId != null &&
        paymentMode === "saved_card"
      ) {
        const paymentMethodId = selectedSavedPaymentMethodId;
        if (!paymentMethodId) {
          throw new Error("Select a saved card to activate");
        }
        return dataProvider.manageClientSubscription({
          subscriptionId: pendingSubscriptionId,
          action: "apply_payment",
          payment_mode: "saved_card",
          payment_method_id: paymentMethodId,
          base_url: resolvePublicAppBaseUrl(),
        });
      }

      if (mode === "create") {
        if (enrollmentMode === "agreement") {
          if (!agreementTermsMarkdown.trim()) {
            throw new Error("Add terms before sending the agreement link");
          }
          const filledTerms = fillAgreementTermsMarkdown(
            agreementTermsMarkdown.trim(),
            buildSubscriptionContractVariables({
              clientName: clientDisplayName,
              clientAddress,
              clientRepresentative: clientRepresentativeName,
              providerRepresentative: identity?.fullName?.trim() || null,
              subscriptionDescription: null,
              subscriptionName: subscriptionName || "Subscription",
              subscriptionNumber: null,
              amount,
              currency: "USD",
              billingInterval,
              lineItems: lineItemsPayload,
              termsVersion: selectedTemplate?.version || "1.0",
              defaultVariables: selectedTemplate?.default_variables ?? null,
            }),
          );
          return dataProvider.createClientSubscription({
            company_id: billTo?.companyId ?? null,
            contact_id: billTo?.contactId ?? null,
            deal_id: dealId ? Number(dealId) : null,
            reference_number: referenceNumber.trim() || null,
            name: subscriptionName,
            amount,
            billing_interval: billingInterval,
            starts_at: startsAt ? `${startsAt}T00:00:00.000Z` : null,
            ends_at: endsAtIso,
            enrollment_mode: "agreement",
            agreement_contract_terms_id: selectedContractTermsId,
            agreement_terms_markdown: filledTerms,
            line_items: lineItemsPayload,
            send_email: sendEmail,
            send_sms: sendSms,
            email_to: recipientEmail || null,
            sms_to: recipientPhone || null,
            message: messageEdited ? message.trim() || null : null,
            base_url: resolvePublicAppBaseUrl(),
          });
        }

        let paymentMethodId: string | null = null;
        if (paymentMode === "staff_card") {
          paymentMethodId = (await staffCardRef.current?.confirmCard()) ?? null;
          if (!paymentMethodId) {
            throw new Error("Confirm the card before creating the subscription");
          }
        } else if (paymentMode === "saved_card") {
          paymentMethodId = selectedSavedPaymentMethodId;
          if (!paymentMethodId) {
            throw new Error("Select a saved card to charge");
          }
        }

        return dataProvider.createClientSubscription({
          company_id: billTo?.companyId ?? null,
          contact_id: billTo?.contactId ?? null,
          deal_id: dealId ? Number(dealId) : null,
          reference_number: referenceNumber.trim() || null,
          name: subscriptionName,
          amount,
          billing_interval: billingInterval,
          starts_at: startsAt ? `${startsAt}T00:00:00.000Z` : null,
          ends_at: endsAtIso,
          enrollment_mode: "direct",
          payment_mode: paymentMode,
          payment_method_id: paymentMethodId,
          line_items: lineItemsPayload,
          send_email: paymentMode === "request_setup" ? sendEmail : false,
          send_sms: paymentMode === "request_setup" ? sendSms : false,
          email_to: recipientEmail || null,
          sms_to: recipientPhone || null,
          message: messageEdited ? message.trim() || null : null,
          base_url: resolvePublicAppBaseUrl(),
        });
      }

      if (!subscription?.id) {
        throw new Error("Missing subscription");
      }

      let paymentMethodId: string | null = null;
      if (paymentMode === "staff_card" && isPendingSetup) {
        paymentMethodId = (await staffCardRef.current?.confirmCard()) ?? null;
        if (!paymentMethodId) {
          throw new Error("Confirm the card before saving");
        }
      }

      const updateResult = await dataProvider.manageClientSubscription({
        subscriptionId: subscription.id,
        action: "update",
        name: subscriptionName,
        amount,
        billing_interval: billingInterval,
        ends_at: endsAtIso,
        reference_number: referenceNumber.trim() || null,
        deal_id: dealId ? Number(dealId) : null,
        line_items: lineItemsPayload,
      });

      if (isPendingSetup && !subscription.stripe_subscription_id) {
        const paymentResult = await dataProvider.manageClientSubscription({
          subscriptionId: subscription.id,
          action: "apply_payment",
          payment_mode: paymentMode,
          payment_method_id:
            paymentMode === "saved_card"
              ? selectedSavedPaymentMethodId
              : paymentMethodId,
          send_email: paymentMode === "request_setup" ? sendEmail : false,
          send_sms: paymentMode === "request_setup" ? sendSms : false,
          email_to: recipientEmail || null,
          sms_to: recipientPhone || null,
          message: messageEdited ? message.trim() || null : null,
          base_url: resolvePublicAppBaseUrl(),
        });
        return {
          ...updateResult,
          ...paymentResult,
        };
      }

      return updateResult;
    },
    onSuccess: (result: Record<string, unknown>) => {
      refresh();

      const createdSub = result.subscription as
        | { id?: number; status?: string }
        | undefined;
      const createdId =
        createdSub?.id != null
          ? Number(createdSub.id)
          : pendingSubscriptionId;

      if (
        mode === "create" &&
        enrollmentMode === "agreement" &&
        !waitingForCard
      ) {
        setWaitingForCard(false);
        setPendingSubscriptionId(null);
        setBillTo(null);
        setLines([]);
        setReferenceNumber("");
        setDealId("");
        setBillingInterval("monthly");
        setStartsAt(todayIsoDate());
        setDuration("ongoing");
        setCustomEndDate("");
        setPaymentMode("request_setup");
        setEnrollmentMode("direct");
        setAgreementTermsMarkdown("");
        setAgreementTermsEdited(false);
        setMessage("");
        setMessageEdited(false);
        onSaved?.(result);
        notify(
          sendEmail || sendSms
            ? "Agreement link sent — waiting for client signature and card"
            : "Subscription created — copy the agreement link to send to the client",
          { type: "success" },
        );
        return;
      }

      if (
        mode === "create" &&
        paymentMode === "request_setup" &&
        !result.used_saved_card &&
        !result.used_staff_card &&
        !waitingForCard
      ) {
        setWaitingForCard(true);
        if (createdId != null) setPendingSubscriptionId(createdId);
        notify(
          sendEmail || sendSms
            ? "Setup link sent — waiting for the client to add a card"
            : "Subscription created — waiting for the client to add a card",
          { type: "success" },
        );
        void refetchSavedCards();
        return;
      }

      if (mode === "create") {
        setWaitingForCard(false);
        setPendingSubscriptionId(null);
        setBillTo(null);
        setLines([]);
        setReferenceNumber("");
        setDealId("");
        setBillingInterval("monthly");
        setStartsAt(todayIsoDate());
        setDuration("ongoing");
        setCustomEndDate("");
        setPaymentMode("request_setup");
        setEnrollmentMode("direct");
        setAgreementTermsMarkdown("");
        setAgreementTermsEdited(false);
        setMessage("");
        setMessageEdited(false);
      }
      onSaved?.(result);
      if (mode === "create") {
        if (result.used_saved_card || result.used_staff_card || waitingForCard) {
          notify("Subscription activated with card on file", {
            type: "success",
          });
        } else if (sendEmail || sendSms) {
          notify("Subscription created — setup link sent to client", {
            type: "success",
          });
        } else {
          notify("Subscription created — use Send to deliver the setup link", {
            type: "success",
          });
        }
      } else if (result.setup_link_stale) {
        notify(
          "Subscription updated. Resend the setup link so the client sees the new amount.",
          { type: "warning" },
        );
      } else if (
        isPendingSetup &&
        paymentMode === "request_setup" &&
        !(sendEmail || sendSms)
      ) {
        notify("Subscription saved — use Send to deliver the setup link", {
          type: "success",
        });
      } else {
        notify("Subscription updated", { type: "success" });
      }
    },
    onError: (error: Error) => {
      notify(error.message || "Could not save subscription", { type: "error" });
    },
  });

  const canSubmit =
    !formDisabled &&
    Boolean(billTo) &&
    amount > 0 &&
    subscriptionName.length > 0 &&
    Boolean(identity) &&
    (duration !== "custom" || Boolean(customEndDate)) &&
    (waitingForCard
      ? clientCardReady &&
        paymentMode === "saved_card" &&
        Boolean(selectedSavedPaymentMethodId)
      : mode === "edit" && isActiveLike
        ? true
        : paymentMode === "saved_card"
          ? Boolean(
              selectedSavedPaymentMethodId ||
                savedCard?.stripePaymentMethodId ||
                subscription?.payment_method_last4,
            )
          : paymentMode === "staff_card"
            ? Boolean(recipientEmail)
            : paymentMode === "request_setup"
              ? (sendEmail && Boolean(recipientEmail)) ||
                (sendSms && Boolean(recipientPhone))
              : false);

  useEffect(() => {
    if (mode !== "edit" || !subscription || billTo) return;
    const next = billToSelectionFromClient({ company, contact });
    if (next) setBillTo(next);
  }, [mode, subscription, company, contact, billTo]);

  useEffect(() => {
    onStateChange?.({
      canSubmit,
      isPending: saveMutation.isPending,
    });
  }, [canSubmit, saveMutation.isPending, onStateChange]);

  useImperativeHandle(ref, () => ({
    submit: () => saveMutation.mutate(),
    canSubmit,
    isPending: saveMutation.isPending,
  }));

  const clientLabel = billTo?.label ?? "";

  const dealCompanyId = billTo?.companyId ?? subscription?.company_id ?? null;
  const { data: dealOptions = [] } = useGetList<LbsDeal>(
    "deals",
    {
      filter: dealCompanyId
        ? { "company_id@eq": String(dealCompanyId) }
        : {},
      pagination: { page: 1, perPage: 50 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { enabled: Boolean(dealCompanyId) },
  );

  const paymentOptionClass = (value: SubscriptionPaymentMode) =>
    cn(
      "inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors",
      paymentMode === value
        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20"
        : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      fieldsLocked && "pointer-events-none opacity-60",
    );

  const hasSavedCards = allSavedCards.length > 0;
  const requestDelivery: "email" | "sms" | "both" =
    sendEmail && sendSms
      ? "both"
      : sendSms
        ? "sms"
        : "email";

  const setRequestDelivery = (next: "email" | "sms" | "both") => {
    if (next === "email") {
      setSendEmail(true);
      setSendSms(false);
      return;
    }
    if (next === "sms") {
      setSendEmail(false);
      setSendSms(true);
      return;
    }
    setSendEmail(true);
    setSendSms(true);
  };

  const selectPaymentMode = (next: SubscriptionPaymentMode) => {
    setPaymentMode(next);
    if (next === "request_setup") {
      if (recipientEmail && recipientPhone) {
        setSendEmail(true);
        setSendSms(true);
      } else if (recipientEmail) {
        setSendEmail(true);
        setSendSms(false);
      } else if (recipientPhone) {
        setSendEmail(false);
        setSendSms(true);
      } else {
        setSendEmail(false);
        setSendSms(false);
      }
    }
  };

  return (
    <div
      className={cn(
        "grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]",
        scrollContainer === "self" && "min-h-0 flex-1 overflow-y-auto",
      )}
    >
      <div className="min-w-0 space-y-8 border-b px-4 py-5 md:border-b-0 md:border-r md:px-6">
        <CreateFormSection title="Client" className="[&>div]:space-y-3">
          <div
            className={cn(
              (fieldsLocked || mode === "edit") &&
                "pointer-events-none opacity-60",
            )}
          >
            <BillToClientSearch
              value={billTo}
              onChange={setBillTo}
              variant="floating"
              label="Client"
              searchPlaceholder="Company, client name, or phone…"
            />
          </div>
        </CreateFormSection>

        <CreateFormSection title="Plan" className="[&>div]:space-y-4">
          <div
            className={cn(fieldsLocked && "pointer-events-none opacity-60")}
          >
            <SubscriptionLineItemsEditor
              lines={lines}
              onChange={setLines}
              billingInterval={billingInterval}
              onBillingIntervalChange={setBillingInterval}
              disabled={fieldsLocked}
              currency={subscription?.currency ?? "USD"}
            />
          </div>
        </CreateFormSection>

        <CreateFormSection title="Schedule" className="[&>div]:space-y-4">
          <CreateFormFieldRow
            columns={2}
            className={cn(fieldsLocked && "pointer-events-none opacity-60")}
          >
            <FloatingSelectField
              id="subscription-interval"
              label="Billing interval"
              value={billingInterval}
              disabled={fieldsLocked}
              activeWhenEmpty
              onValueChange={(value) =>
                setBillingInterval(value as "weekly" | "monthly" | "yearly")
              }
            >
              {BILLING_INTERVALS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </FloatingSelectField>

            {mode === "edit" ? (
              <FloatingFieldShell
                active={referenceFocused || Boolean(referenceNumber.trim())}
                label="Internal reference"
                htmlFor="subscription-reference"
              >
                <Input
                  id="subscription-reference"
                  disabled={fieldsLocked}
                  value={referenceNumber}
                  onChange={(event) => setReferenceNumber(event.target.value)}
                  onFocus={() => setReferenceFocused(true)}
                  onBlur={() => setReferenceFocused(false)}
                  placeholder=" "
                  className={floatingFieldControlClassName}
                />
              </FloatingFieldShell>
            ) : (
              <FloatingSelectField
                id="subscription-deal"
                label="Associated deal"
                value={dealId || "none"}
                disabled={fieldsLocked || !dealCompanyId}
                activeWhenEmpty
                onValueChange={(value) =>
                  setDealId(value === "none" ? "" : value)
                }
              >
                <SelectItem value="none">No deal</SelectItem>
                {dealOptions.map((deal) => (
                  <SelectItem key={String(deal.id)} value={String(deal.id)}>
                    {deal.name ?? `Deal #${deal.id}`}
                  </SelectItem>
                ))}
              </FloatingSelectField>
            )}
          </CreateFormFieldRow>

          {mode === "edit" ? (
            <div
              className={cn(fieldsLocked && "pointer-events-none opacity-60")}
            >
              <FloatingSelectField
                id="subscription-deal-edit"
                label="Associated deal"
                value={dealId || "none"}
                disabled={fieldsLocked || !dealCompanyId}
                activeWhenEmpty
                onValueChange={(value) =>
                  setDealId(value === "none" ? "" : value)
                }
              >
                <SelectItem value="none">No deal</SelectItem>
                {dealOptions.map((deal) => (
                  <SelectItem key={String(deal.id)} value={String(deal.id)}>
                    {deal.name ?? `Deal #${deal.id}`}
                  </SelectItem>
                ))}
              </FloatingSelectField>
            </div>
          ) : null}

          {mode === "edit" &&
          subscription?.enrollment_mode === "agreement" &&
          (subscription.agreement_signed_at ||
            subscription.agreement_terms_markdown?.trim()) ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/10 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Agreement
                </p>
                <p className="text-sm">
                  {subscription.agreement_signed_at
                    ? `Signed${
                        subscription.agreement_signatory_name
                          ? ` by ${subscription.agreement_signatory_name}`
                          : ""
                      }`
                    : "Awaiting signature"}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSignedAgreementOpen(true)}
              >
                <FileText className="size-3.5" />
                View signed agreement
              </Button>
            </div>
          ) : null}

          <CreateFormFieldRow
            columns={2}
            className={cn(fieldsLocked && "pointer-events-none opacity-60")}
          >
            <FloatingFieldShell
              active={startsFocused || Boolean(startsAt.trim())}
              label="Starts"
              htmlFor="subscription-starts"
            >
              <Input
                id="subscription-starts"
                type="date"
                disabled={fieldsLocked || mode === "edit"}
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                onFocus={() => setStartsFocused(true)}
                onBlur={() => setStartsFocused(false)}
                className={floatingFieldControlClassName}
              />
            </FloatingFieldShell>

            <FloatingSelectField
              id="subscription-duration"
              label="Duration"
              value={duration}
              disabled={fieldsLocked}
              activeWhenEmpty
              onValueChange={(value) =>
                setDuration(value as SubscriptionDurationValue)
              }
            >
              {SUBSCRIPTION_DURATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </FloatingSelectField>
          </CreateFormFieldRow>

          {duration === "custom" ? (
            <FloatingFieldShell
              active={endsFocused || Boolean(customEndDate.trim())}
              label="End date"
              htmlFor="subscription-ends"
            >
              <Input
                id="subscription-ends"
                type="date"
                disabled={fieldsLocked}
                value={customEndDate}
                min={startsAt}
                onChange={(event) => setCustomEndDate(event.target.value)}
                onFocus={() => setEndsFocused(true)}
                onBlur={() => setEndsFocused(false)}
                className={floatingFieldControlClassName}
              />
            </FloatingFieldShell>
          ) : null}
        </CreateFormSection>

        {!paymentSectionLocked ? (
          <CreateFormSection title="Payment" className="[&>div]:space-y-3">
            {mode === "create" ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Start mode
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm transition-colors",
                      enrollmentMode === "direct"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/40",
                      fieldsLocked && "pointer-events-none opacity-60",
                    )}
                    disabled={fieldsLocked}
                    onClick={() => {
                      setEnrollmentMode("direct");
                      if (!sendEmail && !sendSms) {
                        setSendEmail(false);
                        setSendSms(false);
                      }
                    }}
                  >
                    Direct
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm transition-colors",
                      enrollmentMode === "agreement"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/40",
                      fieldsLocked && "pointer-events-none opacity-60",
                    )}
                    disabled={fieldsLocked}
                    onClick={() => {
                      setEnrollmentMode("agreement");
                      setSendEmail(Boolean(recipientEmail));
                      setSendSms(false);
                    }}
                  >
                    Agreement
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {enrollmentMode === "agreement"
                    ? "Client reviews terms, signs, then adds a card. Billing starts automatically."
                    : "Create with a card on file, enter a card, or request setup from the client."}
                </p>
              </div>
            ) : null}

            {mode === "create" && enrollmentMode === "agreement" ? (
              <div className="space-y-3 rounded-md border bg-muted/10 p-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        Contract
                      </p>
                      <p className="truncate text-sm font-medium">
                        {selectedTemplate
                          ? `${selectedTemplate.title} (v${selectedTemplate.version})`
                          : "No template selected"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={fieldsLocked || contractTemplates.length === 0}
                        onClick={() => setChangeContractOpen(true)}
                      >
                        Change contract
                      </Button>
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="View as client"
                        title="View how the client sees the portal"
                        disabled={fieldsLocked}
                        onClick={() => setAgreementPreviewOpen(true)}
                      >
                        <Eye className="size-4" />
                      </IconButton>
                    </div>
                  </div>

                  {changeContractOpen ? (
                    <Select
                      value={
                        selectedContractTermsId != null
                          ? String(selectedContractTermsId)
                          : undefined
                      }
                      onValueChange={(value) => {
                        setContractPickedManually(true);
                        setAgreementTermsEdited(false);
                        setTermsEditMode(false);
                        setSelectedContractTermsId(Number(value));
                        setChangeContractOpen(false);
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Choose a contract template" />
                      </SelectTrigger>
                      <SelectContent>
                        {contractTemplates.map((row) => (
                          <SelectItem
                            key={String(row.id)}
                            value={String(row.id)}
                          >
                            {row.title}
                            {row.is_default ? " (org default)" : ""} · v
                            {row.version}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Terms preview (filled for this client)
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={fieldsLocked}
                      onClick={() => {
                        setTermsEditMode((current) => !current);
                        if (!termsEditMode) setAgreementTermsEdited(true);
                      }}
                    >
                      {termsEditMode ? "Done editing" : "Edit terms"}
                    </Button>
                  </div>
                  {termsEditMode ? (
                    <textarea
                      className="min-h-[140px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                      disabled={fieldsLocked}
                      value={agreementTermsMarkdown}
                      onChange={(event) => {
                        setAgreementTermsEdited(true);
                        setAgreementTermsMarkdown(event.target.value);
                      }}
                      placeholder="Markdown terms shown to the client before signature"
                    />
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-md border bg-white p-3 text-sm">
                      {agreementTermsMarkdown.trim() ? (
                        <ContractDocumentMarkdown>
                          {agreementTermsMarkdown}
                        </ContractDocumentMarkdown>
                      ) : (
                        <p className="text-muted-foreground">
                          Select a package with a linked contract, or choose a
                          template with Change contract.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Send agreement link via
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        {
                          id: "email" as const,
                          label: recipientEmail
                            ? `Email (${recipientEmail})`
                            : "Email",
                          disabled: !recipientEmail,
                        },
                        {
                          id: "sms" as const,
                          label: recipientPhone
                            ? `SMS (${recipientPhone})`
                            : "SMS",
                          disabled: !recipientPhone,
                        },
                        {
                          id: "both" as const,
                          label: "Both",
                          disabled: !recipientEmail || !recipientPhone,
                        },
                      ] as const
                    ).map((option) => {
                      const selected =
                        option.id === "email"
                          ? sendEmail && !sendSms
                          : option.id === "sms"
                            ? sendSms && !sendEmail
                            : sendEmail && sendSms;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={fieldsLocked || option.disabled}
                          className={cn(
                            "rounded-md border px-3 py-1.5 text-sm transition-colors",
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border text-muted-foreground hover:bg-muted/40",
                            (fieldsLocked || option.disabled) &&
                              "pointer-events-none opacity-50",
                          )}
                          onClick={() => {
                            if (option.id === "email") {
                              setSendEmail(true);
                              setSendSms(false);
                            } else if (option.id === "sms") {
                              setSendEmail(false);
                              setSendSms(true);
                            } else {
                              setSendEmail(true);
                              setSendSms(true);
                            }
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {enrollmentMode === "direct" || mode !== "create" ? (
              <>
            {hasSavedCards ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Card on file
                </p>
                <div
                  className={cn(
                    fieldsLocked && "pointer-events-none opacity-60",
                    paymentMode === "saved_card"
                      ? "rounded-md ring-1 ring-primary/25"
                      : "opacity-80",
                  )}
                >
                  <SavedCardSelect
                    cards={allSavedCards}
                    value={selectedSavedCardValue}
                    onChange={(value) => {
                      setSelectedSavedCardValue(value);
                      setPaymentMode("saved_card");
                    }}
                    disabled={fieldsLocked}
                    label="Select card"
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              {hasSavedCards ? (
                <p className="text-xs font-medium text-muted-foreground">
                  Or use another method
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={paymentOptionClass("request_setup")}
                  disabled={fieldsLocked}
                  onClick={() => selectPaymentMode("request_setup")}
                >
                  Request from client
                </button>
                <button
                  type="button"
                  className={paymentOptionClass("staff_card")}
                  disabled={fieldsLocked}
                  onClick={() => selectPaymentMode("staff_card")}
                >
                  Enter manually
                </button>
              </div>
            </div>

            {paymentMode === "request_setup" ? (
              <div className="space-y-3 rounded-md border bg-muted/10 p-3">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Send setup link via
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        {
                          id: "email" as const,
                          label: recipientEmail
                            ? `Email (${recipientEmail})`
                            : "Email",
                          disabled: !recipientEmail,
                        },
                        {
                          id: "sms" as const,
                          label: recipientPhone
                            ? `SMS (${recipientPhone})`
                            : "SMS",
                          disabled: !recipientPhone,
                        },
                        {
                          id: "both" as const,
                          label: "Both",
                          disabled: !recipientEmail || !recipientPhone,
                        },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={fieldsLocked || option.disabled}
                        onClick={() => setRequestDelivery(option.id)}
                        className={cn(
                          "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition-colors",
                          requestDelivery === option.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                          (fieldsLocked || option.disabled) &&
                            "pointer-events-none opacity-50",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {!recipientEmail && !recipientPhone ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      This client needs an email or phone to send the setup
                      link.
                    </p>
                  ) : null}
                </div>

                <FloatingFieldShell
                  active={
                    messageFocused ||
                    Boolean(
                      (messageEdited ? message : defaultMessage).trim(),
                    )
                  }
                  label="Message"
                  htmlFor="subscription-message"
                  className="min-h-[4.5rem] items-stretch"
                >
                  <Textarea
                    id="subscription-message"
                    rows={3}
                    value={messageEdited ? message : ""}
                    onChange={(event) => {
                      setMessageEdited(true);
                      setMessage(event.target.value);
                    }}
                    onFocus={() => setMessageFocused(true)}
                    onBlur={() => setMessageFocused(false)}
                    placeholder={defaultMessage}
                    className={cn(
                      floatingFieldControlClassName,
                      "h-auto min-h-[4.5rem] resize-y py-2",
                    )}
                  />
                </FloatingFieldShell>
              </div>
            ) : null}

            {paymentMode === "staff_card" ? (
              <div className="rounded-md border bg-muted/10 p-3">
                <SubscriptionStaffCardForm
                  ref={staffCardRef}
                  enabled={paymentMode === "staff_card"}
                  billTo={billTo}
                  recipientEmail={recipientEmail}
                />
              </div>
            ) : null}
              </>
            ) : null}
          </CreateFormSection>
        ) : subscription?.payment_method_last4 ? (
          <CreateFormSection title="Payment">
            <div className="rounded-md border bg-muted/20 px-3 py-2.5 text-sm">
              <p className="font-medium">Payment method on file</p>
              <p className="text-muted-foreground">
                {subscription.payment_method_brand ?? "Card"} ····
                {subscription.payment_method_last4}
              </p>
            </div>
          </CreateFormSection>
        ) : null}
      </div>

      <div className="min-w-0 px-4 py-5 md:px-5">
        <SubscriptionCreateReviewPanel
          clientLabel={clientLabel}
          subscriptionName={subscriptionName}
          amount={amount}
          billingInterval={billingInterval}
          startsAtDate={startsAt}
          endsAtDate={endsAtDateForReview}
          paymentMode={paymentMode}
          cardOnFile={cardOnFile}
          savedCards={allSavedCards}
          recipientEmail={recipientEmail}
          recipientPhone={recipientPhone}
          sendEmail={sendEmail}
          sendSms={sendSms}
          deliveryMessage={deliveryMessage}
          orgTitle={orgTitle ?? "Latino Business Support"}
          canSubmit={canSubmit}
          isPending={saveMutation.isPending}
          onSubmit={() => saveMutation.mutate()}
          onCancel={() => onCancel?.()}
          submitLabel={
            waitingForCard && clientCardReady
              ? "Activate subscription"
              : mode === "create" && enrollmentMode === "agreement"
                ? "Send agreement"
                : mode === "create"
                  ? "Create subscription"
                  : "Save changes"
          }
          pendingLabel={
            waitingForCard && clientCardReady
              ? "Activating…"
              : mode === "create" && enrollmentMode === "agreement"
                ? "Sending…"
                : mode === "create"
                  ? "Creating…"
                  : "Saving…"
          }
          waitingForCard={waitingForCard && !clientCardReady}
          hideActions={hideReviewActions}
        />
      </div>

      <Dialog open={agreementPreviewOpen} onOpenChange={setAgreementPreviewOpen}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>Client portal preview</DialogTitle>
          </DialogHeader>
          <div className="mx-auto max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl border bg-slate-50 shadow-xl">
            <div className="sticky top-0 z-10 border-b bg-white/95 px-4 py-2.5 backdrop-blur">
              <p className="text-center text-xs font-medium text-muted-foreground">
                How the client sees the agreement portal
              </p>
            </div>
            <div className="px-4 py-6">
              <SubscriptionAgreementClientView
                preview
                model={{
                  subscription_name: subscriptionName,
                  amount,
                  currency: "USD",
                  billing_interval: billingInterval,
                  line_items: lineItemsPayload,
                  terms_markdown: agreementTermsMarkdown,
                  contract_title: selectedTemplate?.title ?? null,
                  terms_version: selectedTemplate?.version ?? null,
                  organization_name: orgTitle || "Provider",
                  provider_representative: identity?.fullName?.trim() || null,
                  client_name: clientDisplayName,
                  client_representative: clientRepresentativeName || null,
                  client_address: clientAddress,
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SignedSubscriptionAgreementDialog
        open={signedAgreementOpen}
        onOpenChange={setSignedAgreementOpen}
        termsMarkdown={
          subscription
            ? resolveFilledAgreementTermsMarkdown({
                markdown: subscription.agreement_terms_markdown,
                subscription,
                clientName: clientDisplayName,
                clientAddress,
                clientRepresentative: clientRepresentativeName,
                providerRepresentative: identity?.fullName?.trim() || null,
              })
            : null
        }
        signatoryName={subscription?.agreement_signatory_name}
        signedAt={subscription?.agreement_signed_at}
        signaturePng={subscription?.agreement_signature_png}
        clientCompany={clientDisplayName}
        clientRepresentative={
          clientRepresentativeName ||
          subscription?.agreement_signatory_name ||
          null
        }
        providerRepresentative={identity?.fullName?.trim() || null}
        clientAddress={clientAddress}
        subscriptionName={subscription?.name ?? subscriptionName}
        subscriptionDescription={subscription?.description ?? null}
      />
    </div>
  );
});
