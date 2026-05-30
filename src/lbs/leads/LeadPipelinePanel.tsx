import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Contact } from "@/components/atomic-crm/types";
import { LeadStageChangeDialog } from "@/lbs/leads/LeadStageChangeDialog";
import {
  getLeadStageDef,
  LBS_LEAD_KANBAN_STAGES,
  normalizeLeadStage,
  type LeadStageId,
} from "@/lbs/leads/leadStages";
import { cn } from "@/lib/utils";

export const LeadPipelinePanel = ({
  lead,
  embedded = false,
}: {
  lead: Contact;
  embedded?: boolean;
}) => {
  const [targetStage, setTargetStage] = useState<LeadStageId | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const currentStage = normalizeLeadStage(lead.lead_stage);

  const openStageDialog = (nextStage: LeadStageId) => {
    if (nextStage === currentStage) return;
    setTargetStage(nextStage);
    setDialogOpen(true);
  };

  const visibleStages = LBS_LEAD_KANBAN_STAGES.filter(
    (stage) => !stage.terminal || stage.id === currentStage,
  );

  const currentIndex = visibleStages.findIndex(
    (stage) => stage.id === currentStage,
  );
  const currentDef = getLeadStageDef(currentStage);

  const body = (
    <>
      {!embedded ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Track this lead from first contact through conversion. Each stage
          change asks for a quick update so follow-up never gets lost.
        </p>
      ) : null}
      <div
        className="mb-5 rounded-lg border px-4 py-3"
        style={{
          borderColor: `${currentDef.color}55`,
          backgroundColor: `${currentDef.color}11`,
        }}
      >
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Current stage
        </p>
        <p
          className="mt-1 text-lg font-semibold"
          style={{ color: currentDef.color }}
        >
          {currentDef.label}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {currentDef.description}
        </p>
      </div>

      <ol className="space-y-0">
        {visibleStages.map((stage, index) => {
          const isCurrent = stage.id === currentStage;
          const isPast = currentIndex > -1 && index < currentIndex;

          return (
            <li key={stage.id} className="relative flex gap-3 pb-5 last:pb-0">
              {index < visibleStages.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[13px] top-7 h-[calc(100%-16px)] w-px",
                    isPast || isCurrent ? "bg-primary/40" : "bg-border",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : isPast
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                {isPast ? (
                  <Check className="size-4" />
                ) : (
                  <span className="size-2 rounded-full bg-current" />
                )}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isCurrent
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {stage.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {stage.description}
                    </p>
                  </div>
                  {!isCurrent ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 px-3 text-xs"
                      onClick={() => openStageDialog(stage.id)}
                    >
                      Move here
                    </Button>
                  ) : (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      Current
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {currentStage === "won" ? (
        <p className="mt-4 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          This lead is won and ready to convert. Use{" "}
          <span className="font-medium text-foreground">Convert to client</span>{" "}
          in the header to create the company and optional project.
        </p>
      ) : null}

      <LeadStageChangeDialog
        lead={lead}
        toStage={targetStage}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );

  if (embedded) return body;

  return (
    <Card className="gap-0 border-0 py-0 shadow-none">
      <CardHeader className="px-4 pt-4 pb-0">
        <CardTitle className="text-base font-semibold">Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-4">{body}</CardContent>
    </Card>
  );
};
