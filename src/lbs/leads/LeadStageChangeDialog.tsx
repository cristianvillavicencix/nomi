import { useEffect, useMemo, useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
  useUpdate,
  type Identifier,
} from "ra-core";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type { Contact } from "@/components/atomic-crm/types";
import { cn } from "@/lib/utils";
import { applyLeadStageChange } from "@/lbs/leads/applyLeadStageChange";
import {
  formatFollowUpDateTimeLabel,
  toDateTimeLocalValue,
} from "@/lbs/leads/leadFollowUpDateTime";
import {
  getDefaultTransitionValues,
  getLeadStageTransitionConfig,
  type LeadTransitionField,
} from "@/lbs/leads/leadStageTransitionConfig";
import {
  getLeadStageDef,
  normalizeLeadStage,
  type LeadStageId,
} from "@/lbs/leads/leadStages";

type LeadStageChangeDialogProps = {
  lead: Contact;
  toStage: LeadStageId | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

type WizardStep =
  | { kind: "intro" }
  | { kind: "field"; field: LeadTransitionField; hint: string }
  | { kind: "review" };

const STAGE_VIBE: Record<
  LeadStageId,
  { emoji: string; intro: string; celebrate?: boolean }
> = {
  new: {
    emoji: "🔄",
    intro: "Vamos a registrar por qué este lead vuelve al inicio.",
  },
  contacted: {
    emoji: "📞",
    intro: "¡Primer contacto hecho! Cuéntanos cómo fue para no perder el hilo.",
  },
  talking: {
    emoji: "💬",
    intro: "Hay conversación activa — documenta el avance en un minuto.",
  },
  quoted: {
    emoji: "📄",
    intro: "Propuesta enviada. Deja claro qué mandaste y cuándo volver a tocar base.",
  },
  closing: {
    emoji: "🤝",
    intro: "¡Cerca del cierre! Captura blockers y la fecha esperada.",
  },
  paused: {
    emoji: "⏸️",
    intro: "Pausa con inteligencia: define cuándo retomar para que no se pierda.",
  },
  won: {
    emoji: "🎉",
    intro: "¡Ganaste este lead! Celebremos y deja la nota de cierre.",
    celebrate: true,
  },
  lost: {
    emoji: "📝",
    intro: "Cierre sin conversión — una nota rápida ayuda al equipo a aprender.",
  },
};

const FIELD_HINTS: Record<string, string> = {
  contactMethod: "¿Cómo le llegaste?",
  summary: "En pocas palabras, ¿qué pasó?",
  nextFollowUpDate: "¿Cuándo le toca el siguiente toque?",
  nextStep: "¿Cuál es la acción concreta?",
  estimatedValue: "Opcional — ¿monto aproximado?",
  expectedCloseDate: "¿Para cuándo esperas cerrar?",
  pauseReason: "¿Por qué lo pausamos?",
  resumeDate: "¿Cuándo lo retomamos?",
  lossReason: "¿Qué pesó más en la decisión?",
};

const DATETIME_PRESETS = [
  { label: "Mañana 10:00", days: 1, hour: 10 },
  { label: "En 3 días", days: 3, hour: 10 },
  { label: "Próxima semana", days: 7, hour: 10 },
] as const;

const leadDisplayName = (lead: Contact) =>
  `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
  lead.company_name ||
  "Lead sin nombre";

const isFieldValid = (field: LeadTransitionField, value: string) => {
  if (!field.required) return true;
  return Boolean(value?.trim());
};

const SelectChipField = ({
  field,
  value,
  onChange,
  accentColor,
}: {
  field: LeadTransitionField;
  value: string;
  onChange: (value: string) => void;
  accentColor: string;
}) => (
  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
    {field.options?.map((option) => {
      const selected = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all",
            "hover:border-foreground/30 hover:bg-muted/60",
            selected
              ? "border-transparent text-white shadow-md scale-[1.02]"
              : "border-border bg-background",
          )}
          style={
            selected
              ? { backgroundColor: accentColor, boxShadow: `0 8px 24px ${accentColor}40` }
              : undefined
          }
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

const DateTimeField = ({
  field,
  value,
  onChange,
}: {
  field: LeadTransitionField;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      {DATETIME_PRESETS.map((preset) => (
        <Button
          key={preset.label}
          type="button"
          size="sm"
          variant="secondary"
          className="rounded-full"
          onClick={() => {
            const date = new Date();
            date.setDate(date.getDate() + preset.days);
            date.setHours(preset.hour, 0, 0, 0);
            onChange(toDateTimeLocalValue(date));
          }}
        >
          {preset.label}
        </Button>
      ))}
    </div>
    <Input
      id={field.name}
      type="datetime-local"
      value={value}
      className="h-11 text-base"
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);

const FieldControl = ({
  field,
  value,
  onChange,
  accentColor,
}: {
  field: LeadTransitionField;
  value: string;
  onChange: (value: string) => void;
  accentColor: string;
}) => {
  if (field.type === "textarea") {
    return (
      <Textarea
        id={field.name}
        value={value}
        placeholder={field.placeholder}
        rows={5}
        className="min-h-[120px] resize-none text-base leading-relaxed"
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.type === "select") {
    return (
      <SelectChipField
        field={field}
        value={value}
        onChange={onChange}
        accentColor={accentColor}
      />
    );
  }

  if (field.type === "datetime") {
    return <DateTimeField field={field} value={value} onChange={onChange} />;
  }

  return (
    <Input
      id={field.name}
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      value={value}
      placeholder={field.placeholder}
      min={field.type === "number" ? "0" : undefined}
      step={field.type === "number" ? "0.01" : undefined}
      className="h-11 text-base"
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

const StageBadge = ({
  label,
  color,
  active,
}: {
  label: string;
  color: string;
  active?: boolean;
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm",
      active && "ring-2 ring-offset-2 ring-offset-background",
    )}
    style={{
      backgroundColor: color,
      ...(active ? { boxShadow: `0 0 0 2px ${color}55` } : {}),
    }}
  >
    {label}
  </span>
);

export const LeadStageChangeDialog = ({
  lead,
  toStage,
  open,
  onOpenChange,
  onCompleted,
}: LeadStageChangeDialogProps) => {
  const dataProvider = useDataProvider();
  const [update] = useUpdate<Contact>();
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();
  const { noteStatuses } = useConfigurationContext();
  const [values, setValues] = useState<Record<string, string>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fromStage = normalizeLeadStage(lead.lead_stage);
  const config = useMemo(
    () => (toStage ? getLeadStageTransitionConfig(toStage) : null),
    [toStage],
  );

  const toStageDef = toStage ? getLeadStageDef(toStage) : null;
  const fromStageDef = getLeadStageDef(fromStage);
  const vibe = toStage ? STAGE_VIBE[toStage] : null;

  const steps = useMemo<WizardStep[]>(() => {
    if (!config) return [];
    const fieldSteps: WizardStep[] = config.fields.map((field) => ({
      kind: "field",
      field,
      hint: FIELD_HINTS[field.name] ?? field.placeholder ?? field.label,
    }));
    return [{ kind: "intro" }, ...fieldSteps, { kind: "review" }];
  }, [config]);

  useEffect(() => {
    if (!open || !toStage) return;
    setValues(getDefaultTransitionValues(toStage));
    setStepIndex(0);
  }, [open, toStage]);

  if (!toStage || !config || !identity || !toStageDef || !vibe) return null;

  const currentStep = steps[stepIndex];
  const progress = ((stepIndex + 1) / steps.length) * 100;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  const canAdvance = currentStep?.kind === "intro"
    ? true
    : currentStep?.kind === "field"
      ? isFieldValid(currentStep.field, values[currentStep.field.name] ?? "")
      : config.fields.every((field) =>
          isFieldValid(field, values[field.name] ?? ""),
        );

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await applyLeadStageChange({
        dataProvider,
        update,
        lead,
        toStage,
        values,
        organizationMemberId: identity.id as Identifier,
        noteStatus: noteStatuses[0]?.value ?? "pending",
      });
      refresh();
      notify(`Movido a ${toStageDef.label}`, { type: "success" });
      onOpenChange(false);
      onCompleted?.();
    } catch {
      notify("No se pudo actualizar el stage del lead", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = () => {
    if (!canAdvance) return;
    if (isLastStep) {
      void handleSubmit();
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const goBack = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const formatReviewValue = (field: LeadTransitionField, raw: string) => {
    if (!raw.trim()) return "—";
    if (field.type === "select") {
      return field.options?.find((option) => option.value === raw)?.label ?? raw;
    }
    if (field.type === "datetime" || field.type === "date") {
      return formatFollowUpDateTimeLabel(raw);
    }
    return raw;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div
          className="px-6 pt-6 pb-4"
          style={{
            background: `linear-gradient(135deg, ${toStageDef.color}18 0%, transparent 70%)`,
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5" />
              Paso {stepIndex + 1} de {steps.length}
            </div>
            <span className="text-lg" aria-hidden>
              {vibe.emoji}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <div className="min-h-[320px] px-6 py-5">
          {currentStep?.kind === "intro" ? (
            <div className="flex h-full flex-col items-center text-center">
              {vibe.celebrate ? (
                <PartyPopper
                  className="mb-3 size-8"
                  style={{ color: toStageDef.color }}
                />
              ) : null}
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {config.title}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-sm text-sm leading-relaxed">
                {vibe.intro}
              </DialogDescription>

              <div className="mt-6 flex w-full items-center gap-3 rounded-2xl border bg-muted/30 p-4">
                <Avatar record={lead} width={44} />
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate font-semibold">{leadDisplayName(lead)}</p>
                  {lead.company_name ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.company_name}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <StageBadge label={fromStageDef.label} color={fromStageDef.color} />
                <ArrowRight className="size-4 text-muted-foreground" />
                <StageBadge
                  label={toStageDef.label}
                  color={toStageDef.color}
                  active
                />
              </div>

              <p className="mt-5 text-xs text-muted-foreground">
                {config.fields.length}{" "}
                {config.fields.length === 1 ? "pregunta rápida" : "preguntas rápidas"}{" "}
                · ~{Math.max(1, config.fields.length)} min
              </p>
            </div>
          ) : null}

          {currentStep?.kind === "field" ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {currentStep.hint}
                </p>
                <DialogTitle className="mt-1 text-lg font-semibold">
                  {currentStep.field.label}
                  {currentStep.field.required ? (
                    <span className="text-destructive"> *</span>
                  ) : null}
                </DialogTitle>
              </div>
              <FieldControl
                field={currentStep.field}
                value={values[currentStep.field.name] ?? ""}
                accentColor={toStageDef.color}
                onChange={(next) =>
                  setValues((current) => ({
                    ...current,
                    [currentStep.field.name]: next,
                  }))
                }
              />
              {currentStep.field.type === "textarea" ? (
                <p className="text-xs text-muted-foreground">
                  Tip: una o dos frases bastan — lo importante es no perder el contexto.
                </p>
              ) : null}
            </div>
          ) : null}

          {currentStep?.kind === "review" ? (
            <div className="space-y-4">
              <div>
                <DialogTitle className="text-lg font-semibold">
                  ¿Todo listo?
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Revisa antes de mover a{" "}
                  <span style={{ color: toStageDef.color }}>{toStageDef.label}</span>
                </DialogDescription>
              </div>

              <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <StageBadge label={fromStageDef.label} color={fromStageDef.color} />
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <StageBadge
                    label={toStageDef.label}
                    color={toStageDef.color}
                    active
                  />
                </div>
                {config.fields.map((field) => (
                  <div key={field.name} className="border-t pt-3 first:border-t-0 first:pt-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {field.label}
                    </p>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap">
                      {formatReviewValue(field, values[field.name] ?? "")}
                    </p>
                  </div>
                ))}
              </div>

              <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Se creará una nota en actividades
                {config.followUpTaskFromField ? " y un follow-up en el calendario" : ""}.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting || isFirstStep}
            onClick={goBack}
          >
            <ChevronLeft className="size-4" />
            Atrás
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!canAdvance || isSubmitting}
              style={
                isLastStep
                  ? { backgroundColor: toStageDef.color, color: "#fff" }
                  : undefined
              }
              onClick={() => void goNext()}
            >
              {isLastStep ? (
                isSubmitting ? "Guardando…" : "¡Listo, mover!"
              ) : (
                <>
                  Siguiente
                  <ChevronRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
