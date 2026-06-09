import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";
import { resolvePublicInvoiceShortCode } from "@/lbs/billing/public/publicInvoiceApi";

export const InvoiceShortUrlRedirect = () => {
  const { shortCode = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!shortCode) {
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;

    void resolvePublicInvoiceShortCode(shortCode)
      .then((token) => {
        if (!cancelled) {
          const search = location.search?.trim() || "";
          navigate(`/portal/invoice/${token}${search}`, { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) navigate("/", { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, shortCode, location.search]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      Opening invoice…
    </div>
  );
};
