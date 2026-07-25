import { Building2, UserCheck } from "lucide-react";
import { getPortalHandoffExpectations } from "@/modules/portal/portalHandoffExpectations";
import type { PortalLocale } from "@/modules/portal/portalI18n";

const ExpectationList = ({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
}) => (
  <div className="rounded-lg border bg-muted/20 p-4">
    <div className="mb-3 flex items-center gap-2">
      <span className="text-brand">{icon}</span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
    <ul className="space-y-2 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

export const ClientHandoffSection = ({ locale }: { locale: PortalLocale }) => {
  const copy = getPortalHandoffExpectations(locale);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <ExpectationList
          title={copy.lbsTitle}
          items={copy.lbsItems}
          icon={<Building2 className="size-4" />}
        />
        <ExpectationList
          title={copy.clientTitle}
          items={copy.clientItems}
          icon={<UserCheck className="size-4" />}
        />
      </div>
      <p className="text-xs text-muted-foreground">{copy.footnote}</p>
    </div>
  );
};
