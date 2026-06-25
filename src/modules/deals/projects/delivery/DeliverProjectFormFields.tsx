import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DealAccessEntry } from "@/modules/types";

type DeliverProjectFormFieldsProps = {
  idPrefix?: string;
  siteUrl: string;
  onSiteUrlChange: (value: string) => void;
  planName: string;
  onPlanNameChange: (value: string) => void;
  hostingProvider: string;
  onHostingProviderChange: (value: string) => void;
  hostingPanelUrl: string;
  onHostingPanelUrlChange: (value: string) => void;
  hostingLocation: string;
  onHostingLocationChange: (value: string) => void;
  hostingManagedBy: "lbs" | "client";
  onHostingManagedByChange: (value: "lbs" | "client") => void;
  hostingRenewalDate: string;
  onHostingRenewalDateChange: (value: string) => void;
  domainName: string;
  onDomainNameChange: (value: string) => void;
  domainRegistrar: string;
  onDomainRegistrarChange: (value: string) => void;
  domainRenewalDate: string;
  onDomainRenewalDateChange: (value: string) => void;
  domainManagedBy: "lbs" | "client";
  onDomainManagedByChange: (value: "lbs" | "client") => void;
  domainDnsServers: string;
  onDomainDnsServersChange: (value: string) => void;
  corporateEmailsText: string;
  onCorporateEmailsTextChange: (value: string) => void;
  credentials: DealAccessEntry[];
  shareCredentialIds: number[];
  onToggleCredential: (entryId: number) => void;
  notifyPortal: boolean;
  onNotifyPortalChange: (value: boolean) => void;
  notifyEmail: boolean;
  onNotifyEmailChange: (value: boolean) => void;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  showConfirmation?: boolean;
};

