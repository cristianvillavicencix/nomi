import type { Identifier } from "ra-core";
import type {
  OrganizationMember,
  OrganizationMemberFormData,
  SignUpData,
  DealPipeline,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";
import { withCurrentProductName } from "../../../root/defaultConfiguration";
import { invalidateResourceQueries } from "../../queryInvalidation";
import { isValidEmail } from "@/utils/email";
import { resolveOrgTimezoneFromAddress } from "@/lib/timezone/usTimezone";
import { supabase } from "../supabase";
import { invokeEdgeFunction } from "../invokeEdgeFunction";
import { uploadToBucket } from "./uploadToBucket";

const normalizeEmailValue = (value?: string | null, label = "email") => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!isValidEmail(trimmed)) {
    throw new Error(`Invalid ${label}`);
  }

  return trimmed;
};

const looksLikeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const resolveOrganizationMemberId = async (
  id: Identifier,
): Promise<Identifier> => {
  if (typeof id !== "string" || !looksLikeUuid(id)) {
    return id;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", id)
    .single();

  if (error || !data?.id) {
    return id;
  }

  return data.id as Identifier;
};

const patchSingletonConfigurationRow = async (
  config: ConfigurationContextValue,
) => {
  const { data, error } = await supabase
    .from("configuration")
    .update({ config })
    .eq("id", 1)
    .select()
    .maybeSingle();

  if (error) {
    console.error("configuration.update", error);
    throw new Error(error.message || "Failed to save configuration");
  }
  if (data == null) {
    throw new Error(
      "Could not save workspace settings. You must be a company administrator to edit configuration.",
    );
  }

  return data;
};

const syncOrgBookingTimezone = async (timezone: string): Promise<void> => {
  const tz = timezone.trim();
  if (!tz) {
    throw new Error("Timezone is required");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user?.id;
  if (!authUserId) {
    throw new Error("Not authenticated");
  }

  const { data: member, error: memberError } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", authUserId)
    .single();

  if (memberError || !member?.org_id) {
    throw new Error("Organization member not found");
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("booking_settings")
    .eq("id", member.org_id)
    .single();

  if (orgError) {
    console.error("syncOrganizationBookingTimezone.read", orgError);
    throw new Error("Failed to load booking settings");
  }

  const prev =
    org?.booking_settings != null && typeof org.booking_settings === "object"
      ? (org.booking_settings as Record<string, unknown>)
      : {};

  const { error: updateError } = await supabase
    .from("organizations")
    .update({
      booking_settings: {
        ...prev,
        timezone_label: tz,
      },
    })
    .eq("id", member.org_id);

  if (updateError) {
    console.error("syncOrganizationBookingTimezone.update", updateError);
    throw new Error("Failed to save workspace timezone");
  }
};

export const orgProvider = {
  async signUp(_data: SignUpData) {
    throw new Error(
      "Public registration is disabled. Ask your administrator to invite you from Settings → Users.",
    );
  },
  async organizationMemberCreate(body: OrganizationMemberFormData) {
    const { password: _password, ...rest } = body;
    const normalizedBody = {
      ...rest,
      email: normalizeEmailValue(body.email, "email")!,
      roles: Array.isArray(body.roles) ? Array.from(new Set(body.roles)) : [],
    };
    const { data, error } = await invokeEdgeFunction<{
      data: OrganizationMember;
    }>("users", {
      method: "POST",
      body: normalizedBody,
    });

    if (!data || error) {
      console.error("organizationMemberCreate.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(errorDetails?.message || "Failed to create the user");
    }

    return data.data;
  },
  async organizationMemberUpdate(
    id: Identifier,
    data: Partial<Omit<OrganizationMemberFormData, "password">>,
  ) {
    const orgMemberId = await resolveOrganizationMemberId(id);
    const {
      email,
      first_name,
      last_name,
      administrator,
      roles,
      module_permissions,
      avatar,
      avatar_type,
      avatar_url,
      disabled,
    } = data as Partial<Omit<OrganizationMemberFormData, "password">> & {
      avatar_type?: string | null;
      avatar_url?: string | null;
    };

    // Open Peeps / upload selections only touch two plain columns and don't
    // need to go through the privileged `users` edge function. Persist them
    // with a direct PostgREST update — the row's own RLS policy
    // (`organization_members_update_same_org`) lets the user update their
    // own row.
    const hasAvatarPickerUpdate =
      avatar_type !== undefined || avatar_url !== undefined;
    const hasOtherFields =
      email !== undefined ||
      first_name !== undefined ||
      last_name !== undefined ||
      administrator !== undefined ||
      roles !== undefined ||
      module_permissions !== undefined ||
      avatar !== undefined ||
      disabled !== undefined;

    if (hasAvatarPickerUpdate && !hasOtherFields) {
      const patch: Record<string, unknown> = {};
      if (avatar_type !== undefined) patch.avatar_type = avatar_type;
      if (avatar_url !== undefined) patch.avatar_url = avatar_url;
      const { data: row, error: patchError } = await supabase
        .from("organization_members")
        .update(patch)
        .eq("id", orgMemberId)
        .select()
        .maybeSingle();
      if (patchError) {
        console.error("organizationMemberUpdate.avatar.error", patchError);
        throw new Error(patchError.message ?? "Failed to update avatar");
      }
      return row as OrganizationMember;
    }

    let persistedAvatar = avatar;
    if (persistedAvatar?.rawFile instanceof File) {
      persistedAvatar = await uploadToBucket(persistedAvatar);
    }

    const { data: updatedData, error } = await invokeEdgeFunction<{
      data: OrganizationMember;
    }>("users", {
      method: "PATCH",
      body: {
        organization_member_id: orgMemberId,
        email: normalizeEmailValue(email, "email"),
        first_name,
        last_name,
        administrator,
        roles: Array.isArray(roles) ? Array.from(new Set(roles)) : undefined,
        ...(module_permissions !== undefined ? { module_permissions } : {}),
        disabled,
        avatar: persistedAvatar,
        ...(avatar_type !== undefined ? { avatar_type } : {}),
        ...(avatar_url !== undefined ? { avatar_url } : {}),
      },
    });

    if (!updatedData || error) {
      console.error("organizationMemberUpdate.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message || "Failed to update account manager",
      );
    }

    return updatedData.data;
  },
  async updatePassword(id: Identifier) {
    const { data: passwordUpdated, error } = await invokeEdgeFunction<boolean>(
      "update_password",
      {
        method: "PATCH",
        body: {
          organization_member_id: id,
        },
      },
    );

    if (error) {
      console.error("update_password.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message || "Failed to send password reset email",
      );
    }

    return passwordUpdated;
  },
  async getConfiguration(): Promise<ConfigurationContextValue> {
    const { data, error } = await supabase
      .from("configuration")
      .select("config")
      .eq("id", 1)
      .maybeSingle();
    if (error || data == null) {
      return withCurrentProductName({}) as ConfigurationContextValue;
    }
    const raw = (data.config as ConfigurationContextValue) ?? {};
    const config = withCurrentProductName(raw) as ConfigurationContextValue;

    if (!String(config.companyTimezone ?? "").trim()) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const authUserId = sessionData.session?.user?.id;
        if (authUserId) {
          const { data: member } = await supabase
            .from("organization_members")
            .select("org_id")
            .eq("user_id", authUserId)
            .maybeSingle();
          if (member?.org_id) {
            const { data: org } = await supabase
              .from("organizations")
              .select("booking_settings")
              .eq("id", member.org_id)
              .maybeSingle();
            const booking =
              org?.booking_settings != null &&
              typeof org.booking_settings === "object"
                ? (org.booking_settings as { timezone_label?: string })
                : null;
            const fromBooking = String(booking?.timezone_label ?? "").trim();
            if (fromBooking) {
              config.companyTimezone = fromBooking;
            }
          }
        }
      } catch {
        // Keep config as-is if booking settings are unavailable.
      }
    }

    return config;
  },
  async updateConfiguration(
    config: ConfigurationContextValue,
  ): Promise<ConfigurationContextValue> {
    const withTimezone: ConfigurationContextValue = {
      ...config,
      companyTimezone: resolveOrgTimezoneFromAddress({
        timezone: config.companyTimezone,
        stateAbbr: config.companyState,
        zipcode: config.companyPostalCode,
        country: config.companyCountry,
      }),
    };
    const row = await patchSingletonConfigurationRow(withTimezone);
    const saved = row.config as ConfigurationContextValue;
    const tz = String(saved.companyTimezone ?? withTimezone.companyTimezone ?? "").trim();
    if (tz) {
      try {
        await syncOrgBookingTimezone(tz);
      } catch (error) {
        console.error("updateConfiguration.syncTimezone", error);
      }
    }
    return saved;
  },
  async syncOrganizationPipelineStages(
    pipelines: DealPipeline[],
  ): Promise<void> {
    const { data: sessionData } = await supabase.auth.getSession();
    const authUserId = sessionData.session?.user?.id;
    if (!authUserId) {
      throw new Error("Not authenticated");
    }

    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .select("id, org_id")
      .eq("user_id", authUserId)
      .single();

    if (memberError || !member?.org_id) {
      throw new Error("Organization member not found");
    }

    for (const pipeline of pipelines) {
      const { error: deleteError } = await supabase
        .from("organization_pipeline_stages")
        .delete()
        .eq("org_id", member.org_id)
        .eq("pipeline_id", pipeline.id);

      if (deleteError) {
        console.error("syncOrganizationPipelineStages.delete", deleteError);
        throw new Error("Failed to reset pipeline stages");
      }

      const rows = pipeline.stages.map((stage, index) => {
        const label = stage.label.toLowerCase();
        return {
          org_id: member.org_id,
          pipeline_id: pipeline.id,
          key: stage.id,
          label: stage.label,
          color: stage.color || "#64748b",
          order_index: stage.order ?? index + 1,
          is_won:
            stage.id === "won" ||
            stage.id === "closed_won" ||
            label.includes("won"),
          is_lost: stage.id === "closed_lost" || label.includes("closed lost"),
        };
      });

      if (rows.length === 0) continue;

      const { error: insertError } = await supabase
        .from("organization_pipeline_stages")
        .insert(rows);

      if (insertError) {
        console.error("syncOrganizationPipelineStages.insert", insertError);
        throw new Error("Failed to save pipeline stages");
      }
    }

    invalidateResourceQueries("organization_pipeline_stages");
  },
  async syncOrganizationBookingTimezone(timezone: string): Promise<void> {
    await syncOrgBookingTimezone(timezone);
  },
  async ensureCalendarFeedToken(options?: { regenerate?: boolean }) {
    const { data, error } = await invokeEdgeFunction<{
      token: string;
      feed_url: string;
      webcal_url: string;
    }>("calendar_feed", {
      method: "POST",
      body: options ?? {},
    });

    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to load calendar subscription",
      );
    }

    if (!data?.token || !data.feed_url || !data.webcal_url) {
      throw new Error("Invalid calendar subscription response");
    }

    return data;
  },
  async getPlatformAuthUsers() {
    const { data, error } = await invokeEdgeFunction<{
      users: Array<{
        id: string;
        email: string | null;
        created_at: string;
        last_sign_in_at: string | null;
        email_confirmed_at: string | null;
      }>;
      total: number;
    }>("platform-directory", { method: "POST", body: {} });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ?? "Failed to list auth users",
      );
    }
    return data ?? { users: [], total: 0 };
  },
};
