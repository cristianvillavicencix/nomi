import { useRecordContext, WithRecord } from "ra-core";
import { ArrayField } from "@/components/admin/array-field";
import { SingleFieldList } from "@/components/admin/single-field-list";
import { PhoneField } from "@/components/admin/phone-field";
import { TextField } from "@/components/admin/text-field";
import { EmailField } from "@/components/admin/email-field";
import { Mail, Phone, Linkedin, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { mapsHref } from "@/lib/linking";
import { contactGender } from "./contactGender";
import type { Contact } from "../types";

export const ContactPersonalInfo = () => {
  const record = useRecordContext<Contact>();

  if (!record) return null;

  return (
    <div>
      <ArrayField source="email_jsonb">
        <SingleFieldList className="flex-col gap-y-0">
          <PersonalInfoRow
            icon={<Mail className="w-4 h-4 text-muted-foreground" />}
            primary={<EmailField source="email" />}
          />
        </SingleFieldList>
      </ArrayField>

      {record.has_newsletter && (
        <p className="pl-6 py-1 text-sm text-muted-foreground">
          Subscribed to newsletter
        </p>
      )}

      {record.linkedin_url && (
        <PersonalInfoRow
          icon={<Linkedin className="w-4 h-4 text-muted-foreground" />}
          primary={
            <a
              className="underline hover:no-underline text-sm text-muted-foreground"
              href={record.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              title={record.linkedin_url}
            >
              LinkedIn
            </a>
          }
        />
      )}
      <ArrayField source="phone_jsonb">
        <SingleFieldList className="flex-col gap-y-0">
          <PersonalInfoRow
            icon={<Phone className="w-4 h-4 text-muted-foreground" />}
            primary={<PhoneField source="number" />}
            showType
          />
        </SingleFieldList>
      </ArrayField>
      {record.address && (
        <PersonalInfoRow
          icon={<MapPin className="w-4 h-4 text-muted-foreground" />}
          primary={
            <a
              className="link-action text-sm text-muted-foreground"
              href={mapsHref(record.address)}
              target="_blank"
              rel="noreferrer"
              title={record.address}
            >
              {record.address}
            </a>
          }
        />
      )}
      {contactGender
        .map((genderOption) => {
          if (record.gender === genderOption.value) {
            return (
              <PersonalInfoRow
                key={genderOption.value}
                icon={
                  <genderOption.icon className="w-4 h-4 text-muted-foreground" />
                }
                primary={<div>{genderOption.label}</div>}
              />
            );
          }
          return null;
        })
        .filter(Boolean)}
    </div>
  );
};

const PersonalInfoRow = ({
  icon,
  primary,
  showType,
}: {
  icon: ReactNode;
  primary: ReactNode;
  showType?: boolean;
}) => (
  <div className="flex flex-row items-center gap-x-2 py-1 min-h-6">
    {icon}
    <div className="flex flex-wrap gap-x-2 gap-y-0 text-sm">
      {primary}
      {showType ? (
        <WithRecord
          render={(row) =>
            row.type !== "Other" && (
              <TextField source="type" className="text-muted-foreground" />
            )
          }
        />
      ) : null}
    </div>
  </div>
);
