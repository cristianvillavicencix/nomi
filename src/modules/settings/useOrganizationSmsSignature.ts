import { useQuery } from "@tanstack/react-query";
import { useGetIdentity, useGetOne } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import {
  resolveOrganizationSmsSignature,
  type SignatureContext,
} from "@/lib/signatures/signatureExpansion";

export type OrganizationSmsSignatureSettings = {
  id: number;
  name: string;
  sms_signature_template: string | null;
  sms_signature_enabled: boolean;
};

export function useOrganizationSmsSignature(options?: {
  /** Scoped standard users always sign outbound SMS, even when org-wide signature is off. */
  forceUserSignature?: boolean;
}) {
  const forceUserSignature = options?.forceUserSignature ?? false;
  const { data: identity } = useGetIdentity();
  const { data: member } = useGetOne<OrganizationMember>(
    "organization_members",
    { id: identity?.id },
    { enabled: identity?.id != null },
  );

  const query = useQuery({
    queryKey: ["organization-sms-signature"],
    queryFn: async (): Promise<OrganizationSmsSignatureSettings> => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, sms_signature_template, sms_signature_enabled")
        .single();

      if (error) throw error;
      return data as OrganizationSmsSignatureSettings;
    },
    staleTime: 60_000,
  });

  const signatureContext: SignatureContext = {
    user_first_name: member?.first_name ?? "",
    user_last_name: member?.last_name ?? "",
    user_full_name:
      `${member?.first_name ?? ""} ${member?.last_name ?? ""}`.trim(),
    org_name: query.data?.name ?? "",
  };

  const { signature, signatureRequired } = resolveOrganizationSmsSignature({
    template: query.data?.sms_signature_template,
    orgEnabled: query.data?.sms_signature_enabled,
    forceUserSignature,
    context: signatureContext,
  });

  return {
    ...query,
    signature,
    signatureRequired,
    signatureContext,
    settings: query.data,
  };
}
