import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "@/components/ui/badge";

const meta = {
  title: "Chrome/Badge",
  component: Badge,
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = { args: { variant: "success", children: "Paid" } };
export const Warning: Story = { args: { variant: "warning", children: "Due soon" } };
export const Info: Story = { args: { variant: "info", children: "Sent" } };
export const Destructive: Story = {
  args: { variant: "destructive", children: "Overdue" },
};