export const DeliverProjectFormFields = ({
  idPrefix = "delivery",
  siteUrl,
  onSiteUrlChange,
  planName,
  onPlanNameChange,
  hostingProvider,
  onHostingProviderChange,
  hostingPanelUrl,
  onHostingPanelUrlChange,
  hostingLocation,
  onHostingLocationChange,
  hostingManagedBy,
  onHostingManagedByChange,
  hostingRenewalDate,
  onHostingRenewalDateChange,
  domainName,
  onDomainNameChange,
  domainRegistrar,
  onDomainRegistrarChange,
  domainRenewalDate,
  onDomainRenewalDateChange,
  domainManagedBy,
  onDomainManagedByChange,
  domainDnsServers,
  onDomainDnsServersChange,
  corporateEmailsText,
  onCorporateEmailsTextChange,
  credentials,
  shareCredentialIds,
  onToggleCredential,
  notifyPortal,
  onNotifyPortalChange,
  notifyEmail,
  onNotifyEmailChange,
  confirmed,
  onConfirmedChange,
  showConfirmation = true,
}: DeliverProjectFormFieldsProps) => (
  <div className="space-y-6 py-1">
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-site-url`}>Live site URL</Label>
      <Input
        id={`${idPrefix}-site-url`}
        value={siteUrl}
        onChange={(event) => onSiteUrlChange(event.target.value)}
        placeholder="www.clientdomain.com"
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-plan-name`}>Plan name</Label>
      <Input
        id={`${idPrefix}-plan-name`}
        value={planName}
        onChange={(event) => onPlanNameChange(event.target.value)}
        placeholder="Website + hosting"
      />
    </div>

    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Hosting (client portal)</h3>
        <p className="text-xs text-muted-foreground">
          Shown on the Hosting tab — provider, location, and renewal.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-hosting-provider`}>Hosting provider</Label>
          <Input
            id={`${idPrefix}-hosting-provider`}
            value={hostingProvider}
            onChange={(event) => onHostingProviderChange(event.target.value)}
            placeholder="Hostinger, SiteGround, Cloudways…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-hosting-location`}>Server location</Label>
          <Input
            id={`${idPrefix}-hosting-location`}
            value={hostingLocation}
            onChange={(event) => onHostingLocationChange(event.target.value)}
            placeholder="United States, Europe…"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-hosting-panel`}>Hosting panel URL</Label>
          <Input
            id={`${idPrefix}-hosting-panel`}
            value={hostingPanelUrl}
            onChange={(event) => onHostingPanelUrlChange(event.target.value)}
            placeholder="https://hpanel.hostinger.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-hosting-renewal`}>Hosting renewal</Label>
          <Input
            id={`${idPrefix}-hosting-renewal`}
            type="date"
            value={hostingRenewalDate}
            onChange={(event) => onHostingRenewalDateChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Managed by</Label>
          <Select
            value={hostingManagedBy}
            onValueChange={(value) =>
              onHostingManagedByChange(value as "lbs" | "client")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lbs">LBS</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>

    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Domain (client portal)</h3>
        <p className="text-xs text-muted-foreground">
          Shown on the Domain tab — registrar, DNS, and renewal.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-domain-name`}>Domain</Label>
          <Input
            id={`${idPrefix}-domain-name`}
            value={domainName}
            onChange={(event) => onDomainNameChange(event.target.value)}
            placeholder="clientdomain.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-domain-registrar`}>Registrar</Label>
          <Input
            id={`${idPrefix}-domain-registrar`}
            value={domainRegistrar}
            onChange={(event) => onDomainRegistrarChange(event.target.value)}
            placeholder="GoDaddy, Namecheap…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-domain-renewal`}>Domain renewal</Label>
          <Input
            id={`${idPrefix}-domain-renewal`}
            type="date"
            value={domainRenewalDate}
            onChange={(event) => onDomainRenewalDateChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Managed by</Label>
          <Select
            value={domainManagedBy}
            onValueChange={(value) =>
              onDomainManagedByChange(value as "lbs" | "client")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lbs">LBS</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-dns-servers`}>DNS servers</Label>
          <Input
            id={`${idPrefix}-dns-servers`}
            value={domainDnsServers}
            onChange={(event) => onDomainDnsServersChange(event.target.value)}
            placeholder="ns1.hostinger.com, ns2.hostinger.com"
          />
        </div>
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-corporate-emails`}>Corporate emails</Label>
      <textarea
        id={`${idPrefix}-corporate-emails`}
        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-20 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        value={corporateEmailsText}
        onChange={(event) => onCorporateEmailsTextChange(event.target.value)}
        placeholder={"info@clientdomain.com\nsales@clientdomain.com"}
      />
      <p className="text-xs text-muted-foreground">
        One email per line. Shown under Credentials in the client portal.
      </p>
    </div>

    {credentials.length > 0 ? (
      <div className="space-y-2">
        <Label>Credentials to share with client</Label>
        <p className="text-xs text-muted-foreground">
          Passwords and logins shown in the client portal Credentials tab.
        </p>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
          {credentials.map((entry) => (
            <label key={entry.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={shareCredentialIds.includes(Number(entry.id))}
                onCheckedChange={() => onToggleCredential(Number(entry.id))}
              />
              {entry.label}
            </label>
          ))}
        </div>
      </div>
    ) : (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        No credentials on file yet. Add them under Security before delivering, or
        deliver now and share credentials later from the project.
      </p>
    )}

    {showConfirmation ? (
      <div className="space-y-2 rounded-md border p-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={notifyPortal}
            onCheckedChange={(value) => onNotifyPortalChange(Boolean(value))}
          />
          Notify client inside portal
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={notifyEmail}
            onCheckedChange={(value) => onNotifyEmailChange(Boolean(value))}
          />
          Send delivery email
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={confirmed}
            onCheckedChange={(value) => onConfirmedChange(Boolean(value))}
          />
          I reviewed the credentials and site URL — ready to deliver
        </label>
      </div>
    ) : null}
  </div>
);
