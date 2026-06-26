import { getProjectPortalShortUrl } from "@/modules/portal/useProjectPortalLink";
import type { LbsDeal } from "@/modules/types";

type ProjectDeliveryEmailPreviewProps = {
  record: LbsDeal;
  clientEmail: string;
  portalShortCode?: string | null;
  siteUrl: string;
  notifyEmail: boolean;
};

export const ProjectDeliveryEmailPreview = ({
  record,
  clientEmail,
  portalShortCode,
  siteUrl,
  notifyEmail,
}: ProjectDeliveryEmailPreviewProps) => {
  const firstName = clientEmail.split("@")[0]?.split(".")[0] ?? "there";
  const portalPath = portalShortCode
    ? getProjectPortalShortUrl(portalShortCode).replace(
        typeof window !== "undefined" ? window.location.origin : "",
        "",
      )
    : "/p/········";
  const normalizedSite = siteUrl.trim();

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Email preview
      </p>
      <div className="overflow-hidden rounded-lg border bg-card text-sm shadow-sm">
        <div className="space-y-1 border-b bg-muted/30 px-4 py-3">
          <div>
            <span className="text-muted-foreground">To: </span>
            <span>{clientEmail || "client@example.com"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Subject: </span>
            <span>Your website {record.name} is ready</span>
          </div>
        </div>
        <div className="space-y-4 px-4 py-5">
          <p>Hi {firstName},</p>
          <p className="text-muted-foreground">
            Your website project is complete and ready for you to review. Open
            your client portal with the link below — no password, just one
            click.
          </p>
          {normalizedSite ? (
            <p className="text-muted-foreground">
              Live site:{" "}
              <span className="font-medium text-foreground">
                {normalizedSite}
              </span>
            </p>
          ) : null}
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="text-xs text-muted-foreground">
              Your access link
            </div>
            <div className="mt-1 font-mono text-sm text-primary">
              {portalPath}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              This link is personal and non-transferable.
            </div>
          </div>
          <p className="text-muted-foreground">
            In your portal you will find: website details, credentials (with
            OTP), project files, domain & DNS, and your maintenance plan.
          </p>
        </div>
      </div>
      {!notifyEmail ? (
        <p className="text-xs text-muted-foreground">
          Delivery email is turned off. The client will not receive this message
          until email delivery is enabled on the backend.
        </p>
      ) : null}
    </div>
  );
};
