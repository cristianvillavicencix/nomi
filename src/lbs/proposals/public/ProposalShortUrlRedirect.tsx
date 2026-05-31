import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { Loader2 } from "lucide-react";
import { resolvePublicProposalShortCode } from "@/lbs/proposals/public/publicProposalApi";

export const ProposalShortUrlRedirect = () => {
  const { shortCode = "" } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!shortCode) {
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;

    void resolvePublicProposalShortCode(shortCode)
      .then((token) => {
        if (cancelled) return;
        navigate(`/proposal/${token}`, { replace: true });
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
      Opening proposal…
    </div>
  );
};
