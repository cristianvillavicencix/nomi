import { useMutation } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import {
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
} from "ra-core";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditAvatarDialog } from "@/components/avatar/EditAvatarDialog";
import {
  initialsOf,
  resolveAvatarUrl,
} from "@/components/avatar/resolveAvatar";
import { useStorageSignedUrl } from "@/hooks/useStorageSignedUrl";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";
import { ProfileCalendarSubscriptionSection } from "@/modules/calendar/ProfileCalendarSubscriptionSection";
import { buildSettingsSearchParams } from "@/modules/settings/settingsNavigation";

import { supabase } from "../providers/supabase/supabase";
import type { CrmDataProvider } from "../providers/types";
import type { OrganizationMember, OrganizationMemberFormData } from "../types";

type ProfileFields = {
  first_name: string;
  last_name: string;
  email: string;
};

const emptyFields = (): ProfileFields => ({
  first_name: "",
  last_name: "",
  email: "",
});

export const ProfilePage = () => {
  const { identity } = useGetIdentity();
  const { data: member } = useGetOne<OrganizationMember>("organization_members", {
    id: identity?.id,
  });

  if (!identity) return null;

  return (
    <div className="mx-auto mt-8 max-w-lg space-y-4">
      <ProfileIdentityCard member={member} />
      <Card>
        <CardContent className="flex items-center justify-between gap-3 pt-6">
          <h2 className="text-sm font-medium">Notifications</h2>
          <Button type="button" size="sm" variant="outline" asChild>
              <Link
                to={{
                  pathname: "/settings",
                  search: buildSettingsSearchParams("notifications").toString(),
                }}
              >
                Open settings
              </Link>
            </Button>
        </CardContent>
      </Card>
      <ProfileCalendarSubscriptionSection />
      {import.meta.env.VITE_INBOUND_EMAIL ? <InboundEmailCard /> : null}
    </div>
  );
};

const ProfileIdentityCard = ({
  member,
}: {
  member?: OrganizationMember;
}) => {
  const notify = useNotify();
  const { identity, refetch: refetchIdentity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [fields, setFields] = useState<ProfileFields>(emptyFields);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!member) return;
    setFields({
      first_name: member.first_name ?? "",
      last_name: member.last_name ?? "",
      email: member.email ?? "",
    });
    setTouched(false);
  }, [member?.first_name, member?.last_name, member?.email, member]);

  const saveMutation = useMutation({
    mutationFn: async (data: ProfileFields) => {
      if (!member?.id) throw new Error("Record not found");
      return dataProvider.organizationMemberUpdate(member.id, {
        ...member,
        ...data,
      } as OrganizationMemberFormData);
    },
    onSuccess: () => {
      void refetchIdentity();
      notify("Profile updated", { type: "success" });
    },
    onError: () => {
      notify("An error occurred. Please try again", { type: "error" });
    },
    onSettled: () => setSaving(false),
  });

  useDebouncedSave(
    fields,
    (next) => {
      if (!member?.id) return;
      setSaving(true);
      saveMutation.mutate(next);
    },
    {
      enabled: touched && Boolean(member?.id),
      delayMs: 700,
      isEqual: (a, b) =>
        a.first_name === b.first_name &&
        a.last_name === b.last_name &&
        a.email === b.email,
    },
  );

  const avatarPreviewUrl = useStorageSignedUrl(
    member ? resolveAvatarUrl(member, 96) : null,
    { defaultBucket: "avatars" },
  );
  const avatarInitials = initialsOf(member);

  if (!identity || !member) return null;

  const resetPasswordForm = () => {
    setNewPassword("");
    setConfirmPassword("");
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      notify("Password must be at least 6 characters", { type: "warning" });
      return;
    }
    if (newPassword !== confirmPassword) {
      notify("Passwords do not match", { type: "warning" });
      return;
    }

    try {
      setPasswordSaving(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setPasswordDialogOpen(false);
      resetPasswordForm();
      notify("Your password has been updated");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update password";
      notify(message, { type: "error" });
    } finally {
      setPasswordSaving(false);
    }
  };

  const setField = (key: keyof ProfileFields, value: string) => {
    setTouched(true);
    setFields((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Profile
            </h2>
            {saving ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Saving…
              </span>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="flex flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => setAvatarDialogOpen(true)}
                className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Change avatar"
              >
                <Avatar className="size-[50px]">
                  <AvatarImage src={avatarPreviewUrl ?? undefined} />
                  <AvatarFallback>{avatarInitials}</AvatarFallback>
                </Avatar>
              </button>
              <button
                type="button"
                onClick={() => setAvatarDialogOpen(true)}
                className="cursor-pointer text-xs underline hover:no-underline"
              >
                Change
              </button>
            </div>

            <ProfileFieldRow
              label="First name"
              control={
                <Input
                  value={fields.first_name}
                  onChange={(event) =>
                    setField("first_name", event.target.value)
                  }
                  autoComplete="given-name"
                />
              }
            />
            <ProfileFieldRow
              label="Last name"
              control={
                <Input
                  value={fields.last_name}
                  onChange={(event) =>
                    setField("last_name", event.target.value)
                  }
                  autoComplete="family-name"
                />
              }
            />
            <ProfileFieldRow
              label="Email"
              control={
                <Input
                  type="email"
                  value={fields.email}
                  onChange={(event) => setField("email", event.target.value)}
                  autoComplete="email"
                />
              }
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetPasswordForm();
                setPasswordDialogOpen(true);
              }}
            >
              Change password
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditAvatarDialog
        open={avatarDialogOpen}
        onOpenChange={(next) => {
          setAvatarDialogOpen(next);
          if (!next) void refetchIdentity?.();
        }}
        record={member}
        target={{ kind: "organization_member", id: member.id }}
        folder="organization_members"
      />

      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open);
          if (!open) resetPasswordForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              Enter a new password for your account. You stay signed in after
              saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-new-password">New password</Label>
              <Input
                id="profile-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-confirm-password">Confirm password</Label>
              <Input
                id="profile-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPasswordDialogOpen(false)}
              disabled={passwordSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handlePasswordChange()}
              disabled={passwordSaving}
            >
              Save password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ProfileFieldRow = ({
  label,
  control,
}: {
  label: string;
  control: ReactNode;
}) => (
  <div className="grid gap-2 border-b border-border/50 pb-3 sm:grid-cols-[7rem_1fr] sm:items-center sm:gap-4">
    <Label className="text-sm text-muted-foreground">{label}</Label>
    {control}
  </div>
);

const InboundEmailCard = () => (
  <Card>
    <CardContent className="pt-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-muted-foreground">
          Inbound email
        </h2>
        <p className="text-sm text-muted-foreground">
          You can start sending emails to your server&apos;s inbound email
          address, e.g. by adding it to the <b> Cc: </b> field. Nomi CRM will
          process the emails and add notes to the corresponding contacts.
        </p>
        <CopyPaste />
      </div>
    </CardContent>
  </Card>
);

const CopyPaste = () => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    setCopied(true);
    navigator.clipboard.writeText(import.meta.env.VITE_INBOUND_EMAIL);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={handleCopy}
            variant="ghost"
            className="w-full justify-between normal-case"
          >
            <span className="overflow-hidden text-ellipsis">
              {import.meta.env.VITE_INBOUND_EMAIL}
            </span>
            <Copy className="ml-2 h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? "Copied!" : "Copy"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

ProfilePage.path = "/profile";
