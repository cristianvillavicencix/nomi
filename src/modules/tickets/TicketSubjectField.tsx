import { useEffect, useRef, useState } from "react";
import { useNotify, useUpdate } from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import { useViewTransitionState } from "react-router";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/modules/types";
import { patchTicketInQueryCache } from "@/modules/tickets/ticketsRealtimeCache";
import { ticketShowPath } from "@/modules/tickets/ticketStatusWorkflow";
type TicketSubjectFieldProps = {
  ticket: Ticket;
  editable?: boolean;
  className?: string;
  inputClassName?: string;
  onUpdated?: () => void;
};

export const TicketSubjectField = ({
  ticket,
  editable = true,
  className,
  inputClassName,
  onUpdated,
}: TicketSubjectFieldProps) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(ticket.subject ?? "");
  const [displaySubject, setDisplaySubject] = useState<string | null>(null);
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const resolvedSubject = displaySubject ?? ticket.subject ?? "";
  const showHref = ticketShowPath(ticket.id);
  const isTransitioning = useViewTransitionState(showHref);
  const subjectTransitionStyle = isTransitioning
    ? ({ viewTransitionName: `ticket-subject-${ticket.id}` } as const)
    : undefined;

  useEffect(() => {
    setValue(resolvedSubject);
  }, [resolvedSubject]);

  useEffect(() => {
    if (
      displaySubject != null &&
      displaySubject === (ticket.subject ?? "").trim()
    ) {
      setDisplaySubject(null);
    }
  }, [displaySubject, ticket.subject]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const cancel = () => {
    setValue(resolvedSubject);
    setEditing(false);
  };

  const save = () => {
    const next = String(value ?? "").trim();
    if (!next) {
      notify("Subject cannot be empty", { type: "warning" });
      setValue(resolvedSubject);
      setEditing(false);
      return;
    }
    if (next === resolvedSubject.trim()) {
      setEditing(false);
      return;
    }

    setDisplaySubject(next);
    patchTicketInQueryCache(queryClient, ticket.id, { subject: next });

    update(
      "tickets",
      { id: ticket.id, data: { subject: next }, previousData: ticket },
      {
        onSuccess: () => {
          setEditing(false);
          onUpdated?.();
        },
        onError: () => {
          setDisplaySubject(null);
          patchTicketInQueryCache(queryClient, ticket.id, {
            subject: ticket.subject ?? "",
          });
          notify("Could not update subject", { type: "error" });
          setValue(ticket.subject ?? "");
          setEditing(false);
        },
      },
    );
  };

  if (!editable) {
    return (
      <span
        className={cn(
          "text-sm font-normal leading-snug text-foreground",
          className,
        )}
        style={subjectTransitionStyle}
      >
        {resolvedSubject || "Untitled ticket"}
      </span>
    );
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={value}
        disabled={isPending}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        className={cn(
          "inline h-auto min-w-[12rem] border-primary/40 bg-background px-1 py-0 text-sm font-normal leading-snug shadow-none",
          inputClassName,
        )}
        style={subjectTransitionStyle}
      />
    );
  }

  return (
    <button
      type="button"
      title="Click to edit subject"
      onClick={(event) => {
        event.stopPropagation();
        setEditing(true);
      }}
      className={cn(
        "inline max-w-full truncate text-left text-lg font-semibold leading-snug tracking-tight text-foreground hover:underline",
        className,
      )}
      style={subjectTransitionStyle}
    >
      {resolvedSubject || "Untitled ticket"}
    </button>
  );
};
