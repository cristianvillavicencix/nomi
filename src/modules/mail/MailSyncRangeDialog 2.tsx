import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  MAIL_SYNC_PRESET_OPTIONS,
  resolveMailSyncRange,
  type MailSyncPreset,
  type MailSyncRange,
} from "./mailSyncRange";

export function MailSyncRangeDialog({
  open,
  onOpenChange,
  accountEmail,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountEmail?: string | null;
  onConfirm: (range: MailSyncRange) => void | Promise<void>;
}) {
  const [preset, setPreset] = useState<MailSyncPreset>("30d");
  const [customDate, setCustomDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    setPending(true);
    try {
      const range = resolveMailSyncRange(
        preset,
        preset === "custom" ? customDate : undefined,
      );
      await onConfirm(range);
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sync mail from…</DialogTitle>
          <DialogDescription>
            {accountEmail
              ? `Choose how far back to pull messages for ${accountEmail}.`
              : "Choose how far back to pull messages into Mail."}
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={preset}
          onValueChange={(v) => setPreset(v as MailSyncPreset)}
          className="gap-2"
        >
          {MAIL_SYNC_PRESET_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <RadioGroupItem value={opt.value} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {opt.description}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
        {preset === "custom" ? (
          <div className="space-y-1.5">
            <Label htmlFor="mail-sync-since">Start date</Label>
            <Input
              id="mail-sync-since"
              type="date"
              value={customDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={pending}>
            {pending ? "Syncing…" : "Start sync"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
