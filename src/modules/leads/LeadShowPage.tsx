import { LeadsListPage } from "@/modules/leads/LeadsListPage";
import { LeadShowToPersonRedirect } from "@/modules/leads/LeadShowToPersonRedirect";

/**
 * @deprecated Prefer {@link LeadShowToPersonRedirect} for `/leads/:id/show`.
 * Kept for any residual imports of the page name.
 */
export const LeadShowPage = () => <LeadShowToPersonRedirect />;

/** @deprecated list shell — Accounts Board embeds LeadsBoardPanel instead. */
export const LeadShowPageLegacyListShell = () => <LeadsListPage />;
