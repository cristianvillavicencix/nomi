import { useState } from "react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

export const AddWebsiteMonitorDialog = ({
  companyId,
  dealId,
  triggerLabel = "Agregar URL",
}: {
  companyId?: number | string;
  dealId?: number | string;
  triggerLabel?: string;
}) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [url, setUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notes, setNotes] = useState("");
  const [paths, setPaths] = useState("/");

  const reset = () => {
    setUrl("");
    setDisplayName("");
    setNotes("");
    setPaths("/");
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await dataProvider.websiteMonitorCreate({
        url,
        displayName: displayName || undefined,
        notes: notes || undefined,
        companyId,
        dealId,
        checkPaths: paths
          .split(/[\n,]+/)
          .map((path) => path.trim())
          .filter(Boolean),
      });
      notify("URL agregada al monitoreo", { type: "info" });
      refresh();
      setOpen(false);
      reset();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "No se pudo agregar la URL",
        { type: "error" },
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Plus className="mr-2 size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Monitorear sitio web</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wm-url">URL</Label>
            <Input
              id="wm-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://ejemplo.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wm-name">Nombre (opcional)</Label>
            <Input
              id="wm-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Sitio principal"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wm-paths">Rutas a analizar</Label>
            <Textarea
              id="wm-paths"
              value={paths}
              onChange={(event) => setPaths(event.target.value)}
              placeholder="/, /contact, /about"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Separa con comas o saltos de línea. La home siempre se incluye.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wm-notes">Notas (opcional)</Label>
            <Textarea
              id="wm-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving || !url.trim()}
          >
            {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
