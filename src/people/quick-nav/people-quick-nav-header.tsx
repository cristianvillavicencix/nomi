import { ChevronLeft, PanelLeftClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PeopleQuickNavHeader = ({
  title,
  subtitle,
  onBack,
  collapsed,
  onToggle,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  collapsed: boolean;
  onToggle: () => void;
}) => {
  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label="Expand quick navigation"
          title="Expand quick navigation"
          aria-expanded={false}
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
        <span className="mt-4 text-[10px] uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          {title}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="ghost" size="sm" className="h-8 gap-2 px-2" onClick={onBack}>
        <ChevronLeft className="h-4 w-4" />
        Regresar
      </Button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={onToggle}
          aria-label="Collapse quick navigation"
          title="Collapse quick navigation"
          aria-expanded={true}
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
