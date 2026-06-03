import { useCallback, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProposalTimelineBar } from "@/lbs/proposals/document/proposalDocumentTypes";
import {
  newTimelineBarId,
  weekLabelFromBar,
} from "@/lbs/proposals/document/proposalTimeline";

const toneClass: Record<ProposalTimelineBar["tone"], string> = {
  light: "pf-gfill-tone-light",
  brand: "pf-gfill-tone-brand",
  dark: "pf-gfill-tone-dark",
  gold: "pf-gfill-tone-gold",
};

const toneCycle: ProposalTimelineBar["tone"][] = [
  "light",
  "brand",
  "dark",
  "brand",
  "gold",
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const defaultNewBar = (
  bars: ProposalTimelineBar[],
): ProposalTimelineBar => {
  const last = bars[bars.length - 1];
  const left = last
    ? clamp(last.left_percent + last.width_percent, 0, 88)
    : 0;
  return {
    id: newTimelineBarId(),
    label: "New phase",
    week_label: `W${bars.length + 1}`,
    left_percent: left,
    width_percent: 12,
    tone: toneCycle[bars.length % toneCycle.length] ?? "brand",
  };
};

export const ProposalTimelineGantt = ({
  bars,
  editable,
  onChange,
  addPhaseLabel = "Add phase",
  phasePlaceholder = "Phase name",
  removeLabel = "Remove",
}: {
  bars: ProposalTimelineBar[];
  editable: boolean;
  onChange?: (bars: ProposalTimelineBar[]) => void;
  addPhaseLabel?: string;
  phasePlaceholder?: string;
  removeLabel?: string;
}) => {
  const barsRef = useRef(bars);
  barsRef.current = bars;

  const patchBars = useCallback(
    (next: ProposalTimelineBar[]) => {
      onChange?.(next);
    },
    [onChange],
  );

  const patchBar = useCallback(
    (index: number, partial: Partial<ProposalTimelineBar>) => {
      patchBars(
        barsRef.current.map((bar, i) =>
          i === index ? { ...bar, ...partial } : bar,
        ),
      );
    },
    [patchBars],
  );

  const addBar = () => {
    patchBars([...barsRef.current, defaultNewBar(barsRef.current)]);
  };

  const removeBar = (index: number) => {
    if (barsRef.current.length <= 1) return;
    patchBars(barsRef.current.filter((_, i) => i !== index));
  };

  const bindDrag = (
    index: number,
    mode: "move" | "resize",
    trackEl: HTMLDivElement,
    startEvent: React.PointerEvent,
  ) => {
    if (!editable || !onChange) return;
    startEvent.preventDefault();
    startEvent.stopPropagation();

    const rect = trackEl.getBoundingClientRect();
    const bar = barsRef.current[index];
    if (!bar) return;

    const pointerPct = (clientX: number) =>
      clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);

    const moveOffset =
      mode === "move" ? pointerPct(startEvent.clientX) - bar.left_percent : 0;

    const onPointerMove = (event: PointerEvent) => {
      const current = barsRef.current[index];
      if (!current) return;
      const pct = pointerPct(event.clientX);
      if (mode === "move") {
        patchBar(index, {
          left_percent: clamp(
            pct - moveOffset,
            0,
            100 - current.width_percent,
          ),
        });
      } else {
        patchBar(index, {
          width_percent: clamp(
            pct - current.left_percent,
            8,
            100 - current.left_percent,
          ),
        });
      }
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      const current = barsRef.current[index];
      if (current) {
        patchBar(index, { week_label: weekLabelFromBar(current) });
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  return (
    <div className="pf-gantt">
      {editable ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Edit each phase name on the left. Drag bars to move them; drag the
          right edge to change length. Week labels on bars update when you move
          or resize.
        </p>
      ) : null}
      {bars.map((bar, index) => (
        <GanttRow
          key={bar.id}
          bar={bar}
          editable={editable}
          canRemove={editable && bars.length > 1}
          phasePlaceholder={phasePlaceholder}
          removeLabel={removeLabel}
          barWeekLabel={
            editable
              ? weekLabelFromBar(bar)
              : bar.week_label?.trim() || weekLabelFromBar(bar)
          }
          onLabelChange={(label) => patchBar(index, { label })}
          onRemove={() => removeBar(index)}
          onMoveStart={(track, event) => bindDrag(index, "move", track, event)}
          onResizeStart={(track, event) =>
            bindDrag(index, "resize", track, event)
          }
        />
      ))}
      {editable ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={addBar}
        >
          <Plus className="mr-1 size-3.5" />
          {addPhaseLabel}
        </Button>
      ) : null}
    </div>
  );
};

const GanttRow = ({
  bar,
  editable,
  canRemove,
  phasePlaceholder,
  removeLabel,
  barWeekLabel,
  onLabelChange,
  onRemove,
  onMoveStart,
  onResizeStart,
}: {
  bar: ProposalTimelineBar;
  editable: boolean;
  canRemove: boolean;
  phasePlaceholder: string;
  removeLabel: string;
  barWeekLabel: string;
  onLabelChange: (label: string) => void;
  onRemove: () => void;
  onMoveStart: (track: HTMLDivElement, event: React.PointerEvent) => void;
  onResizeStart: (track: HTMLDivElement, event: React.PointerEvent) => void;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <div className="group/item relative rounded-lg pr-8 transition-colors hover:bg-muted/30">
      {canRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 z-10 size-8 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onRemove}
          aria-label={removeLabel}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
      <div className="pf-gbar">
        {editable ? (
          <Input
            value={bar.label}
            onChange={(event) => onLabelChange(event.target.value)}
            placeholder={phasePlaceholder}
            className="pf-gbar-label h-8 text-sm font-semibold"
          />
        ) : (
          <div className="pf-gbar-label">{bar.label}</div>
        )}
        <div ref={trackRef} className="pf-gtrack">
          <div
            className={cn(
              "pf-gfill",
              toneClass[bar.tone],
              editable && "pf-gfill-draggable",
            )}
            style={{
              left: `${bar.left_percent}%`,
              width: `${bar.width_percent}%`,
            }}
            onPointerDown={(event) => {
              if (!editable || !trackRef.current) return;
              onMoveStart(trackRef.current, event);
            }}
          >
            <span className="pointer-events-none select-none">
              {barWeekLabel}
            </span>
            {editable ? (
              <span
                className="pf-gfill-resize"
                onPointerDown={(event) => {
                  if (!trackRef.current) return;
                  onResizeStart(trackRef.current, event);
                }}
                aria-hidden
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
