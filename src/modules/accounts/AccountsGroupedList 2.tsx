import { AccountsCompaniesList } from "@/modules/accounts/AccountsCompaniesList";
import type { AccountsHubChrome } from "@/modules/accounts/AccountsModuleToolbar";

/**
 * Accounts List — company-first bill-to directory.
 * @see docs/plans/accounts-hub-DESIGN-DECISION.md
 */
export const AccountsGroupedList = ({
  accountsChrome,
}: {
  accountsChrome: AccountsHubChrome;
}) => <AccountsCompaniesList accountsChrome={accountsChrome} />;
