import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import {
  normalizeAssistantSettings,
  type OrganizationAssistantSettings,
} from "@/modules/assistant/assistantSettings";
import { isCrmAssistantEnvEnabled } from "@/modules/assistant/isCrmAssistantEnabled";

/**
 * Env build flag + workspace toggle from organizations.assistant_settings.
 * Used to show/hide the Ask Sigma chrome control.
 */
export const useCrmAssistantAvailable = () => {
  const envEnabled = isCrmAssistantEnvEnabled();

  const { data, isPending } = useQuery({
    queryKey: ["organization-assistant-settings"],
    queryFn: async (): Promise<OrganizationAssistantSettings> => {
      const { data: row, error } = await supabase
        .from("organizations")
        .select("assistant_settings")
        .single();
      if (error) throw error;
      return normalizeAssistantSettings(
        (row as { assistant_settings?: unknown } | null)?.assistant_settings,
      );
    },
    enabled: envEnabled,
    staleTime: 60_000,
  });

  if (!envEnabled) {
    return { available: false, isPending: false };
  }

  // Default on while loading so the button does not flicker off for admins.
  const orgEnabled = data?.enabled !== false;
  return {
    available: orgEnabled,
    isPending,
  };
};
