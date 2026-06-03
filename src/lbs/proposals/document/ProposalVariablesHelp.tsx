import { Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PROPOSAL_DOCUMENT_VARIABLE_DEFINITIONS,
  type ProposalVariableContext,
} from "@/lbs/proposals/document/proposalVariableMerge";

export const ProposalVariablesHelp = ({
  variables,
  title = "Variables",
  hint = "Type these in any text field. They are replaced on the client view and in Preview as client.",
  syntaxLabel = "Syntax",
}: {
  variables?: ProposalVariableContext;
  title?: string;
  hint?: string;
  syntaxLabel?: string;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" size="sm">
        <Braces className="size-4" />
        {title}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-[min(100vw-2rem,380px)] p-0">
      <div className="border-b px-3 py-2.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          {syntaxLabel}:{" "}
          <code className="rounded bg-muted px-1">{"{{empresa}}"}</code>
        </p>
      </div>
      <ul className="max-h-[min(60vh,320px)] overflow-y-auto divide-y text-sm">
        {PROPOSAL_DOCUMENT_VARIABLE_DEFINITIONS.map((row) => {
          const value = variables?.[row.key];
          const preview =
            value != null && String(value).trim() !== ""
              ? String(value)
              : "—";
          return (
            <li key={row.key} className="px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {`{{${row.key}}}`}
                </code>
                <span className="truncate text-right text-xs font-medium text-foreground">
                  {preview}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.label} — {row.description}
              </p>
            </li>
          );
        })}
      </ul>
    </PopoverContent>
  </Popover>
);
