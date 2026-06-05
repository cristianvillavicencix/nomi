import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { resolvePublicInvoiceShortCode } from "@/lbs/billing/public/publicInvoiceApi";

export const InvoiceShortUrlRedirect = () => {
  const { shortCode = "" } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!shortCode) {
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;

    void resolvePublicInvoiceShortCode(shortCode)
      .then((token) => {
        if (!cancelled) navigate(`/portal/invoice/${token}`, { replace: true });
      })
      .catch(() => {
        if (!cancelled) navigate("/", { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, shortCode]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      Opening invoice…
    </div>
  );
};
