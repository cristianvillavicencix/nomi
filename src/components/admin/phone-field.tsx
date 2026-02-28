import { genericMemo, useFieldValue, useTranslate } from "ra-core";
import type { AnchorHTMLAttributes } from "react";
import React from "react";
import { cn } from "@/lib/utils";
import type { FieldProps } from "@/lib/field.type";
import {
  formatUsPhoneDisplayFromAny,
  getPhoneHref,
  isValidUsPhone,
} from "@/utils/phone";

const PhoneFieldImpl = <
  RecordType extends Record<string, any> = Record<string, any>,
>(
  inProps: PhoneFieldProps<RecordType>,
) => {
  const {
    className,
    empty,
    defaultValue,
    source,
    record,
    value,
    ...rest
  } = inProps;
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

  const displayValue = formatUsPhoneDisplayFromAny(String(resolvedValue));
  const href = getPhoneHref(String(resolvedValue));

  if (!href || !isValidUsPhone(String(resolvedValue))) {
    return (
      <span className={className} {...rest}>
        {displayValue}
      </span>
    );
  }

  return (
    <a
      className={cn("underline hover:no-underline", className)}
      href={href}
      onClick={stopPropagation}
      {...rest}
    >
      {displayValue}
    </a>
  );
};

PhoneFieldImpl.displayName = "PhoneFieldImpl";

export const PhoneField = genericMemo(PhoneFieldImpl);

export interface PhoneFieldProps<
  RecordType extends Record<string, any> = Record<string, any>,
> extends FieldProps<RecordType>,
    AnchorHTMLAttributes<HTMLAnchorElement> {
  value?: string | null;
}

const stopPropagation = (e: React.MouseEvent<HTMLAnchorElement>) =>
  e.stopPropagation();

