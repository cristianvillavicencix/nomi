import { useMemo, useState } from 'react';
import { useGetMany, useListContext } from 'ra-core';
import { PanelLeftClose, PanelRightOpen, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { PaymentLine, Person, Deal } from '@/components/atomic-crm/types';
import { cn } from '@/lib/utils';

export type PaymentLinesScope =
  | 'all'
  | 'sales_commissions'
  | 'hourly'
  | 'salaried'
  | 'subcontractor';

const formatMoney = (value?: number | null) => {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const sumLineTotal = (line: PaymentLine) =>
  Number(line.total_pay ?? line.amount ?? 0);

type PaymentLinesTableContentProps = {
  lines: PaymentLine[];
  scope?: PaymentLinesScope;
  isPending?: boolean;
};

const getPersonPaymentTypeLabel = (line: PaymentLine | undefined, person?: Person) => {
  if (line?.source_type === 'commission' || person?.type === 'salesperson') return 'Commission';
  if (person?.type === 'subcontractor') return 'Subcontractor';
  if (
    line?.compensation_type === 'weekly_salary' ||
    line?.compensation_type === 'monthly_salary' ||
    line?.compensation_type === 'fixed_salary' ||
    person?.compensation_type === 'weekly_salary' ||
    person?.compensation_type === 'monthly_salary' ||
    person?.compensation_type === 'fixed_salary'
  ) {
    return 'Salary';
  }
  return 'Hourly';
};

const getPaymentTypeBadgeClassName = (typeLabel: string, isActive: boolean) => {
  if (typeLabel === 'Salary') {
    return isActive
      ? 'border-emerald-300 bg-emerald-600 text-white'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (typeLabel === 'Commission') {
    return isActive
      ? 'border-amber-300 bg-amber-500 text-white'
      : 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (typeLabel === 'Subcontractor') {
    return isActive
      ? 'border-slate-300 bg-slate-700 text-white'
      : 'border-slate-200 bg-slate-100 text-slate-700';
  }
  return isActive
    ? 'border-sky-300 bg-sky-600 text-white'
    : 'border-sky-200 bg-sky-50 text-sky-700';
};

const PaymentLinesTableContent = ({
  lines,
  scope = 'all',
  isPending = false,
}: PaymentLinesTableContentProps) => {
  const data = lines;

  const personIds = useMemo(
    () =>
      Array.from(
        new Set(
          data
            .map((line) => line.person_id)
            .filter((id): id is NonNullable<typeof id> => id != null),
        ),
      ),
    [data],
  );
  const projectIds = useMemo(
    () =>
      Array.from(
        new Set(
          data
            .map((line) => line.project_id)
            .filter((id): id is NonNullable<typeof id> => id != null),
        ),
      ),
    [data],
  );

  const { data: people = [] } = useGetMany<Person>(
    'people',
    { ids: personIds },
    { enabled: personIds.length > 0 },
  );
  const { data: projects = [] } = useGetMany<Deal>(
    'deals',
    { ids: projectIds },
    { enabled: projectIds.length > 0 },
  );

  const peopleById = useMemo(
    () => Object.fromEntries(people.map((person) => [String(person.id), person])),
    [people],
  );
  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((project) => [String(project.id), project])),
    [projects],
  );

  const filteredRows = useMemo(() => {
    if (scope === 'all') return data;
    return data.filter((line) => {
      const person = peopleById[String(line.person_id)];
      if (scope === 'sales_commissions') {
        return line.source_type === 'commission' || person?.type === 'salesperson';
      }
      if (scope === 'salaried') {
        return (
          line.source_type === 'salary' ||
          line.compensation_type === 'weekly_salary' ||
          line.compensation_type === 'monthly_salary' ||
          line.compensation_type === 'fixed_salary' ||
          person?.compensation_type === 'weekly_salary' ||
          person?.compensation_type === 'monthly_salary' ||
          person?.compensation_type === 'fixed_salary'
        );
      }
      if (scope === 'subcontractor') {
        return person?.type === 'subcontractor';
      }
      // scope === 'hourly'
      return (
        line.source_type === 'time_entry' ||
        (person?.type === 'employee' && line.source_type !== 'commission')
      );
    });
  }, [data, peopleById, scope]);

  if (isPending) return null;
  if (!filteredRows.length) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        No payment lines for this scope.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left border-b">
            <th className="py-2 px-3">Source Type</th>
            <th className="py-2 px-3">Compensation</th>
            <th className="py-2 px-3">Person</th>
            <th className="py-2 px-3">Project</th>
            <th className="py-2 px-3">Hours</th>
            <th className="py-2 px-3">Regular Pay</th>
            <th className="py-2 px-3">Overtime Pay</th>
            <th className="py-2 px-3">Bonuses</th>
            <th className="py-2 px-3">Deductions</th>
            <th className="py-2 px-3">Rate</th>
            <th className="py-2 px-3">Amount</th>
            <th className="py-2 px-3">Notes</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((line) => {
            const person = peopleById[String(line.person_id)];
            const project = line.project_id
              ? projectsById[String(line.project_id)]
              : undefined;
            const personName = person
              ? `${person.first_name} ${person.last_name}`.trim()
              : '—';
            return (
              <tr key={line.id} className="border-b">
                <td className="py-2 px-3">{line.source_type}</td>
                <td className="py-2 px-3">
                  {line.compensation_unit ?? person?.compensation_unit ?? line.compensation_type ?? person?.compensation_type ?? '—'}
                </td>
                <td className="py-2 px-3">{personName || '—'}</td>
                <td className="py-2 px-3">{project?.name || '—'}</td>
                <td className="py-2 px-3">{line.qty_hours ?? '—'}</td>
                <td className="py-2 px-3">{formatMoney(line.regular_pay)}</td>
                <td className="py-2 px-3">{formatMoney(line.overtime_pay)}</td>
                <td className="py-2 px-3">{formatMoney(line.bonuses)}</td>
                <td className="py-2 px-3">{formatMoney(line.deductions)}</td>
                <td className="py-2 px-3">{formatMoney(line.rate)}</td>
                <td className="py-2 px-3">{formatMoney(line.total_pay ?? line.amount)}</td>
                <td className="py-2 px-3">{line.notes || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const PaymentLinesTable = ({ scope = 'all' }: { scope?: PaymentLinesScope }) => {
  const { data = [], isPending } = useListContext<PaymentLine>();

  return <PaymentLinesTableContent lines={data} scope={scope} isPending={isPending} />;
};

export const PaymentLinesTableForData = ({
  lines,
  scope = 'all',
  isPending = false,
}: PaymentLinesTableContentProps) => (
  <PaymentLinesTableContent lines={lines} scope={scope} isPending={isPending} />
);

export const PaymentLinesExplorer = ({
  lines,
  scope = 'all',
  isPending = false,
  activePersonId: controlledActivePersonId,
  onActivePersonChange,
}: PaymentLinesTableContentProps & {
  activePersonId?: number | null;
  onActivePersonChange?: (personId: number | null) => void;
}) => {
  const [query, setQuery] = useState('');
  const [internalActivePersonId, setInternalActivePersonId] = useState<number | null>(null);
  const [minimized, setMinimized] = useState(false);
  const activePersonId =
    controlledActivePersonId === undefined ? internalActivePersonId : controlledActivePersonId;

  const setActivePersonId = (personId: number | null) => {
    if (controlledActivePersonId === undefined) {
      setInternalActivePersonId(personId);
    }
    onActivePersonChange?.(personId);
  };

  const personIds = useMemo(
    () =>
      Array.from(
        new Set(
          lines
            .map((line) => Number(line.person_id))
            .filter(Boolean),
        ),
      ),
    [lines],
  );

  const { data: people = [], isPending: peoplePending } = useGetMany<Person>(
    'people',
    { ids: personIds },
    { enabled: personIds.length > 0 },
  );

  const filteredPeople = useMemo(() => {
    const term = query.trim().toLowerCase();
    const peopleWithLines = people.filter((person) =>
      lines.some((line) => Number(line.person_id) === Number(person.id)),
    );
    if (!term) return peopleWithLines;
    return peopleWithLines.filter((person) => {
      const name = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim().toLowerCase();
      const email = String(person.email ?? '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [lines, people, query]);

  const filteredLines = useMemo(
    () =>
      activePersonId == null
        ? lines
        : lines.filter((line) => Number(line.person_id) === activePersonId),
    [activePersonId, lines],
  );

  return (
    <div className="flex h-full min-h-0 gap-3 overflow-hidden">
      {minimized ? (
        <aside className="hidden h-full min-h-0 w-12 shrink-0 self-start xl:flex flex-col items-center py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMinimized(false)}
            aria-label="Expand payment people panel"
            title="Expand payment people panel"
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
          <span className="mt-4 rotate-180 text-[10px] uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
            People
          </span>
        </aside>
      ) : (
        <aside className="hidden h-full min-h-0 w-[20rem] shrink-0 self-start xl:flex flex-col">
          <div className="space-y-3 px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">People</h3>
                <p className="text-xs text-muted-foreground">Quick navigation</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMinimized(true)}
                aria-label="Minimize payment people panel"
                title="Minimize payment people panel"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search people (${people.length})`}
                className="h-9 pl-8"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
            <button
              type="button"
              className={cn(
                'mb-1.5 w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-all hover:bg-muted/60',
                activePersonId == null &&
                  'border-primary/50 bg-secondary/70 shadow-sm ring-1 ring-primary/10',
              )}
              onClick={() => setActivePersonId(null)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">All people</span>
                <Badge variant="secondary" className="px-2 py-0 text-[10px] uppercase tracking-wide">
                  {lines.length} lines
                </Badge>
              </div>
            </button>
            {peoplePending ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredPeople.length === 0 ? (
              <div className="px-1 py-2 text-sm text-muted-foreground">No people found.</div>
            ) : (
              <div className="space-y-1.5">
                {filteredPeople.map((person) => {
                  const isActive = Number(person.id) === activePersonId;
                  const personLines = lines.filter(
                    (line) => Number(line.person_id) === Number(person.id),
                  );
                  const personLineCount = personLines.length;
                  const personTotal = personLines.reduce(
                    (sum, line) => sum + sumLineTotal(line),
                    0,
                  );
                  const personType = getPersonPaymentTypeLabel(
                    lines.find((line) => Number(line.person_id) === Number(person.id)) ?? lines[0],
                    person,
                  );

                  return (
                    <button
                      key={person.id}
                      type="button"
                      className={cn(
                        'w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-all hover:bg-muted/60',
                        isActive &&
                          'border-primary/50 bg-secondary/70 shadow-sm ring-1 ring-primary/10',
                      )}
                      onClick={() => setActivePersonId(Number(person.id))}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                        <div className="font-medium">
                          {`${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {formatMoney(personTotal)} · {personLineCount} payment lines
                        </div>
                      </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'shrink-0 px-2 py-0 text-[10px] uppercase tracking-wide',
                            getPaymentTypeBadgeClassName(personType, isActive),
                          )}
                        >
                          {personType}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      )}

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <PaymentLinesTableForData lines={filteredLines} scope={scope} isPending={isPending} />
      </div>
    </div>
  );
};
