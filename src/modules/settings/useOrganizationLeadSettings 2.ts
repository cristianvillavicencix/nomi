import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import {
  normalizeOrganizationLeadSettings,
  type OrganizationLeadSettings,
} from "@/modules/leads/leadWorkspaceSettings";

export type OrganizationLeadSettingsRow = OrganizationLeadSettings & {
  id: number;
  name?: string | null;
};

export const useOrganizationLeadSettings = () =>
  useQuery({
    queryKey: ["organization-lead-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, lead_settings")
        .single();

      if (error) throw error;

      const row = data as {
        id: number;
        name?: string | null;
        lead_settings?: unknown;
      };

      return {
        id: row.id,
        name: row.name,
        ...normalizeOrganizationLeadSettings(row.lead_settings),
      } satisfies OrganizationLeadSettingsRow;
    },
  });
