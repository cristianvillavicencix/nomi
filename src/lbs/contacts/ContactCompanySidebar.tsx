import { Link } from "react-router";
import { useGetOne, type Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import type { CompanyWithPrimaryContact } from "@/lbs/clients/clientProfile";
import {
  getPrimaryContactFullName,
  getPrimaryContactPhone,
} from "@/lbs/clients/clientProfile";
import { getClientShowPath } from "@/lbs/routing";

type ContactCompanySidebarProps = {
  companyId?: Identifier | null;
};

export const ContactCompanySidebar = ({
  companyId,
}: ContactCompanySidebarProps) => {
  const { data: company, isPending } = useGetOne<CompanyWithPrimaryContact>(
    "companies",
    { id: companyId! },
    { enabled: companyId != null },
  );

  if (!companyId) {
    return (
      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="text-sm font-semibold">Company</CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-4">
          <p className="text-sm text-muted-foreground">
            No company linked to this contact yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isPending || !company) return null;

  const companyName = company.name?.trim() || "—";
  const ownerName = getPrimaryContactFullName(company);
  const phone = getPrimaryContactPhone(company);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-3">
        <CardTitle className="text-sm font-semibold">Company</CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-4">
        <Link
          to={getClientShowPath(company.id)}
          className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40"
        >
          <CompanyAvatar record={company} width={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{companyName}</p>
            {ownerName !== "—" ? (
              <p className="truncate text-sm text-muted-foreground">
                {ownerName}
              </p>
            ) : null}
            {phone !== "—" ? (
              <p className="truncate text-sm text-muted-foreground">{phone}</p>
            ) : null}
            {company.city?.trim() ? (
              <p className="truncate text-sm text-muted-foreground">
                {company.city.trim()}
              </p>
            ) : null}
          </div>
        </Link>

        <Button
          asChild
          variant="link"
          size="sm"
          className="mt-3 h-auto px-0 link-action"
        >
          <Link to={getClientShowPath(company.id)}>View company profile</Link>
        </Button>
      </CardContent>
    </Card>
  );
};
