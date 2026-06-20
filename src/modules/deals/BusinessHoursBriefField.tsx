import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BUSINESS_HOURS_DAY_OPTIONS,
  parseBusinessHoursBrief,
  serializeBusinessHoursBrief,
} from "@/modules/deals/businessHoursBrief";

type DayState = { enabled: boolean; open: string; close: string };

export const BusinessHoursBriefField = ({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: string) => void;
}) => {
  const saved = parseBusinessHoursBrief(value);

  const [days, setDays] = useState<Record<string, DayState>>(() => {
    const map: Record<string, DayState> = {};
    for (const option of BUSINESS_HOURS_DAY_OPTIONS) {
      const entry = saved.find((row) => row.day === option.value);
      map[option.value] = entry
        ? { enabled: true, open: entry.open, close: entry.close }
        : { enabled: false, open: "08:00", close: "17:00" };
    }
    return map;
  });

  const commit = (next: Record<string, DayState>) => {
    const entries = BUSINESS_HOURS_DAY_OPTIONS.filter(
      (option) => next[option.value]?.enabled,
    ).map((option) => ({
      day: option.value,
      open: next[option.value]!.open,
      close: next[option.value]!.close,
    }));
    onChange(serializeBusinessHoursBrief(entries));
  };

  const update = (day: string, patch: Partial<DayState>) => {
    const next = { ...days, [day]: { ...days[day]!, ...patch } };
    setDays(next);
    commit(next);
  };

  return (
    <div className="space-y-2 md:col-span-2">
      <Label>Business hours</Label>
      <p className="text-xs text-muted-foreground">
        Check a day to set open hours. Unchecked days are closed.
      </p>
      <div className="divide-y rounded-md border">
        {BUSINESS_HOURS_DAY_OPTIONS.map((option) => {
          const state = days[option.value]!;
          return (
            <div
              key={option.value}
              className="flex items-center gap-3 px-3 py-2"
            >
              <input
                type="checkbox"
                id={`brief-bh-${option.value}`}
                checked={state.enabled}
                className="size-4 shrink-0 accent-primary"
                onChange={(event) =>
                  update(option.value, { enabled: event.target.checked })
                }
              />
              <label
                htmlFor={`brief-bh-${option.value}`}
                className={`w-8 shrink-0 text-sm font-medium ${state.enabled ? "" : "text-muted-foreground"}`}
              >
                {option.label}
              </label>
              {state.enabled ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={state.open}
                    className="h-8 w-28 text-sm"
                    onChange={(event) =>
                      update(option.value, { open: event.target.value })
                    }
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={state.close}
                    className="h-8 w-28 text-sm"
                    onChange={(event) =>
                      update(option.value, { close: event.target.value })
                    }
                  />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Closed</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
