import type { ReactNode } from "react";

import { SettingsHint } from "@/modules/settings/SettingsHint";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  hint?: string;
  control: ReactNode;
  className?: string;
};

export const NotificationSettingsRow = ({
  label,
  hint,
  control,
  className,
}: Props) => (
  <div
    className={cn(
      "flex items-center justify-between gap-4 py-3",
      className,
    )}
  >
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <p className="text-sm font-medium leading-snug">{label}</p>
      {hint ? <SettingsHint text={hint} /> : null}
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);
