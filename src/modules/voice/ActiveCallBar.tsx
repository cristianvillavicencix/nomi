import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  GripVertical,
  Grid3x3,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  PhoneOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ActiveCallKeypad } from "@/modules/voice/ActiveCallKeypad";
import { ActiveCallPanel } from "@/modules/voice/ActiveCallPanel";
import {
  clampActiveCallBarPosition,
  defaultActiveCallBarPosition,
  loadActiveCallBarPosition,
  saveActiveCallBarPosition,
  type ActiveCallBarPosition,
} from "@/modules/voice/activeCallBarPosition";
import { formatLiveCallTimer } from "@/modules/voice/voiceCallFormat";
import { useVoiceCallContextOptional } from "@/modules/voice/voiceCallContext";

const callStateLabel = (state: string, label: string | null) => {
  switch (state) {
    case "connecting":
      return "Connecting…";
    case "ringing":
      return label ? `Calling ${label}…` : "Ringing…";
    case "open":
      return label ? `On call · ${label}` : "On call";
    default:
      return null;
  }
};

const barIconClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-100 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:pointer-events-none disabled:opacity-40";

export const ActiveCallBar = () => {
  const voice = useVoiceCallContextOptional();
  const shellRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [position, setPosition] = useState<ActiveCallBarPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const hasActiveCall =
    Boolean(voice?.activeCallLabel) ||
    voice?.callState === "connecting" ||
    voice?.callState === "ringing" ||
    voice?.callState === "open";

  useEffect(() => {
    if (!voice?.callConnectedAt || voice.callState !== "open") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [voice?.callConnectedAt, voice?.callState]);

  useLayoutEffect(() => {
    if (!hasActiveCall || !shellRef.current) return;
    const el = shellRef.current;
    const width = el.offsetWidth || 420;
    const height = el.offsetHeight || 64;

    setPosition((current) => {
      if (current) {
        return clampActiveCallBarPosition(current.x, current.y, width, height);
      }
      const saved = loadActiveCallBarPosition();
      return saved
        ? clampActiveCallBarPosition(saved.x, saved.y, width, height)
        : defaultActiveCallBarPosition(width, height);
    });
  }, [hasActiveCall, voice?.callWorkspaceOpen]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      if (!shellRef.current) return;
      const width = shellRef.current.offsetWidth;
      const height = shellRef.current.offsetHeight;
      const next = clampActiveCallBarPosition(
        event.clientX - dragOffsetRef.current.x,
        event.clientY - dragOffsetRef.current.y,
        width,
        height,
      );
      setPosition(next);
    };

    const onUp = () => {
      setDragging(false);
      setPosition((current) => {
        if (current) saveActiveCallBarPosition(current);
        return current;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  if (!voice) return null;

  // Incoming ring uses IncomingCallDialog / IncomingCallBanner instead.
  if (voice.incomingCall && !hasActiveCall) return null;

  const label = callStateLabel(voice.callState, voice.activeCallLabel);
  if (!hasActiveCall && !voice.errorMessage) return null;
  if (!hasActiveCall && voice.callState === "error") return null;

  const busy = voice.isBusy;
  const onCall =
    voice.callState === "open" || voice.callConnectedAt != null;
  const canUseMediaControls =
    busy &&
    (voice.callState === "open" ||
      voice.callState === "ringing" ||
      voice.callState === "connecting");
  const workspaceOpen = voice.callWorkspaceOpen;
  const timer =
    onCall && voice.callConnectedAt
      ? formatLiveCallTimer(now - voice.callConnectedAt)
      : null;

  const startDrag = (event: ReactPointerEvent) => {
    if (event.button !== 0 || !shellRef.current || !position) return;
    event.preventDefault();
    event.stopPropagation();
    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    setDragging(true);
  };

  const style =
    position != null
      ? {
          left: position.x,
          top: position.y,
        }
      : undefined;

  return (
    <div
      ref={shellRef}
      className={cn(
        "pointer-events-auto fixed z-[60] flex w-[min(100vw-1rem,420px)] flex-col",
        dragging && "select-none",
        position == null && "inset-x-0 bottom-4 mx-auto",
      )}
      style={style}
    >
      {workspaceOpen && busy ? (
        <ActiveCallPanel party={voice.activeCallParty} />
      ) : null}

      <div
        className={cn(
          "flex items-center gap-2 border border-border/60 bg-zinc-900 px-2 py-2 text-zinc-50 shadow-xl dark:bg-zinc-950",
          workspaceOpen ? "rounded-b-xl border-t-0" : "rounded-xl",
        )}
      >
        <button
          type="button"
          className="flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 active:cursor-grabbing"
          aria-label="Move call bar"
          onPointerDown={startDrag}
        >
          <GripVertical className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {timer ? (
              <span className="shrink-0 font-mono text-sm tabular-nums text-zinc-100">
                {timer}
              </span>
            ) : voice.callState === "connecting" ||
              voice.callState === "ringing" ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-zinc-400" />
            ) : null}
            <span className="truncate text-sm font-medium">
              {label ?? "Call error"}
            </span>
          </div>
          {voice.errorMessage ? (
            <div className="truncate text-xs text-red-300">
              {voice.errorMessage}
            </div>
          ) : null}
        </div>

        {busy || voice.callState === "error" ? (
          <div className="flex shrink-0 items-center gap-0.5">
            {canUseMediaControls ? (
              <>
                <button
                  type="button"
                  aria-label={voice.isMuted ? "Unmute" : "Mute"}
                  aria-pressed={voice.isMuted}
                  disabled={!onCall}
                  className={cn(
                    barIconClass,
                    voice.isMuted && "bg-zinc-700 text-amber-300",
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    voice.setMuted(!voice.isMuted);
                  }}
                >
                  {voice.isMuted ? (
                    <MicOff className="size-4" />
                  ) : (
                    <Mic className="size-4" />
                  )}
                </button>

                <Popover open={keypadOpen} onOpenChange={setKeypadOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Keypad"
                      aria-pressed={keypadOpen}
                      disabled={!onCall}
                      className={cn(
                        barIconClass,
                        keypadOpen && "bg-zinc-700",
                      )}
                    >
                      <Grid3x3 className="size-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="end"
                    className="z-[70] w-48 border-border/60 bg-background p-1 shadow-xl"
                  >
                    <ActiveCallKeypad
                      onDigit={(digit) => voice.sendDigits(digit)}
                    />
                  </PopoverContent>
                </Popover>

                <button
                  type="button"
                  aria-label={
                    workspaceOpen
                      ? "Minimize call workspace"
                      : "Expand call workspace"
                  }
                  aria-pressed={workspaceOpen}
                  className={cn(
                    barIconClass,
                    workspaceOpen && "bg-zinc-700",
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    voice.setCallWorkspaceOpen(!voice.callWorkspaceOpen);
                  }}
                >
                  {workspaceOpen ? (
                    <Minimize2 className="size-4" />
                  ) : (
                    <Maximize2 className="size-4" />
                  )}
                </button>
              </>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="ml-0.5 h-9 gap-1.5 rounded-lg px-3"
              onClick={(event) => {
                event.stopPropagation();
                voice.hangUp();
              }}
            >
              {voice.callState === "connecting" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PhoneOff className="size-4" />
              )}
              {busy ? "End" : "Dismiss"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
