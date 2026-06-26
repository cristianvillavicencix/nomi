import { genericMemo, useFieldValue, useTranslate } from "ra-core";
import type { ButtonHTMLAttributes } from "react";
import React from "react";
import { normalizePhoneForTel } from "@/lib/linking";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
import type { FieldProps } from "@/lib/field.type";

const PhoneFieldImpl = <
  RecordType extends Record<string, unknown> = Record<string, unknown>,
>(
  inProps: PhoneFieldProps<RecordType>,
) => {
  const { className, empty, defaultValue, source, record, value, ...rest } =
    inProps;
  const fieldValue = useFieldValue({ defaultValue, source, record });
  const translate = useTranslate();
  const resolvedValue = value ?? fieldValue;

  if (resolvedValue == null || resolvedValue === "") {
    if (!empty) {
      return null;
    }

    return (
      <span className={className} {...rest}>
        {typeof empty === "string" ? translate(empty, { _: empty }) : empty}
      </span>
    );
  }

  const { display, e164 } = normalizePhoneForTel(String(resolvedValue));
  if (!e164) {
    return (
      <span className={className} {...rest}>
        {display}
      </span>
    );
  }

  return (
    <CrmPhoneLink
      phone={String(resolvedValue)}
      className={className}
      onClick={stopPropagation}
    />
  );
};

PhoneFieldImpl.displayName = "PhoneFieldImpl";

export const PhoneField = genericMemo(PhoneFieldImpl);

export interface PhoneFieldProps<
  RecordType extends Record<string, unknown> = Record<string, unknown>,
> extends FieldProps<RecordType>,
    ButtonHTMLAttributes<HTMLButtonElement> {
  value?: string | null;
}

const stopPropagation = (e: React.MouseEvent<HTMLButtonElement>) =>
  e.stopPropagation();
