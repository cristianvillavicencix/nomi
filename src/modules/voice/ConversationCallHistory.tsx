import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Phone,
} from "lucide-react";
import type { Identifier } from "ra-core";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";
import { cn } from "@/lib/utils";
import { useConversationVoiceCalls } from "@/modules/voice/useConversationVoiceCalls";
import {
  formatCallDuration,
  formatCallTimestamp,
  voiceCallStatusLabel,
} from "@/modules/voice/voiceCallFormat";

export const ConversationCallHistory = ({
  conversationId,
}: {
  conversationId: Identifier | null | undefined;
}) => {
  const { calls, isPending, canView } = useConversationVoiceCalls(
    conversationId,
  );

  if (!canView || !conversationId) {
    return null;
  }

  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Call history
      </div>
      {isPending ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading calls…
        </div>
      ) : calls.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No calls logged for this conversation yet.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {calls.map((call) => {
            const isInbound = call.direction === "inbound";
            const number = isInbound
              ? call.from_number
              : call.to_number;
            const displayNumber = number
              ? formatUsPhoneDisplayFromAny(number)
              : "Unknown number";

            return (
              <li
                key={call.id}
                className="rounded-lg border border-border/50 bg-background/80 px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  <div
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                      isInbound ? "bg-emerald-500/10" : "bg-sky-500/10",
                    )}
                  >
                    {isInbound ? (
                      <ArrowDownLeft className="size-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpRight className="size-3.5 text-sky-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">
                        {displayNumber}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{isInbound ? "Inbound" : "Outbound"}</span>
                      <span>·</span>
                      <span>{voiceCallStatusLabel(call.status)}</span>
                      <span>·</span>
                      <span>{formatCallDuration(call.duration_seconds)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatCallTimestamp(call.ended_at ?? call.started_at ?? call.created_at)}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
