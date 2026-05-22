import { useGetIdentity } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );

let amountVisibilityRef = { current: true };

export function useCanViewAmounts(): boolean {
  const { data: identity } = useGetIdentity();
  return hasMemberCapability(identity as Parameters<typeof hasMemberCapability>[0], "view_amounts.show");
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

export function useMaskedAmount(value: number | null | undefined): string {
  const canView = useCanViewAmounts();
  if (!canView) return "—";
  if (value == null || Number.isNaN(value)) return "—";
  return formatUsd(value);
}

export function maskAmountIfNeeded(
  value: number | null | undefined,
  canViewAmounts: boolean,
): string {
  if (!canViewAmounts) return "—";
  if (value == null || Number.isNaN(value)) return "—";
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
