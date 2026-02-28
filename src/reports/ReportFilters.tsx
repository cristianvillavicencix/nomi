import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const ReportDateFilters = ({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
    <div>
      <Label htmlFor="report_from">From</Label>
      <Input id="report_from" type="date" value={from} onChange={(e) => onFromChange(e.target.value)} />
    </div>
    <div>
      <Label htmlFor="report_to">To</Label>
      <Input id="report_to" type="date" value={to} onChange={(e) => onToChange(e.target.value)} />
    </div>
  </div>
);
