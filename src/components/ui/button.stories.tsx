import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/ui/button";

const meta = {
  title: "Chrome/Button",
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { children: "Save" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Cancel" },
};

export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete" },
};
