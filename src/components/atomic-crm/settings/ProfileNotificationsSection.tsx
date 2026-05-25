import { useMutation } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useGetIdentity, useGetOne, useNotify } from "ra-core";
import { useEffect, useState } from "react";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidE164 } from "@/lib/e164";

export const ProfileNotificationsSection = () => {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const { data: member, refetch } = useGetOne<OrganizationMember>(
    "organization_members",
    { id: identity?.id },
    { enabled: identity?.id != null },
  );

  const [phone, setPhone] = useState("");

  useEffect(() => {
    setPhone(member?.notification_phone ?? "");
  }, [member?.notification_phone]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!member?.id) throw new Error("Member not found");
      const trimmed = phone.trim();
      const value = trimmed === "" ? null : trimmed;
      if (value && !isValidE164(value)) {
        throw new Error("Invalid phone format. Use E.164, e.g. +12035551234");
      }
      const { error } = await supabase
        .from("organization_members")
        .update({ notification_phone: value })
        .eq("id", member.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      notify("Notification phone saved", { type: "success" });
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to save phone", {
        type: "error",
      });
    },
  });

  const trimmed = phone.trim();
  const canSave = trimmed === "" || isValidE164(trimmed);
  const showInvalid = trimmed.length > 0 && !isValidE164(trimmed);

  if (!identity) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification phone</CardTitle>
        <CardDescription>
          Mobile number where you receive SMS when form submissions arrive,
          tasks are assigned, and other important alerts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notification-phone">Phone (E.164)</Label>
          <Input
            id="notification-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+12035551234"
            autoComplete="tel"
          />
          <p className="text-xs text-muted-foreground">
            E.164 format: country code + number (e.g. +12035551234 for US). No
            spaces or dashes.
          </p>
          {showInvalid ? (
            <p className="text-xs text-destructive">
              Invalid format. Use +12035551234 (no spaces or dashes).
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !canSave}
        >
          {saveMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save notification phone
        </Button>
      </CardContent>
    </Card>
  );
};
