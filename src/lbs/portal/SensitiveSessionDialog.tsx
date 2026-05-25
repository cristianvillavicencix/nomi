import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PortalCopy } from "@/lbs/portal/portalI18n";
import { useState } from "react";

export const SensitiveSessionDialog = ({
  open,
  onOpenChange,
  copy,
  accountEmail,
  confirming,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: PortalCopy;
  accountEmail?: string | null;
  confirming: boolean;
  error: string | null;
  onConfirm: (email: string) => void;
}) => {
  const [email, setEmail] = useState(accountEmail ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.sensitiveSessionTitle}</DialogTitle>
          <DialogDescription>{copy.sensitiveSessionDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <Label htmlFor="portal-email-confirm">{copy.confirmEmailLabel}</Label>
          <Input
            id="portal-email-confirm"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={accountEmail ?? "client@email.com"}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button
            type="button"
            disabled={!email.trim() || confirming}
            onClick={() => onConfirm(email.trim())}
          >
            {confirming ? copy.verifying : copy.continue}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
