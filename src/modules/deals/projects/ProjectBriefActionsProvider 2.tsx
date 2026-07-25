import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useGetOne, useNotify } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import {
  getContactEmail,
  getContactFullName,
} from "@/modules/clients/clientShowUtils";
import { ManualHandoffDialog } from "@/modules/deals/ManualHandoffDialog";
import { isBriefRequirementsWaived } from "@/modules/deals/projectManualHandoff";
import type { BriefRequestScope } from "@/modules/deals/projectBriefRequestScope";
import { SendProjectWebFormDialog } from "@/modules/deals/SendProjectWebFormDialog";
import { WebsiteBriefSectionSheet } from "@/modules/deals/WebsiteBriefSectionSheet";
import { downloadProjectBriefMarkdown } from "@/modules/deals/exportProjectBriefMarkdown";
import { useBriefPrefilledRecord } from "@/modules/deals/websiteBriefEditorShared";
import type { LbsDeal } from "@/modules/types";

type ProjectBriefActionsContextValue = {
  openRequestBrief: (scope?: BriefRequestScope) => void;
  openFillAllSections: () => void;
  openManualHandoff: () => void;
  exportBrief: () => void;
  isManualHandoffActive: boolean;
};

const ProjectBriefActionsContext =
  createContext<ProjectBriefActionsContextValue | null>(null);

export const useProjectBriefActions = () => {
  const ctx = useContext(ProjectBriefActionsContext);
  if (!ctx) {
    throw new Error(
      "useProjectBriefActions must be used within ProjectBriefActionsProvider",
    );
  }
  return ctx;
};

export const useProjectBriefActionsOptional = () =>
  useContext(ProjectBriefActionsContext);

export const ProjectBriefActionsProvider = ({
  record,
  children,
}: {
  record: LbsDeal;
  children: ReactNode;
}) => {
  const notify = useNotify();
  const prefilledRecord = useBriefPrefilledRecord(record, true);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendScope, setSendScope] = useState<BriefRequestScope | undefined>();
  const [fillAllOpen, setFillAllOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);

  const contactId =
    record.contact_id ??
    (Array.isArray(record.contact_ids) ? record.contact_ids[0] : null);

  const { data: contact } = useGetOne<Contact>(
    "contacts_summary",
    { id: contactId as number },
    { enabled: contactId != null },
  );

  const openRequestBrief = useCallback((scope?: BriefRequestScope) => {
    setSendScope(scope);
    setSendOpen(true);
  }, []);

  const exportBrief = useCallback(() => {
    const filename = downloadProjectBriefMarkdown(prefilledRecord);
    notify(`Exported ${filename}`, { type: "info" });
  }, [notify, prefilledRecord]);

  const value = useMemo(
    () => ({
      openRequestBrief,
      openFillAllSections: () => setFillAllOpen(true),
      openManualHandoff: () => setHandoffOpen(true),
      exportBrief,
      isManualHandoffActive: isBriefRequirementsWaived(record),
    }),
    [exportBrief, openRequestBrief, record],
  );

  return (
    <ProjectBriefActionsContext.Provider value={value}>
      {children}

      <ManualHandoffDialog
        record={record}
        open={handoffOpen}
        onOpenChange={setHandoffOpen}
      />

      <WebsiteBriefSectionSheet
        record={record}
        target={fillAllOpen ? { kind: "all" } : null}
        initialMode="edit"
        onClose={() => setFillAllOpen(false)}
      />

      <SendProjectWebFormDialog
        open={sendOpen}
        onClose={() => {
          setSendOpen(false);
          setSendScope(undefined);
        }}
        dealId={record.id}
        companyId={record.company_id}
        contactId={contactId}
        clientEmail={contact ? getContactEmail(contact) : undefined}
        clientName={contact ? getContactFullName(contact) : undefined}
        projectName={record.name}
        projectType={record.project_type}
        dealRecord={record}
        requestScope={sendScope}
      />
    </ProjectBriefActionsContext.Provider>
  );
};
