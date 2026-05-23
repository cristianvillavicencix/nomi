import { useMutation } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { useDataProvider, useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useState } from "react";

export const TestSmsButton = ({ disabled }: { disabled?: boolean }) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const [phone, setPhone] = useState("");

  const mutation = useMutation({
    mutationFn: () => dataProvider.sendTestSms(phone.trim()),
    onSuccess: () => notify("Test SMS sent", { type: "success" }),
    onError: (error) =>
      notify(error instanceof Error ? error.message : "Failed to send test SMS", {
        type: "error",
      }),
  });

  return (
    <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
      <Label htmlFor="test-sms-phone">Send test SMS</Label>
      <p className="text-sm text-muted-foreground">
        Sends a short test message using your saved Twilio credentials.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="test-sms-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+1 (555) 123-4567"
          autoComplete="off"
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || mutation.isPending || !phone.trim()}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Test SMS
        </Button>
      </div>
    </div>
  );
};
