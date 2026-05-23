import { useGetIdentity } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { canViewMonetaryAmounts } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { formatUsd, maskAmountIfNeeded } from "@/lib/permissions/amountMasking";

export { formatUsd, maskAmountIfNeeded };

const amountVisibilityRef = { current: true };

export function useCanViewAmounts(): boolean {
  const { data: identity } = useGetIdentity();
  return canViewMonetaryAmounts(
    identity as Parameters<typeof canViewMonetaryAmounts>[0],
  );
}

/** Keeps DealShow's module-level `toCurrency` in sync with the signed-in user. */
export function useSyncAmountVisibility() {
  amountVisibilityRef.current = useCanViewAmounts();
}

export function formatMoneyMasked(value: number | null | undefined): string {
  return maskAmountIfNeeded(value, amountVisibilityRef.current);
}

export function useFormatMoney() {
  const canView = useCanViewAmounts();
  return (value: number | null | undefined) => maskAmountIfNeeded(value, canView);
}

export function useMaskedAmount(
  value: number | null | undefined,
  options?: { compact?: boolean },
): string {
  const canView = useCanViewAmounts();
  if (!canView) return "—";
  if (value == null || Number.isNaN(value)) return "—";
  if (options?.compact) {
    return value.toLocaleString("en-US", {
      notation: "compact",
      style: "currency",
      currency: "USD",
      currencyDisplay: "narrowSymbol",
      minimumSignificantDigits: 3,
    });
  }
  return formatUsd(value);
}

export function useCurrentOrgId(enabled = true) {
  return useQuery({
    queryKey: ["current-org-id"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error("Not signed in");

      const { data, error } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.org_id ?? null;
    },
  });
}
