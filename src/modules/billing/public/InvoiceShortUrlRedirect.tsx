import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import { computeInvoiceBalanceDue } from "@/modules/billing/invoicePaymentUtils";
import {
  fetchPublicInvoiceByShortCode,
  type PublicInvoiceLocationState,
  type PublicInvoicePayload,
} from "@/modules/billing/public/publicInvoiceApi";
import { PublicInvoicePaymentFlow } from "@/modules/billing/public/PublicInvoicePaymentFlow";

const isPayRequested = (searchParams: URLSearchParams) =>
  searchParams.get("pay") === "1" ||
  searchParams.get("pay") === "true" ||
  searchParams.get("sms") === "1";

const isPayModeActive = (payload: PublicInvoicePayload, payRequested: boolean) =>
  Boolean(
    payRequested &&
      payload.invoice.status !== "paid" &&
      computeInvoiceBalanceDue(
        Number(payload.invoice.amount) || 0,
        Number(payload.invoice.amount_paid) || 0,
      ) > 0.01,
  );

const payShellClassName =
  "flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-x-hidden bg-slate-50 px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-4 sm:py-10 lg:px-6";

/**
 * Short share URL `/iv/:shortCode`. Loads the invoice once.
 * With `?pay=1` / `sms=1` and unpaid balance, renders payment immediately
 * (no portal Invoice chrome). Otherwise navigates to `/portal/invoice/:token`
 * with the payload cached in location state to avoid a second fetch.
 */
export const InvoiceShortUrlRedirect = () => {
  const { shortCode = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [payload, setPayload] = useState<PublicInvoicePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const search = location.search?.trim() || "";
  const payRequested = isPayRequested(new URLSearchParams(search));

  useEffect(() => {
    if (!shortCode.trim()) {
      navigate("/", { replace: true });
      return;
    }

    const params = new URLSearchParams(search);
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPayload(null);

    void fetchPublicInvoiceByShortCode(shortCode)
      .then((next) => {
        if (cancelled) return;
        setPayload(next);

        if (!isPayModeActive(next, isPayRequested(params))) {
          navigate(`/portal/invoice/${next.token}${search}`, {
            replace: true,
            state: {
              publicInvoicePayload: next,
            } satisfies PublicInvoiceLocationState,
          });
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || "Could not load invoice");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, shortCode, search]);

  const payModeActive = useMemo(
    () => (payload ? isPayModeActive(payload, payRequested) : false),
    [payload, payRequested],
  );

  if (loading) {
    return (
      <div className={payShellClassName}>
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading invoice…
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className={payShellClassName}>
        <p className="max-w-md px-6 text-center text-sm text-muted-foreground">
          {error ?? "Invoice not found"}
        </p>
      </div>
    );
  }

  if (payModeActive) {
    return (
      <div className={payShellClassName}>
        <PublicInvoicePaymentFlow
          token={payload.token}
          payload={payload}
          focusPaymentEntry
          onSuccess={() => {
            navigate(`/portal/invoice/${payload.token}`, { replace: true });
          }}
        />
      </div>
    );
  }

  // Non-pay (or paid) path navigates away; keep a quiet loading shell while replace runs.
  return (
    <div className={payShellClassName}>
      <div className="flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading invoice…
      </div>
    </div>
  );
};
