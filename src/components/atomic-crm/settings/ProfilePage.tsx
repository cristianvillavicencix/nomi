import { useMutation } from "@tanstack/react-query";
import { CircleX, Copy, Pencil, Save } from "lucide-react";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRecordContext,
} from "ra-core";
import { useState } from "react";
import { useFormState } from "react-hook-form";
import { RecordField } from "@/components/admin/record-field";
import { EmailInput } from "@/components/admin/email-input";
import { TextInput } from "@/components/admin/text-input";
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

import ImageEditorField from "../misc/ImageEditorField";
import { supabase } from "../providers/supabase/supabase";
import type { CrmDataProvider } from "../providers/types";
import type { OrganizationMember, OrganizationMemberFormData } from "../types";
import { ProfileNotificationsSection } from "./ProfileNotificationsSection";

export const ProfilePage = () => {
  const [isEditMode, setEditMode] = useState(false);
  const { identity, refetch: refetchIdentity } = useGetIdentity();
  const { data, refetch: refetchUser } = useGetOne("organization_members", {
    id: identity?.id,
  });
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { mutate } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: OrganizationMemberFormData) => {
      if (!data?.id) {
        throw new Error("Record not found");
      }
      return dataProvider.organizationMemberUpdate(data.id, data);
    },
    onSuccess: () => {
      refetchIdentity();
      refetchUser();
      setEditMode(false);
      notify("Your profile has been updated");
    },
    onError: (_) => {
      notify("An error occurred. Please try again", {
        type: "error",
      });
    },
  });

  if (!identity) return null;

  const handleOnSubmit = async (values: any) => {
    mutate(values);
  };

  return (
    <div className="max-w-lg mx-auto mt-8">
      <Form onSubmit={handleOnSubmit} record={data}>
        <ProfileForm isEditMode={isEditMode} setEditMode={setEditMode} />
      </Form>
    </div>
  );
};

const ProfileForm = ({
  isEditMode,
  setEditMode,
}: {
  isEditMode: boolean;
  setEditMode: (value: boolean) => void;
}) => {
  const notify = useNotify();
  const record = useRecordContext<OrganizationMember>();
  const { identity, refetch } = useGetIdentity();
  const { isDirty } = useFormState();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const { mutate: mutateSale } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: OrganizationMemberFormData) => {
      if (!record) {
        throw new Error("Record not found");
      }
      return dataProvider.organizationMemberUpdate(record.id, data);
    },
    onSuccess: () => {
      refetch();
      notify("Your profile has been updated");
    },
    onError: () => {
      notify("An error occurred. Please try again.");
    },
  });
  if (!identity) return null;

  const resetPasswordForm = () => {
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleClickOpenPasswordChange = () => {
    resetPasswordForm();
    setPasswordDialogOpen(true);
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
      if (error) {
        throw error;
      }
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

  const handleAvatarUpdate = async (values: any) => {
    mutateSale(values);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="mb-4 flex flex-row justify-between">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Profile
            </h2>
          </div>

          <div className="space-y-4 mb-4">
            <ImageEditorField
              source="avatar"
              type="avatar"
              onSave={handleAvatarUpdate}
              linkPosition="right"
            />
            <TextRender source="first_name" isEditMode={isEditMode} />
            <TextRender source="last_name" isEditMode={isEditMode} />
            <TextRender source="email" isEditMode={isEditMode} />
          </div>

          <div className="flex flex-row justify-end gap-2">
            {!isEditMode && (
              <>
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleClickOpenPasswordChange}
                >
                  Change password
                </Button>
              </>
            )}

            <Button
              type="button"
              variant={isEditMode ? "ghost" : "outline"}
              onClick={() => setEditMode(!isEditMode)}
              className="flex items-center"
            >
              {isEditMode ? <CircleX /> : <Pencil />}
              {isEditMode ? "Cancel" : "Edit"}
            </Button>

            {isEditMode && (
              <Button type="submit" disabled={!isDirty} variant="outline">
                <Save />
                Save
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <ProfileNotificationsSection />
      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open);
          if (!open) {
            resetPasswordForm();
          }
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
              onClick={handlePasswordChange}
              disabled={passwordSaving}
            >
              Save password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {import.meta.env.VITE_INBOUND_EMAIL && (
        <Card>
          <CardContent>
            <div className="space-y-4 justify-between">
              <h2 className="text-xl font-semibold text-muted-foreground">
                Inbound email
              </h2>
              <p className="text-sm text-muted-foreground">
                You can start sending emails to your server's inbound email
                address, e.g. by adding it to the
                <b> Cc: </b> field. Nomi CRM will process the emails and add
                notes to the corresponding contacts.
              </p>
              <CopyPaste />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const TextRender = ({
  source,
  isEditMode,
}: {
  source: string;
  isEditMode: boolean;
}) => {
  if (isEditMode) {
    if (source === "email") {
      return <EmailInput source={source} helperText={false} />;
    }
    return <TextInput source={source} helperText={false} />;
  }
  return (
    <div className="m-2">
      <RecordField source={source} />
    </div>
  );
};

const CopyPaste = () => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    setCopied(true);
    navigator.clipboard.writeText(import.meta.env.VITE_INBOUND_EMAIL);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={handleCopy}
            variant="ghost"
            className="normal-case justify-between w-full"
          >
            <span className="overflow-hidden text-ellipsis">
              {import.meta.env.VITE_INBOUND_EMAIL}
            </span>
            <Copy className="h-4 w-4 ml-2" />
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
