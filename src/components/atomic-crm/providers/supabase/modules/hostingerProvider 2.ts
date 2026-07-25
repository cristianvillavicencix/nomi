import {
  invokeEdgeFunction,
  readEdgeFunctionErrorMessage,
} from "../invokeEdgeFunction";

export type HostingerSettingsPublic = {
  org_id: number;
  has_api_token: boolean;
  has_mail_api_token: boolean;
  weekly_sync_enabled: boolean;
  referral_code: string | null;
  referral_link_template: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
};

export type HostingerAvailabilityResult = {
  domain?: string | null;
  is_available?: boolean;
  is_alternative?: boolean;
  restriction?: string | null;
  tld?: string | null;
  price_cents?: number | null;
  first_period_price_cents?: number | null;
  renewal_price_cents?: number | null;
  currency?: string | null;
  catalog_item_id?: string | null;
  period_label?: string | null;
  is_promotional?: boolean;
};

export type HostingerAvailabilitySearchResponse = {
  ok?: boolean;
  results?: HostingerAvailabilityResult[];
  referral_code?: string | null;
  referral_link_template?: string | null;
};

export const hostingerProvider = {
  async getHostingerSettings() {
    const { data, error } = await invokeEdgeFunction<HostingerSettingsPublic>(
      "hostinger_settings",
      { method: "POST", body: { action: "get" } },
    );
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to load Hostinger settings",
        ),
      );
    }
    return data!;
  },

  async updateHostingerSettings(params: {
    apiToken?: string | null;
    mailApiToken?: string | null;
    keepExistingToken?: boolean;
    keepExistingMailToken?: boolean;
    weeklySyncEnabled?: boolean;
    referralCode?: string | null;
    referralLinkTemplate?: string | null;
  }) {
    const { data, error } = await invokeEdgeFunction<HostingerSettingsPublic>(
      "hostinger_settings",
      {
        method: "POST",
        body: {
          action: "update",
          api_token: params.apiToken ?? null,
          mail_api_token: params.mailApiToken ?? null,
          keepExistingToken: params.keepExistingToken === true,
          keepExistingMailToken: params.keepExistingMailToken === true,
          ...(params.weeklySyncEnabled !== undefined
            ? { weekly_sync_enabled: params.weeklySyncEnabled }
            : {}),
          ...(params.referralCode !== undefined
            ? { referral_code: params.referralCode }
            : {}),
          ...(params.referralLinkTemplate !== undefined
            ? { referral_link_template: params.referralLinkTemplate }
            : {}),
        },
      },
    );
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to update Hostinger settings",
        ),
      );
    }
    return data!;
  },

  async testHostingerConnection() {
    const { data, error } = await invokeEdgeFunction<{ ok?: boolean }>(
      "hostinger_settings",
      { method: "POST", body: { action: "test" } },
    );
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Hostinger connection test failed",
        ),
      );
    }
    return data ?? { ok: true };
  },

  async testHostingerMailConnection() {
    const { data, error } = await invokeEdgeFunction<{ ok?: boolean }>(
      "hostinger_settings",
      { method: "POST", body: { action: "test_mail" } },
    );
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Hostinger Mail connection test failed",
        ),
      );
    }
    return data ?? { ok: true };
  },

  async hostingerSync() {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      synced?: number;
      synced_at?: string;
    }>("hostinger_sync", { method: "POST", body: {} });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(error, "Failed to sync Hostinger domains"),
      );
    }
    return data ?? { ok: true, synced: 0 };
  },

  async hostingerCheckAvailability(params: {
    domain: string;
    tlds?: string[];
    withAlternatives?: boolean;
  }) {
    const { data, error } = await invokeEdgeFunction<HostingerAvailabilitySearchResponse>(
      "hostinger_availability", {
      method: "POST",
      body: {
        domain: params.domain,
        tlds: params.tlds,
        with_alternatives: params.withAlternatives,
      },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to check domain availability",
        ),
      );
    }
    return data ?? { ok: true, results: [] };
  },

  async hostingerGetDomainDetails(params: { domain: string }) {
    const { data, error } = await invokeEdgeFunction<
      import("@/modules/hostinger/types").HostingerDomainDetails
    >("hostinger_domain_details", {
      method: "POST",
      body: { domain: params.domain },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to load domain details",
        ),
      );
    }
    return data!;
  },
};
