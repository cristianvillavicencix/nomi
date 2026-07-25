import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  <section className={cn("flex flex-col gap-4", className)}>
    <h6 className="text-lg font-semibold">{title}</h6>
    {children}
  </section>
);
