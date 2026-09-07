import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusPill } from "@/modules/shared/status";

const meta = {
  title: "Status/StatusPill",
  component: StatusPill,
} satisfies Meta<typeof StatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = { args: { tone: "success", children: "Paid" } };
export const Warning: Story = { args: { tone: "warning", children: "Waiting" } };
export const Destructive: Story = {
  args: { tone: "destructive", children: "Overdue" },
};
export const Info: Story = { args: { tone: "info", children: "New" } };
export const Muted: Story = { args: { tone: "muted", children: "Draft" } };
