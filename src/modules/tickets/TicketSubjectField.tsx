import { useEffect, useRef, useState } from "react";
import { useNotify, useUpdate } from "ra-core";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/modules/types";

type TicketSubjectFieldProps = {
  ticket: Ticket;
  className?: string;
  inputClassName?: string;
};

export const TicketSubjectField = ({
  ticket,
  className,
  inputClassName,
}: TicketSubjectFieldProps) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(ticket.subject);
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(ticket.subject);
  }, [ticket.subject]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const cancel = () => {
    setValue(ticket.subject);
    setEditing(false);
  };

  const save = () => {
    const next = value.trim();
    if (!next) {
      notify("Subject cannot be empty", { type: "warning" });
      setValue(ticket.subject);
      setEditing(false);
      return;
    }
    if (next === ticket.subject) {
      setEditing(false);
      return;
    }

    update(
      "tickets",
      { id: ticket.id, data: { subject: next }, previousData: ticket },
      {
        onSuccess: () => setEditing(false),
        onError: () => {
          notify("Could not update subject", { type: "error" });
          setValue(ticket.subject);
          setEditing(false);
        },
      },
    );
  };

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
          "h-auto border-primary/40 bg-background px-1 py-0.5 text-sm font-semibold shadow-none",
          inputClassName,
        )}
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
        "block w-full truncate text-left font-semibold leading-snug text-foreground hover:underline",
        className,
      )}
    >
      {ticket.subject || "Untitled ticket"}
    </button>
  );
};
