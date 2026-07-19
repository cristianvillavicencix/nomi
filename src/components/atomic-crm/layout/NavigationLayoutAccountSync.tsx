import { useEffect, useRef } from "react";
import { useGetIdentity, useGetOne } from "ra-core";
import { useQueryClient } from "@tanstack/react-query";

import type { OrganizationMember } from "@/components/atomic-crm/types";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import {
  hydrateNavigationLayoutFromAccount,
  NAVIGATION_LAYOUT_UI_PREF_KEY,
  parseNavigationLayoutFromUiPrefs,
  registerNavigationLayoutAccountPersist,
  type NavigationLayoutMode,
  useNavigationLayoutPreference,
} from "./navigationLayoutPreference";

/**
 * Keeps desktop navigation layout (sidebar | top) in sync with the signed-in
 * member's `ui_prefs`, so the choice follows the account across browsers.
 * localStorage remains a fast cache for first paint.
 */
export function NavigationLayoutAccountSync() {
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const memberId = identity?.id;
  const { data: member, refetch } = useGetOne<OrganizationMember>(
    "organization_members",
    { id: memberId },
    { enabled: memberId != null },
  );
  const [localMode] = useNavigationLayoutPreference();
  const hydratedMemberId = useRef<string | number | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (memberId == null || !member) return;

    const fromAccount = parseNavigationLayoutFromUiPrefs(member.ui_prefs);
    if (hydratedMemberId.current === memberId) return;
    hydratedMemberId.current = memberId;

    if (fromAccount) {
      hydrateNavigationLayoutFromAccount(fromAccount);
      return;
    }

    // First time on this account: push existing browser choice to the member.
    if (localMode === "top" || localMode === "sidebar") {
      void persistUiPrefs(member, localMode).then(() => {
        void refetch();
        void queryClient.invalidateQueries({
          queryKey: ["organization_members", member.id],
        });
      });
    }
  }, [localMode, member, memberId, queryClient, refetch]);

  useEffect(() => {
    if (memberId == null || !member) {
      return registerNavigationLayoutAccountPersist(null);
    }

    return registerNavigationLayoutAccountPersist((mode) => {
      if (savingRef.current) return;
      const current = parseNavigationLayoutFromUiPrefs(member.ui_prefs);
      if (current === mode) return;

      savingRef.current = true;
      void persistUiPrefs(member, mode)
        .then(() => {
          void refetch();
          void queryClient.invalidateQueries({
            queryKey: ["organization_members", member.id],
          });
        })
        .finally(() => {
          savingRef.current = false;
        });
    });
  }, [member, memberId, queryClient, refetch]);

  return null;
}

async function persistUiPrefs(
  member: OrganizationMember,
  mode: NavigationLayoutMode,
) {
  const nextPrefs = {
    ...(member.ui_prefs && typeof member.ui_prefs === "object"
      ? member.ui_prefs
      : {}),
    [NAVIGATION_LAYOUT_UI_PREF_KEY]: mode,
  };
  const { error } = await supabase
    .from("organization_members")
    .update({ ui_prefs: nextPrefs })
    .eq("id", member.id);
  if (error) {
    console.warn("Failed to save navigation layout preference", error);
  }
}
