import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { getClientShowPath } from "@/app/routing";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { AccountsCompanyOverviewPreview } from "@/modules/accounts/AccountsCompanyOverviewPreview";

/** Shared company Sheet preview for Accounts List (`?company=`). */
export const AccountsCompanyPreviewSheet = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const companyId = searchParams.get("company");

  const clearSelection = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("company");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (isMobile && companyId) {
      navigate(getClientShowPath(companyId), { replace: true });
    }
  }, [companyId, isMobile, navigate]);

  return (
    <Sheet
      open={Boolean(companyId) && !isMobile}
      onOpenChange={(open) => {
        if (!open) clearSelection();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-[50vw] [&>button]:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Company preview</SheetTitle>
        </SheetHeader>
        {companyId ? (
          <AccountsCompanyOverviewPreview
            companyId={companyId}
            onClose={clearSelection}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

/** Open company preview on the current Accounts hub URL. */
export const buildAccountsCompanyPreviewParams = (
  current: URLSearchParams,
  companyId: string | number,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  next.delete("contact");
  next.delete("lead");
  next.delete("stage");
  next.set("company", String(companyId));
  return next;
};
