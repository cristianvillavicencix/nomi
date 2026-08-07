import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { fetchPublicSubscriptionSetupByShortCode } from "@/modules/billing/public/publicSubscriptionSetupApi";

const shellClassName =
  "flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-x-hidden bg-slate-50 px-3 py-6";

/** Public short URL `/sub/:shortCode` → redirects to Stripe subscription setup checkout. */
export const SubscriptionSetupShortUrlRedirect = () => {
  const { shortCode = "" } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shortCode.trim()) {
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;
    void fetchPublicSubscriptionSetupByShortCode(shortCode)
      .then((payload) => {
        if (cancelled) return;
        if (payload.already_active) {
          setError(
            "This subscription already has a card on file. Contact us if you need to update your payment method.",
          );
          return;
        }
        window.location.replace(payload.checkout_url);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || "Could not open subscription setup link");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, shortCode]);

  if (error) {
    return (
      <div className={shellClassName}>
        <p className="max-w-md px-6 text-center text-sm text-muted-foreground">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      <div className="flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Opening secure checkout…
      </div>
    </div>
  );
};
