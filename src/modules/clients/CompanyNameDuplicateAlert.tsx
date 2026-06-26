import { Link } from "react-router";
import type { Company } from "@/components/atomic-crm/types";
import { getClientShowPath } from "@/app/routing";

type CompanyNameDuplicateAlertProps = {
  company: Company;
  onUseExisting?: (company: Company) => void;
};

export const CompanyNameDuplicateAlert = ({
  company,
  onUseExisting,
}: CompanyNameDuplicateAlertProps) => (
  <p className="text-sm">
    <span className="font-medium text-destructive">
      Company already exists.
    </span>
    {onUseExisting ? (
      <>
        {" "}
        <button
          type="button"
          className="text-destructive underline hover:opacity-80"
          onClick={() => onUseExisting(company)}
        >
          Use existing company
        </button>
      </>
    ) : null}
    {" · "}
    <Link
      to={getClientShowPath(company.id)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-destructive underline hover:opacity-80"
    >
      View company
    </Link>
  </p>
);
