import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useDataProvider, useDelete, useGetList, useNotify } from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useFormBuilder } from "@/lbs/forms-v2/builder/FormBuilderContext";
import { FormVersionsTab } from "@/lbs/forms-v2/builder/FormVersionsTab";
import { MemberPhoneStatus } from "@/lbs/settings/MemberPhoneStatus";

type FormSettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const FormSettingsSheet = ({
  open,
  onOpenChange,
}: FormSettingsSheetProps) => {
  const navigate = useNavigate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [deleteOne] = useDelete();
  const { formInstance, setFormInstance, save, schema, setSchema } =
    useFormBuilder();
  const [notifyIds, setNotifyIds] = useState<number[]>(
    formInstance.notify_member_ids ?? [],
  );
  const [publicUrl, setPublicUrl] = useState("");

  const { data: orgDefaults } = useQuery({
    queryKey: ["organization-form-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("default_form_notify_member_ids")
        .single();
      if (error) throw error;
      return (data?.default_form_notify_member_ids ?? []) as number[];
    },
    enabled: open,
  });

  const { data: members = [] } = useGetList<OrganizationMember>(
    "organization_members",
    {
      filter: { "disabled@eq": false },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "first_name", order: "ASC" },
    },
    { enabled: open },
  );

  useEffect(() => {
    setNotifyIds(formInstance.notify_member_ids ?? []);
  }, [formInstance.notify_member_ids, open]);

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        id: Number(member.id),
        label: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim(),
        notification_phone: member.notification_phone,
      })),
    [members],
  );

  const persistMutation = useMutation({
    mutationFn: async () => {
      setFormInstance({ notify_member_ids: notifyIds });
      await save();
    },
    onSuccess: () => {
      notify("Form settings saved", { type: "success" });
      onOpenChange(false);
    },
    onError: (error) => {
      notify(
        error instanceof Error ? error.message : "Failed to save settings",
        {
          type: "error",
        },
      );
    },
  });

  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      const result = await dataProvider.generateFormToken({
        formInstanceId: Number(formInstance.id),
        expiresInDays: 30,
        maxUses: null,
      });
      setPublicUrl(
        result.url.startsWith("http")
          ? result.url
          : `${window.location.origin}${result.url}`,
      );
      return result;
    },
    onError: (error) => {
      notify(
        error instanceof Error ? error.message : "Failed to generate link",
        {
          type: "error",
        },
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteOne("form_instances", { id: formInstance.id });
    },
    onSuccess: () => {
      notify("Form deleted", { type: "info" });
      onOpenChange(false);
      navigate("/forms-v2");
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to delete form", {
        type: "error",
      });
    },
  });

  const copyText = async (text: string, message: string) => {
    await navigator.clipboard.writeText(text);
    notify(message, { type: "info" });
  };

  const embedIframe = publicUrl
    ? `<iframe src="${publicUrl}" width="100%" height="720" frameborder="0"></iframe>`
    : "";
  const embedScript = publicUrl
    ? `<script src="${window.location.origin}/embed/forms.js" data-form-url="${publicUrl}"></script>`
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Form settings</SheetTitle>
          <SheetDescription>
            Branding, notifications, anti-spam, and distribution options.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="general" className="mt-6">
          <TabsList className="flex h-auto w-full flex-wrap gap-1">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="anti-spam">Anti-spam</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formInstance.description ?? ""}
                onChange={(event) =>
                  setFormInstance({ description: event.target.value })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={Boolean(formInstance.is_active)}
                onCheckedChange={(checked) =>
                  setFormInstance({ is_active: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Public</Label>
              <Switch
                checked={formInstance.is_public !== false}
                onCheckedChange={(checked) =>
                  setFormInstance({ is_public: checked })
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="branding" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Primary color</Label>
              <Input
                type="color"
                value={formInstance.primary_color ?? "#1E5FA8"}
                onChange={(event) =>
                  setFormInstance({ primary_color: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Welcome title</Label>
              <Input
                value={formInstance.welcome_title ?? ""}
                onChange={(event) =>
                  setFormInstance({ welcome_title: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Welcome message</Label>
              <Textarea
                value={formInstance.welcome_message ?? ""}
                onChange={(event) =>
                  setFormInstance({ welcome_message: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Thank you title</Label>
              <Input
                value={formInstance.thank_you_title ?? ""}
                onChange={(event) =>
                  setFormInstance({ thank_you_title: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Thank you message</Label>
              <Textarea
                value={formInstance.thank_you_message ?? ""}
                onChange={(event) =>
                  setFormInstance({ thank_you_message: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Redirect URL</Label>
              <Input
                value={formInstance.redirect_url ?? ""}
                onChange={(event) =>
                  setFormInstance({ redirect_url: event.target.value })
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <Label>Notify team on submit</Label>
              <Switch
                checked={formInstance.notify_on_submit !== false}
                onCheckedChange={(checked) =>
                  setFormInstance({ notify_on_submit: checked })
                }
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>SMS recipients</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setNotifyIds(orgDefaults ?? [])}
                >
                  <RotateCcw className="size-4" />
                  Reset to org default
                </Button>
              </div>
              <div className="space-y-2">
                {memberOptions.map((member) => {
                  const checked = notifyIds.includes(member.id);
                  return (
                    <label
                      key={member.id}
                      className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={checked}
                        onCheckedChange={(next) =>
                          setNotifyIds((current) =>
                            next
                              ? [...new Set([...current, member.id])]
                              : current.filter((id) => id !== member.id),
                          )
                        }
                      />
                      <span className="space-y-0.5">
                        <span className="block font-medium">
                          {member.label}
                        </span>
                        <MemberPhoneStatus
                          phone={member.notification_phone}
                          selected={checked}
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <Label>Auto-create contact</Label>
              <Switch
                checked={Boolean(formInstance.auto_create_contact)}
                onCheckedChange={(checked) =>
                  setFormInstance({ auto_create_contact: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto-create lead</Label>
              <Switch
                checked={Boolean(formInstance.auto_create_lead)}
                onCheckedChange={(checked) =>
                  setFormInstance({ auto_create_lead: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto-create task</Label>
              <Switch
                checked={Boolean(formInstance.auto_create_task)}
                onCheckedChange={(checked) =>
                  setFormInstance({ auto_create_task: checked })
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="anti-spam" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <Label>reCAPTCHA enabled</Label>
              <Switch
                checked={formInstance.recaptcha_enabled !== false}
                onCheckedChange={(checked) =>
                  setFormInstance({ recaptcha_enabled: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Honeypot enabled</Label>
              <Switch
                checked={formInstance.honeypot_enabled !== false}
                onCheckedChange={(checked) =>
                  setFormInstance({ honeypot_enabled: checked })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Rate limit per IP / hour</Label>
              <Input
                type="number"
                min={0}
                value={formInstance.rate_limit_per_ip_per_hour ?? 5}
                onChange={(event) =>
                  setFormInstance({
                    rate_limit_per_ip_per_hour: Number(event.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Submission limit</Label>
              <Input
                type="number"
                min={0}
                value={formInstance.submission_limit ?? ""}
                onChange={(event) =>
                  setFormInstance({
                    submission_limit: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Public form URL</Label>
              <div className="flex gap-2">
                <Input
                  value={publicUrl}
                  readOnly
                  placeholder="Generate a link…"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={generateLinkMutation.isPending}
                  onClick={() => generateLinkMutation.mutate()}
                >
                  Generate
                </Button>
              </div>
              {publicUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void copyText(publicUrl, "Public URL copied")}
                >
                  <Copy className="size-4" />
                  Copy URL
                </Button>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Embed iframe</Label>
              <Textarea value={embedIframe} readOnly rows={3} />
              {embedIframe ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void copyText(embedIframe, "Embed code copied")
                  }
                >
                  <Copy className="size-4" />
                  Copy iframe
                </Button>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Embed script</Label>
              <Textarea value={embedScript} readOnly rows={3} />
              {embedScript ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void copyText(embedScript, "Script copied")}
                >
                  <Copy className="size-4" />
                  Copy script
                </Button>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="versions">
            <FormVersionsTab
              formInstanceId={Number(formInstance.id)}
              currentSchema={schema}
            />
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="wizard-mode">Wizard mode</Label>
              <Select
                value={schema.settings?.wizard_mode ?? "auto"}
                onValueChange={(value: "auto" | "on" | "off") =>
                  setSchema({
                    ...schema,
                    settings: {
                      ...schema.settings,
                      wizard_mode: value,
                    },
                  })
                }
              >
                <SelectTrigger id="wizard-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    Auto (multi-section with titles)
                  </SelectItem>
                  <SelectItem value="on">Always wizard</SelectItem>
                  <SelectItem value="off">Single page</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Controls whether public forms show one step at a time or all
                sections on one page.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Expiration date</Label>
              <Input
                type="datetime-local"
                value={
                  formInstance.expiration_date
                    ? formInstance.expiration_date.slice(0, 16)
                    : ""
                }
                onChange={(event) =>
                  setFormInstance({
                    expiration_date: event.target.value
                      ? new Date(event.target.value).toISOString()
                      : null,
                  })
                }
              />
            </div>
            <div className="rounded-lg border border-destructive/30 p-4">
              <Label className="text-destructive">Delete form</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Permanently removes this form and its submissions.
              </p>
              <Button
                type="button"
                variant="destructive"
                className="mt-3"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete "${formInstance.name}"? This cannot be undone.`,
                    )
                  ) {
                    deleteMutation.mutate();
                  }
                }}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete form
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            onClick={() => persistMutation.mutate()}
            disabled={persistMutation.isPending}
          >
            {persistMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Save settings
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
