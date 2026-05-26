import { useEffect, useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

import { AvatarPicker, type AvatarPickerValue } from "./AvatarPicker";
import type { AvatarBearingRecord, AvatarType } from "./resolveAvatar";

type SaveTarget =
  | { kind: "organization_member"; id: string | number }
  | { kind: "person"; id: string | number };

/**
 * Reusable confirm-modal wrapping AvatarPicker. Used from places that
 * don't already host a form (e.g. profile page, people show). The save
 * routes to `dataProvider.organizationMemberUpdate` for org members and to
 * `dataProvider.update("people")` for people rows.
 */
export const EditAvatarDialog = ({
  open,
  onOpenChange,
  record,
  target,
  folder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: AvatarBearingRecord;
  target: SaveTarget;
  folder?: string;
}) => {
  const initialValue: AvatarPickerValue = {
    avatar_type: (record.avatar_type as AvatarType | null) ?? null,
    avatar_url: record.avatar_url ?? null,
  };
  const [value, setValue] = useState<AvatarPickerValue>(initialValue);
  const [saving, setSaving] = useState(false);
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();

  useEffect(() => {
    if (open) {
      setValue({
        avatar_type: (record.avatar_type as AvatarType | null) ?? null,
        avatar_url: record.avatar_url ?? null,
      });
    }
  }, [open, record.avatar_type, record.avatar_url]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (target.kind === "organization_member") {
        await dataProvider.organizationMemberUpdate(target.id, {
          avatar_type: value.avatar_type,
          avatar_url: value.avatar_url,
        } as any);
      } else {
        await dataProvider.update("people", {
          id: target.id,
          data: {
            avatar_type: value.avatar_type,
            avatar_url: value.avatar_url,
          },
          previousData: record as any,
        });
      }
      notify("Avatar actualizado", { type: "info" });
      refresh();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo guardar el avatar";
      notify(message, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cambiar avatar</DialogTitle>
          <DialogDescription>
            Elige un personaje de Open Peeps o sube tu propia foto.
          </DialogDescription>
        </DialogHeader>
        <AvatarPicker
          value={value}
          onChange={setValue}
          record={record}
          authUserId={identity?.id != null ? String(identity.id) : null}
          folder={folder}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
