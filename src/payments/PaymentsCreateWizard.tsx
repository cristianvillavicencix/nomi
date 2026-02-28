import { useState } from 'react';
import { useDataProvider, useNotify, useRedirect } from 'ra-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CrmDataProvider } from '@/components/atomic-crm/providers/types';

type CreateData = {
  org_id: number;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  status: 'draft' | 'approved' | 'paid';
};

export const PaymentsCreateWizard = () => {
  const dataProvider = useDataProvider() as CrmDataProvider;
  const notify = useNotify();
  const redirect = useRedirect();

  const [formData, setFormData] = useState<CreateData>({
    org_id: 1,
    pay_period_start: new Date().toISOString().slice(0, 10),
    pay_period_end: new Date().toISOString().slice(0, 10),
    pay_date: new Date().toISOString().slice(0, 10),
    status: 'draft',
  });
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onCreateDraft = async () => {
    setIsLoading(true);
    try {
      const result = await dataProvider.create('payments', { data: formData });
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
