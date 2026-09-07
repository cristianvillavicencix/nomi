import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusPill } from "@/modules/shared/status";
import { ticketStatusTone } from "@/modules/tickets/ticketInboxConfig";

const TicketStatus = ({ status }: { status: string }) => (
  <StatusPill tone={ticketStatusTone(status)} className="capitalize">
    {status}
  </StatusPill>
);

const meta = {
  title: "Status/TicketPill",
  component: TicketStatus,
} satisfies Meta<typeof TicketStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const New: Story = { args: { status: "new" } };
export const Open: Story = { args: { status: "open" } };
export const Waiting: Story = { args: { status: "waiting" } };
export const Resolved: Story = { args: { status: "resolved" } };
