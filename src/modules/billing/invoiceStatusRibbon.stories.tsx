import type { Meta, StoryObj } from "@storybook/react-vite";
import { resolveInvoiceStatusRibbon } from "@/modules/billing/invoiceStatusRibbon";

const Ribbon = ({
  status,
  due_date,
}: {
  status: string;
  due_date: string | null;
}) => {
  const ribbon = resolveInvoiceStatusRibbon({ status, due_date });
  if (!ribbon) return <span className="text-sm text-muted-foreground">No ribbon</span>;
  return (
    <span className={`inline-flex px-3 py-1 text-xs font-bold uppercase ${ribbon.className}`}>
      {ribbon.label}
    </span>
  );
};

const meta = {
  title: "Status/InvoiceRibbon",
  component: Ribbon,
} satisfies Meta<typeof Ribbon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Paid: Story = { args: { status: "paid", due_date: null } };
export const Sent: Story = { args: { status: "sent", due_date: "2099-12-31" } };
export const Overdue: Story = { args: { status: "sent", due_date: "2000-01-01" } };
