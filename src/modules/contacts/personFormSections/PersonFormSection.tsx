import type { ReactNode } from "react";
import { CreateFormSection } from "@/modules/shared/createForm/CreateFormLayout";

type PersonFormSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

/** Section heading for the unified person create form. */
export const PersonFormSection = ({
  title,
  children,
  className,
}: PersonFormSectionProps) => (
  <CreateFormSection title={title} className={className}>
    {children}
  </CreateFormSection>
);
