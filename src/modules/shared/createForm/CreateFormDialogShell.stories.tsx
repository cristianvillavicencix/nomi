import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CreateFormDialogShell } from "@/modules/shared/createForm/CreateFormDialogShell";

const meta = {
  title: "Chrome/CreateFormDialogShell",
  component: CreateFormDialogShell,
} satisfies Meta<typeof CreateFormDialogShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  args: {
    icon: Plus,
    iconTone: "info",
    title: "New invoice",
    description: "Create a payment request for this client.",
    isMobile: false,
    onClose: () => undefined,
    submitLabel: "Create",
    children: (
      <p className="text-sm text-muted-foreground">Form fields go here.</p>
    ),
  },
  render: (args) => (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="gap-0 p-0 sm:max-w-lg">
        <CreateFormDialogShell {...args} />
      </DialogContent>
    </Dialog>
  ),
};
