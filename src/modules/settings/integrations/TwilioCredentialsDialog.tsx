import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { MessagingSettingsPublic } from "@/modules/types";
import { TwilioCredentialsForm } from "@/modules/settings/integrations/TwilioCredentialsForm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: MessagingSettingsPublic | undefined;
  connected?: boolean;
  onSave: (
    payload: Parameters<CrmDataProvider["updateMessagingSettings"]>[0],
  ) => Promise<MessagingSettingsPublic>;
  onPatch?: (
    payload: Parameters<CrmDataProvider["updateMessagingSettings"]>[0],
  ) => Promise<MessagingSettingsPublic>;
  saving?: boolean;
  patching?: boolean;
};

/** @deprecated Prefer TwilioIntegrationPanel in Settings → Integrations. */
export const TwilioCredentialsDialog = ({
  open,
  onOpenChange,
  settings,
  connected = false,
  onSave,
  onPatch,
  saving,
  patching,
}: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Twilio credentials</DialogTitle>
      </DialogHeader>
      <TwilioCredentialsForm
        settings={settings}
        connected={connected}
        onSave={onSave}
        onPatch={onPatch ?? onSave}
        saving={saving}
        patching={patching}
        onSaveSuccess={() => onOpenChange(false)}
      />
    </DialogContent>
  </Dialog>
);
