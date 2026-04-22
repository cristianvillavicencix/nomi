import { useState } from 'react';
import { useDataProvider, useGetIdentity, useNotify, useRedirect } from 'ra-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CrmDataProvider } from '@/components/atomic-crm/providers/types';

type CreateData = {
  org_id: number;
  run_name?: string;
  category?: 'hourly' | 'salaried' | 'subcontractor' | 'sales_commissions' | 'mixed';
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  status: 'draft' | 'approved' | 'paid';
  created_by?: string;
};

export const PaymentsCreateWizard = () => {
  const dataProvider = useDataProvider() as CrmDataProvider;
  const { data: identity } = useGetIdentity();
  const notify = useNotify();
  const redirect = useRedirect();

  const [formData, setFormData] = useState<CreateData>({
    org_id: 1,
    run_name: '',
    category: 'hourly',
    pay_period_start: new Date().toISOString().slice(0, 10),
    pay_period_end: new Date().toISOString().slice(0, 10),
    pay_date: new Date().toISOString().slice(0, 10),
    status: 'draft',
    created_by: 'Current User',
  });
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onCreateDraft = async () => {
    setIsLoading(true);
    try {
      const result = await dataProvider.create('payments', { data: formData, meta: { identity } });
      setPaymentId(result.data.id as number);
      notify('Draft payment created');
    } catch {
      notify('Could not create payment', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const onGenerateLines = async () => {
    if (!paymentId) return;
    setIsLoading(true);
    try {
      const created = await dataProvider.generatePaymentLines(paymentId);
      notify(`Generated ${created ?? 0} payment lines`);
      redirect(`/payments/${paymentId}/show`);
    } catch {
      notify('Could not generate payment lines', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6 max-w-xl">
        <h1 className="text-xl font-semibold">Payment Wizard</h1>
        <p className="text-sm text-muted-foreground">
          Step 1: define period and pay date. Step 2: generate lines from approved hours.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="run_name">Run Name</Label>
            <Input
              id="run_name"
              value={formData.run_name ?? ''}
              onChange={(e) => setFormData((s) => ({ ...s, run_name: e.target.value }))}
              placeholder="Example: Hourly Payroll - Week 1"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
              value={formData.category ?? 'hourly'}
              onChange={(e) =>
                setFormData((s) => ({
                  ...s,
                  category: e.target.value as CreateData['category'],
                }))
              }
            >
              <option value="hourly">Hourly Staff</option>
              <option value="salaried">Salaried Staff</option>
              <option value="subcontractor">Subcontractors</option>
              <option value="sales_commissions">Sales Commissions</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pay_period_start">Period Start</Label>
            <Input
              id="pay_period_start"
              type="date"
              value={formData.pay_period_start}
              onChange={(e) => setFormData((s) => ({ ...s, pay_period_start: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pay_period_end">Period End</Label>
            <Input
              id="pay_period_end"
              type="date"
              value={formData.pay_period_end}
              onChange={(e) => setFormData((s) => ({ ...s, pay_period_end: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pay_date">Pay Date</Label>
            <Input
              id="pay_date"
              type="date"
              value={formData.pay_date}
              onChange={(e) => setFormData((s) => ({ ...s, pay_date: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex gap-2">
          {!paymentId ? (
            <Button onClick={onCreateDraft} disabled={isLoading}>
              Create Draft Payment
            </Button>
          ) : (
            <>
              <Button onClick={onGenerateLines} disabled={isLoading}>
                Generate lines from approved time entries in period
              </Button>
              <Button variant="outline" onClick={() => redirect(`/payments/${paymentId}`)}>
                Open Payment
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
