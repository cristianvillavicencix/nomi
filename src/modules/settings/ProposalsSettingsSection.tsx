import { Link } from "react-router";
import { ContractTermsSettings } from "@/modules/settings/ContractTermsSettings";

/** Kept for Settings → Proposals; canonical home is Contracts → Templates. */
export const ProposalsSettingsSection = () => (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Contract templates also live under{" "}
      <Link
        to="/contracts?tab=templates"
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        Contracts → Templates
      </Link>
      .
    </p>
    <ContractTermsSettings embedded />
  </div>
);
