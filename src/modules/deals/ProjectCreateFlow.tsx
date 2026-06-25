import { useEffect, useState } from "react";
import { useGetOne, useRedirect } from "ra-core";
import { matchPath, useLocation, useSearchParams } from "react-router";
import { AgencyProjectCreateForm } from "@/modules/deals/projects/AgencyProjectCreateForm";
import { SendProjectWebFormDialog } from "@/modules/deals/SendProjectWebFormDialog";
import {
  buildProjectCreatePath,
  type ProjectCreateMode,
} from "@/modules/deals/projectCreatePaths";

type ProjectCreateFlowProps = {
  onClose?: () => void;
};

type CreateStep = ProjectCreateMode;

const getStepFromRoute = (
  pathname: string,
  presetMode: string | null,
): CreateStep | null => {
  if (!matchPath("/deals/create", pathname)) return null;
  if (presetMode === "web-form") return "web-form";
  return "manual";
};

export const ProjectCreateFlow = ({ onClose }: ProjectCreateFlowProps) => {
  const location = useLocation();
  const redirect = useRedirect();
  const [searchParams] = useSearchParams();
  const matchCreate = matchPath("/deals/create", location.pathname);

  const companyId = searchParams.get("company_id");
  const contactId = searchParams.get("contact_id");
  const presetMode = searchParams.get("mode");

  const [step, setStep] = useState<CreateStep | null>(() =>
    getStepFromRoute(location.pathname, presetMode),
  );

  useEffect(() => {
    setStep(getStepFromRoute(location.pathname, presetMode));
  }, [location.pathname, presetMode]);

  const closeAll = () => {
    if (onClose) {
      onClose();
      return;
    }
    redirect("/deals");
  };

  const { data: company } = useGetOne(
    "companies",
    { id: companyId! },
    { enabled: !!companyId && step === "web-form" },
  );

  const { data: contact } = useGetOne(
    "contacts",
    { id: contactId! },
    { enabled: !!contactId && step === "web-form" },
  );

  const clientEmail =
    contact?.email_jsonb?.find((entry) => entry.email?.trim())?.email ?? "";
  const clientName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
    : (company?.name ?? "");

  if (!matchCreate || !step) return null;

  return (
    <>
      {step === "manual" ? (
        <AgencyProjectCreateForm open onClose={closeAll} />
      ) : null}
      {step === "web-form" ? (
        <SendProjectWebFormDialog
          open
          onClose={closeAll}
          companyId={companyId}
          contactId={contactId}
          clientEmail={clientEmail}
          clientName={clientName}
        />
      ) : null}
    </>
  );
};

export const openProjectCreatePath = (
  companyId?: string | number | null,
  contactId?: string | number | null,
  mode: ProjectCreateMode = "manual",
) => buildProjectCreatePath({ companyId, contactId, mode });
