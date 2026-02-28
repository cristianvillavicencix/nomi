import { useRecordContext } from "ra-core";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { Company } from "../types";

type CompanyAvatarSource = Partial<
  Company & {
    company_name?: string | null;
    contact_name?: string | null;
    email?: string | null;
  }
>;

export const safeFirstChar = (value?: string | null) => {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized.charAt(0).toUpperCase() : "?";
};

export const getCompanyAvatarFallback = (record?: CompanyAvatarSource | null) => {
  const companyName = record?.name ?? record?.company_name;
  const contactName = record?.contact_name;
  const emailLocalPart = record?.email?.split("@")[0];

  return safeFirstChar(companyName) !== "?"
    ? safeFirstChar(companyName)
    : safeFirstChar(contactName) !== "?"
      ? safeFirstChar(contactName)
      : safeFirstChar(emailLocalPart);
};

export const CompanyAvatar = (props: {
  record?: Company;
  width?: 20 | 40;
  height?: 20 | 40;
}) => {
  const { width = 40 } = props;
  const record = useRecordContext<Company>(props);
  if (!record) return null;

  const sizeClass = width !== 40 ? `w-[20px] h-[20px]` : "w-10 h-10";
  const companyName = String(record.name ?? "").trim();
  const fallbackInitial = getCompanyAvatarFallback(record);

  if (import.meta.env.DEV && !companyName) {
    console.warn("CompanyAvatar received a record without a company name", {
      companyId: record.id,
      record,
    });
  }

  return (
    <Avatar className={sizeClass}>
      <AvatarImage
        src={record.logo?.src}
        alt={companyName || "Company"}
        className="object-contain"
      />
      <AvatarFallback className={width !== 40 ? "text-xs" : "text-sm"}>
        {fallbackInitial}
      </AvatarFallback>
    </Avatar>
  );
};
