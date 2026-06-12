import { useRecordContext } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";

export const lbsProjectContactName = (record?: Partial<Contact> | null) =>
  `${record?.first_name ?? ""} ${record?.last_name ?? ""}`.trim();

const LbsProjectContactOptionRender = () => {
  const record = useRecordContext<Contact>();
  if (!record) return null;
  return <span className="truncate">{lbsProjectContactName(record)}</span>;
};

export const lbsProjectContactOptionText = <LbsProjectContactOptionRender />;
