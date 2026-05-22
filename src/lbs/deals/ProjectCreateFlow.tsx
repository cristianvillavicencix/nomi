import { useEffect, useRef, useState } from "react";
import { useGetOne, useRedirect } from "ra-core";
import { matchPath, useLocation, useSearchParams } from "react-router";
import { DealCreate } from "@/components/atomic-crm/deals/DealCreate";
import { NewProjectChooserDialog } from "@/lbs/deals/NewProjectChooserDialog";
import { SendProjectWebFormDialog } from "@/lbs/deals/SendProjectWebFormDialog";

type ProjectCreateFlowProps = {
  onClose?: () => void;
};

type CreateStep = "chooser" | "manual" | "web-form";

const getStepFromRoute = (
  pathname: string,
  presetMode: string | null,
): CreateStep | null => {
  if (!matchPath("/deals/create", pathname)) return null;
  if (presetMode === "manual") return "manual";
  if (presetMode === "web-form") return "web-form";
  return "chooser";
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
  const suppressChooserCloseRef = useRef(false);

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

  const goToManual = () => {
    suppressChooserCloseRef.current = true;
    setStep("manual");
  };

  const goToWebForm = () => {
    suppressChooserCloseRef.current = true;
    setStep("web-form");
  };

  const handleChooserClose = () => {
    if (suppressChooserCloseRef.current) {
      suppressChooserCloseRef.current = false;
      return;
    }
    closeAll();
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
    : company?.name ?? "";

  if (!matchCreate || !step) return null;

  return (
    <>
      <NewProjectChooserDialog
        open={step === "chooser"}
        onManual={goToManual}
        onWebForm={goToWebForm}
        onClose={handleChooserClose}
      />
      {step === "manual" ? <DealCreate open onClose={closeAll} /> : null}
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
) => {
  const params = new URLSearchParams();
  if (companyId != null) params.set("company_id", String(companyId));
  if (contactId != null) params.set("contact_id", String(contactId));
  const query = params.toString();
  return query ? `/deals/create?${query}` : "/deals/create";
};
