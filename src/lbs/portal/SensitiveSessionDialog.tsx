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
  codeSent,
  codeExpiresAt,
  onRequestCode,
  onVerifyCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: PortalCopy;
  accountEmail?: string | null;
  confirming: boolean;
  error: string | null;
  codeSent: boolean;
  codeExpiresAt: string | null;
  onRequestCode: () => void;
  onVerifyCode: (code: string) => void;
}) => {
  const [code, setCode] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.sensitiveSessionTitle}</DialogTitle>
          <DialogDescription>{copy.sensitiveSessionDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-1">
          {!codeSent ? (
            <>
              <p className="text-sm text-muted-foreground">
                We’ll email a 6-digit code to{" "}
                <span className="font-medium text-foreground">
                  {accountEmail ?? "your email"}
                </span>
                .
              </p>
              <Button
                type="button"
                disabled={confirming}
                onClick={() => onRequestCode()}
              >
                {confirming ? copy.verifying : "Send code"}
              </Button>
            </>
          ) : (
            <>
              <Label htmlFor="portal-code">Code</Label>
              <Input
                id="portal-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/[^\d]/g, "").slice(0, 6))
                }
                placeholder="123456"
              />
              {codeExpiresAt ? (
                <p className="text-xs text-muted-foreground">
                  Expires at {new Date(codeExpiresAt).toLocaleTimeString()}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={confirming}
                  onClick={() => onRequestCode()}
                >
                  Resend
                </Button>
                <Button
                  type="button"
                  disabled={confirming || code.trim().length !== 6}
                  onClick={() => onVerifyCode(code.trim())}
                >
                  {confirming ? copy.verifying : "Verify"}
                </Button>
              </div>
            </>
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {copy.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
