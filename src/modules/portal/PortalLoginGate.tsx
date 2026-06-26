import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PortalCopy } from "@/modules/portal/portalI18n";

export const PortalLoginGate = ({
  copy,
  accountEmail,
  emailEditable = false,
  confirming,
  error,
  codeSent,
  codeExpiresAt,
  idleMinutes,
  onRequestCode,
  onVerifyCode,
}: {
  copy: PortalCopy;
  accountEmail?: string | null;
  emailEditable?: boolean;
  confirming: boolean;
  error: string | null;
  codeSent: boolean;
  codeExpiresAt: string | null;
  idleMinutes: number;
  onRequestCode: (email: string) => void;
  onVerifyCode: (email: string, code: string) => void;
}) => {
  const [email, setEmail] = useState(accountEmail?.trim() ?? "");
  const [code, setCode] = useState("");
  const resolvedEmail = (emailEditable ? email : accountEmail)?.trim() ?? "";
  const canSendCode = emailEditable
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedEmail)
    : Boolean(resolvedEmail);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">{copy.portalLoginTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {emailEditable ? copy.portalEmailLoginIntro : copy.portalLoginIntro}
          </p>
          <p className="text-xs text-muted-foreground">
            {copy.portalLoginIdleHint.replace("{minutes}", String(idleMinutes))}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!codeSent ? (
            <>
              {emailEditable ? (
                <div className="space-y-2">
                  <Label htmlFor="portal-login-email">
                    {copy.portalLoginEmailLabel}
                  </Label>
                  <Input
                    id="portal-login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="client@company.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    {copy.portalEmailLoginHint}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {copy.portalLoginEmailHint}{" "}
                  <span className="font-medium text-foreground">
                    {accountEmail ?? copy.portalLoginEmailFallback}
                  </span>
                  .
                </p>
              )}
              <Button
                type="button"
                className="w-full"
                disabled={confirming || !canSendCode}
                onClick={() => onRequestCode(resolvedEmail)}
              >
                {confirming ? copy.verifying : copy.portalLoginSendCode}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {copy.portalLoginEmailHint}{" "}
                <span className="font-medium text-foreground">
                  {resolvedEmail}
                </span>
                .
              </p>
              <div className="space-y-2">
                <Label htmlFor="portal-login-code">
                  {copy.portalLoginCodeLabel}
                </Label>
                <Input
                  id="portal-login-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value.replace(/[^\d]/g, "").slice(0, 6),
                    )
                  }
                  placeholder="123456"
                />
                {codeExpiresAt ? (
                  <p className="text-xs text-muted-foreground">
                    {copy.portalLoginCodeExpires.replace(
                      "{time}",
                      new Date(codeExpiresAt).toLocaleTimeString(),
                    )}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={confirming}
                  onClick={() => onRequestCode(resolvedEmail)}
                >
                  {copy.portalLoginResendCode}
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={
                    confirming || code.trim().length !== 6 || !canSendCode
                  }
                  onClick={() => onVerifyCode(resolvedEmail, code.trim())}
                >
                  {confirming ? copy.verifying : copy.portalLoginVerifyCode}
                </Button>
              </div>
            </>
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
};
