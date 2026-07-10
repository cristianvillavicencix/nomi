import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react";
import { Link } from "react-router";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IntegrationFeatureSwitchRow } from "@/modules/settings/integrations/IntegrationFeatureSwitchRow";
import { IntegrationPanelHeader } from "@/modules/settings/integrations/IntegrationPanelHeader";
import {
  getHostingerApiTokenUrl,
  getHostingerHpanelHomeUrl,
} from "@/modules/hostinger/hostingerHpanelLinks";
import { getHostingerPath } from "@/app/routing";

export const HostingerIntegrationPanel = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [apiToken, setApiToken] = useState("");
  const [mailApiToken, setMailApiToken] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralLinkTemplate, setReferralLinkTemplate] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["hostinger_settings"],
    queryFn: () => dataProvider.getHostingerSettings(),
  });

  const referralSaveMutation = useMutation({
    mutationFn: () =>
      dataProvider.updateHostingerSettings({
        keepExistingToken: true,
        referralCode: referralCode.trim() || null,
        referralLinkTemplate: referralLinkTemplate.trim() || null,
      }),
    onSuccess: () => {
      notify("Referral settings saved", { type: "success" });
      queryClient.invalidateQueries({ queryKey: ["hostinger_settings"] });
    },
    onError: (error: unknown) => {
      notify(
        error instanceof Error ? error.message : "Failed to save referral settings",
        { type: "error" },
      );
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = apiToken.trim();
      if (!trimmed && !hasToken) {
        throw new Error("API token is required");
      }
      return dataProvider.updateHostingerSettings({
        apiToken: trimmed || null,
        keepExistingToken: !trimmed && hasToken,
      });
    },
    onSuccess: () => {
      notify("Hostinger settings saved", { type: "success" });
      setApiToken("");
      queryClient.invalidateQueries({ queryKey: ["hostinger_settings"] });
    },
    onError: (error: unknown) => {
      notify(error instanceof Error ? error.message : "Failed to save settings", {
        type: "error",
      });
    },
  });

  const weeklySyncMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      dataProvider.updateHostingerSettings({
        keepExistingToken: true,
        weeklySyncEnabled: enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostinger_settings"] });
    },
    onError: (error: unknown) => {
      notify(
        error instanceof Error ? error.message : "Failed to update auto-sync",
        { type: "error" },
      );
    },
  });

  const mailTestMutation = useMutation({
    mutationFn: () => dataProvider.testHostingerMailConnection(),
    onSuccess: () => {
      notify("Hostinger Mail connection successful", { type: "success" });
    },
    onError: (error: unknown) => {
      notify(
        error instanceof Error ? error.message : "Mail connection test failed",
        { type: "error" },
      );
    },
  });

  const mailSaveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = mailApiToken.trim();
      if (!trimmed && !hasMailToken) {
        throw new Error("Mail API token is required");
      }
      return dataProvider.updateHostingerSettings({
        keepExistingToken: true,
        keepExistingMailToken: !trimmed && hasMailToken,
        mailApiToken: trimmed || null,
      });
    },
    onSuccess: () => {
      notify("Hostinger Mail settings saved", { type: "success" });
      setMailApiToken("");
      queryClient.invalidateQueries({ queryKey: ["hostinger_settings"] });
    },
    onError: (error: unknown) => {
      notify(
        error instanceof Error ? error.message : "Failed to save mail settings",
        { type: "error" },
      );
    },
  });

  const testMutation = useMutation({
    mutationFn: () => dataProvider.testHostingerConnection(),
    onSuccess: () => {
      notify("Hostinger connection successful", { type: "success" });
    },
    onError: (error: unknown) => {
      notify(error instanceof Error ? error.message : "Connection test failed", {
        type: "error",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => dataProvider.hostingerSync(),
    onSuccess: (data) => {
      notify(`Synced ${data.synced ?? 0} domains`, { type: "success" });
      queryClient.invalidateQueries({ queryKey: ["hostinger_settings"] });
      queryClient.invalidateQueries({ queryKey: ["hostinger_domains"] });
    },
    onError: (error: unknown) => {
      notify(error instanceof Error ? error.message : "Sync failed", {
        type: "error",
      });
    },
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setReferralCode(settingsQuery.data.referral_code ?? "");
    setReferralLinkTemplate(settingsQuery.data.referral_link_template ?? "");
  }, [settingsQuery.data]);

  if (settingsQuery.isPending) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading Hostinger…
      </div>
    );
  }

  const hasToken = settingsQuery.data?.has_api_token === true;
  const hasMailToken = settingsQuery.data?.has_mail_api_token === true;
  const weeklySyncEnabled = settingsQuery.data?.weekly_sync_enabled !== false;
  const canSave = apiToken.trim().length > 0;
  const canSaveMail = mailApiToken.trim().length > 0;

  return (
    <div className="space-y-6">
      <IntegrationPanelHeader
        title="Hostinger"
        description="Sync your domain portfolio, track expirations, and check availability from Nomi."
        status={hasToken ? "connected" : "off"}
        badgeLabel={hasToken ? "Active" : undefined}
        meta={
          settingsQuery.data?.last_synced_at
            ? `Last synced ${new Date(settingsQuery.data.last_synced_at).toLocaleString()}`
            : undefined
        }
        actions={
          hasToken ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to={getHostingerPath()}>
                  <Server className="mr-1.5 size-4" />
                  Open portfolio
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={getHostingerHpanelHomeUrl()} target="_blank" rel="noreferrer">
                  hPanel
                  <ExternalLink className="ml-1.5 size-3.5" />
                </a>
              </Button>
            </>
          ) : null
        }
      />

      <Alert>
        <AlertDescription>
          API tokens are stored encrypted server-side. Create one in{" "}
          <a
            href={getHostingerApiTokenUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium underline"
          >
            hPanel → API
            <ExternalLink className="size-3.5" />
          </a>
          .
        </AlertDescription>
      </Alert>

      <IntegrationFeatureSwitchRow
        label="Hostinger integration"
        description="Stays active once an API token is saved. Portfolio sync is available anytime."
        checked={hasToken}
        disabled
        onCheckedChange={() => undefined}
      />

      <IntegrationFeatureSwitchRow
        label="Auto-sync weekly"
        description="Refresh your domain portfolio every Monday at 6:00 UTC. You can still sync manually anytime."
        checked={weeklySyncEnabled}
        disabled={!hasToken || weeklySyncMutation.isPending}
        onCheckedChange={(checked) => weeklySyncMutation.mutate(checked)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hostinger-api-token">API token</Label>
            <Input
              id="hostinger-api-token"
              type="password"
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              placeholder={
                hasToken
                  ? "Token saved — enter new value to replace"
                  : "Paste API token"
              }
              autoComplete="off"
            />
            {hasToken ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                Token configured for this organization
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !canSave}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : null}
              Save token
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !hasToken}
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : null}
              Test connection
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !hasToken}
            >
              {syncMutation.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 size-4" />
              )}
              Sync now
            </Button>
          </div>

          {settingsQuery.data?.last_sync_error ? (
            <p className="text-xs text-destructive">
              Last sync error: {settingsQuery.data.last_sync_error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email mailboxes (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Optional. Lists corporate mailboxes per domain in the Hostinger hub.
            Create the token in hPanel → Emails → any domain → Agentic mail →
            API, with scope <strong>All mailboxes</strong>.
          </p>
          <div className="space-y-2">
            <Label htmlFor="hostinger-mail-api-token">Mail API token</Label>
            <Input
              id="hostinger-mail-api-token"
              type="password"
              value={mailApiToken}
              onChange={(event) => setMailApiToken(event.target.value)}
              placeholder={
                hasMailToken
                  ? "Token saved — enter new value to replace"
                  : "Paste Mail API token"
              }
              autoComplete="off"
            />
            {hasMailToken ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                Mail token configured for this organization
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => mailSaveMutation.mutate()}
              disabled={mailSaveMutation.isPending || !canSaveMail}
            >
              {mailSaveMutation.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : null}
              Save mail token
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => mailTestMutation.mutate()}
              disabled={mailTestMutation.isPending || !hasMailToken}
            >
              {mailTestMutation.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : null}
              Test mail connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referral purchase links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Used by the Search tab &quot;Referral&quot; button when a domain is
            available. Paste your Hostinger affiliate or referral code from the
            partner dashboard.
          </p>
          <div className="space-y-2">
            <Label htmlFor="hostinger-referral-code">Referral code</Label>
            <Input
              id="hostinger-referral-code"
              value={referralCode}
              onChange={(event) => setReferralCode(event.target.value)}
              placeholder="Your REFERRALCODE"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hostinger-referral-template">
              Purchase URL template (optional)
            </Label>
            <Input
              id="hostinger-referral-template"
              value={referralLinkTemplate}
              onChange={(event) => setReferralLinkTemplate(event.target.value)}
              placeholder="https://www.hostinger.com/domain?domain={domain}&REFERRALCODE={code}"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Placeholders: {"{domain}"} and {"{code}"}. Leave blank for the
              default Hostinger domain checkout URL.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => referralSaveMutation.mutate()}
            disabled={referralSaveMutation.isPending}
          >
            {referralSaveMutation.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : null}
            Save referral settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
