import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { ROLE_PRESETS, type RoleSlug } from "@/lib/permissions/permissionCatalog";
import {
  getPresetDisplayLabel,
  normalizeCustomPresetSlug,
  type OrgCustomRolePreset,
  type OrgRbacConfig,
} from "@/lib/permissions/orgRolePresets";

type NewRolePresetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: number | string | undefined;
  rbacConfig: OrgRbacConfig;
  onSaved: (config: OrgRbacConfig) => void;
};

export const NewRolePresetDialog = ({
  open,
  onOpenChange,
  orgId,
  rbacConfig,
  onSaved,
}: NewRolePresetDialogProps) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [basedOn, setBasedOn] = useState<RoleSlug>("user");

  useEffect(() => {
    if (!open) {
      setName("");
      setBasedOn("user");
    }
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: async (nextConfig: OrgRbacConfig) => {
      if (orgId == null) throw new Error("Organization not loaded");
      const { error } = await supabase
        .from("organizations")
        .update({ rbac_config: nextConfig })
        .eq("id", orgId);
      if (error) throw error;
      return nextConfig;
    },
    onSuccess: (nextConfig) => {
      onSaved(nextConfig);
      void queryClient.invalidateQueries({ queryKey: ["settings", "org_seat_gate"] });
      notify("Role preset created", { type: "success" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      notify(error.message || "Could not save role preset", { type: "error" });
    },
  });

  const handleCreate = () => {
    const slug = normalizeCustomPresetSlug(name);
    if (!slug) {
      notify("Enter a valid role name", { type: "warning" });
      return;
    }
    if (rbacConfig.customPresets?.[slug]) {
      notify("A role with that name already exists", { type: "warning" });
      return;
    }

    const template: OrgCustomRolePreset = {
      label: name.trim(),
      basedOn,
      scopedToAssignedProjects: basedOn === "user",
      description: `Based on ${ROLE_PRESETS[basedOn].label}`,
    };

    saveMutation.mutate({
      ...rbacConfig,
      customPresets: {
        ...(rbacConfig.customPresets ?? {}),
        [slug]: template,
      },
    });
  };

  const customPresets = Object.entries(rbacConfig.customPresets ?? {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New role preset</DialogTitle>
          <DialogDescription>
            Create a reusable role for your workspace, then assign it when editing users.
          </DialogDescription>
        </DialogHeader>

        {customPresets.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Existing roles</p>
            <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
              {customPresets.map(([slug, preset]) => (
                <li
                  key={slug}
                  className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5"
                >
                  <span>{preset.label}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={saveMutation.isPending}
                    onClick={() => {
                      const next = { ...(rbacConfig.customPresets ?? {}) };
                      delete next[slug];
                      saveMutation.mutate({ ...rbacConfig, customPresets: next });
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-role-preset-name">Role name</Label>
            <Input
              id="new-role-preset-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Field operator"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Start from</Label>
            <Select value={basedOn} onValueChange={(value) => setBasedOn(value as RoleSlug)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_PRESETS) as RoleSlug[]).map((slug) => (
                  <SelectItem key={slug} value={slug}>
                    {getPresetDisplayLabel(slug, rbacConfig)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={saveMutation.isPending || !name.trim()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Create role
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
