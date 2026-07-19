import { useState } from "react";
import { useNotify } from "ra-core";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { testAndSaveImapAccount } from "./mailApi";

export function MailImapDialog({
  open,
  onOpenChange,
  scope,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: "org" | "personal";
  onConnected: (accountId: number, email: string) => void;
}) {
  const notify = useNotify();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [pending, setPending] = useState(false);

  const handleConnect = async () => {
    if (!email.trim() || !password) {
      notify("Email and password are required", { type: "warning" });
      return;
    }
    setPending(true);
    try {
      const result = await testAndSaveImapAccount({
        scope,
        email: email.trim(),
        password,
        imap_host: imapHost.trim() || undefined,
        smtp_host: smtpHost.trim() || undefined,
      });
      notify("Mailbox connected", { type: "success" });
      onConnected(Number(result.account_id), email.trim());
      onOpenChange(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Connection failed", {
        type: "error",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add other account</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Use an app password when your provider requires it (Gmail IMAP, etc.).
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="imap-email">Email</Label>
            <Input
              id="imap-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imap-password">Password</Label>
            <Input
              id="imap-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imap-host">IMAP host (optional)</Label>
            <Input
              id="imap-host"
              placeholder="imap.example.com"
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-host">SMTP host (optional)</Label>
            <Input
              id="smtp-host"
              placeholder="smtp.example.com"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConnect} disabled={pending}>
            {pending ? "Testing…" : "Test & connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
