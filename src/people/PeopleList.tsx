import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  useCreatePath,
  useGetIdentity,
  useListFilterContext,
  useNotify,
  useRecordContext,
  useRefresh,
  useUpdate,
} from "ra-core";
import { Link, useLocation, useNavigate } from "react-router";
import {
  DataTable,
  DateField,
  ExportButton,
  List,
  SelectInput,
} from "@/components/admin";
import { TopToolbar } from "@/components/atomic-crm/layout/TopToolbar";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { SpotlightSearchButton } from "@/components/atomic-crm/layout/SpotlightSearchButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Person } from "@/components/atomic-crm/types";
import { canUseCrmPermission } from "@/components/atomic-crm/providers/commons/crmPermissions";
import {
  compensationTypeLabels,
  compensationUnitLabels,
  formatRate,
  getPersonDisplayName,
  payTypeLabels,
  personStatusChoices,
  personTypeLabels,
} from "./constants";

const filters = [
  <SelectInput key="status" source="status" choices={personStatusChoices} />,
];

const NameField = () => {
  const record = useRecordContext<Person>();
  if (!record) return null;
  return <span>{getPersonDisplayName(record)}</span>;
};

const PersonOrBusinessField = () => {
  const record = useRecordContext<Person>();
  if (!record) return null;
  const name = getPersonDisplayName(record);
  if (name) return <span>{name}</span>;
  return <span>{record.business_name ?? "-"}</span>;
};

const EmailField = () => {
  const record = useRecordContext<Person>();
  if (!record) return null;
  return <span>{record.email ?? "-"}</span>;
};

const PhoneField = () => {
  const record = useRecordContext<Person>();
  if (!record) return null;
  return <span>{record.phone ?? "-"}</span>;
};

const NotesField = () => {
  const record = useRecordContext<Person>();
  if (!record) return null;
  const value = String(record.notes ?? "").trim();
  if (!value) return <span>-</span>;
  return <span title={value}>{value.length > 40 ? `${value.slice(0, 40)}...` : value}</span>;
};

const SpecialtyField = () => {
  const record = useRecordContext<Person>();
  if (!record) return null;
  return <span>{record.specialty ?? "-"}</span>;
};

const CompensationModeField = () => {
  const record = useRecordContext<Person>();
  if (!record) return null;
  if (record.compensation_unit) {
    return (
      <span>
        {compensationUnitLabels[record.compensation_unit] ?? record.compensation_unit}
      </span>
    );
  }
  const mode = record.compensation_mode;
  if (mode === "hourly") return <span>Hourly</span>;
  if (mode === "salary") return <span>Salary</span>;
  if (mode === "day_rate") return <span>Daily</span>;
  if (record.compensation_type) {
    return (
      <span>
        {compensationTypeLabels[record.compensation_type] ?? record.compensation_type}
      </span>
    );
  }
  return <span>{payTypeLabels[record.pay_type] ?? "-"}</span>;
};

const RateField = () => {
  const record = useRecordContext<Person>();
  if (!record) return null;
  return <span>{formatRate(record)}</span>;
};

const StatusField = () => {
  const record = useRecordContext<Person>();
  if (!record) return null;
  return (
    <Badge variant={record.status === "active" ? "outline" : "secondary"}>
      {record.status}
    </Badge>
  );
};

const RowActionsField = () => {
  const record = useRecordContext<Person>();
  const createPath = useCreatePath();
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();

  if (!record) return null;

  const canManagePeople = canUseCrmPermission(identity as any, "people.manage");

  const nextStatus = record.status === "active" ? "inactive" : "active";

  const handleToggleStatus = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    update(
      "people",
      {
        id: record.id,
        data: { status: nextStatus },
        previousData: record,
        meta: { identity },
      },
      {
        onSuccess: () => {
          notify(
            nextStatus === "active"
              ? "Person activated"
              : "Person deactivated",
          );
          refresh();
        },
        onError: () => {
          notify("Could not update person status", { type: "error" });
        },
      },
    );
  };

  return (
    <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
      {canManagePeople ? (
        <>
          <Button asChild size="sm" variant="outline">
            <Link to={createPath({ resource: "people", id: record.id, type: "edit" })}>
              Edit
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={handleToggleStatus} disabled={isPending}>
            {record.status === "active" ? "Deactivate" : "Activate"}
          </Button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">Read only</span>
      )}
    </div>
  );
};

const personTypeTabs: Array<{ value: Person["type"]; label: string }> = [
  { value: "employee", label: "Employees" },
  { value: "salesperson", label: "Salespeople" },
  { value: "subcontractor", label: "Subcontractors" },
];

const quickGroupByType: Record<Person["type"], string> = {
  employee: "employees",
  salesperson: "salespeople",
  subcontractor: "subcontractors",
};

const getTypeFromSearch = (search: string): Person["type"] => {
  const params = new URLSearchParams(search);
  const type = params.get("type");
  if (
    type === "employee" ||
    type === "salesperson" ||
    type === "subcontractor"
  ) {
    return type;
  }
  return "employee";
};

const PeopleListActions = ({
  activeType,
  onTypeChange,
}: {
  activeType: Person["type"];
  onTypeChange: (nextType: Person["type"]) => void;
}) => {
  const { data: identity } = useGetIdentity();
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const canManagePeople = canUseCrmPermission(identity as any, "people.manage");
  const [query, setQuery] = useState("");

  useEffect(() => {
    // Clean stale `q` filters from previous implementations. For people search
    // we now use an explicit @or filter against real columns.
    if (typeof filterValues.q === "string") {
      const nextFilterValues = { ...filterValues };
      delete nextFilterValues.q;
      setFilters(nextFilterValues, displayedFilters);
    }
  }, [displayedFilters, filterValues, setFilters]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const nextFilterValues = { ...filterValues };
      delete nextFilterValues.q;

      const nextQuery = query.trim();
      const currentOr = filterValues["@or"];
      if (nextQuery) {
        const ilikeValue = `%${nextQuery}%`;
        const nextOr = {
          "first_name@ilike": ilikeValue,
          "last_name@ilike": ilikeValue,
          "email@ilike": ilikeValue,
          "business_name@ilike": ilikeValue,
          "specialty@ilike": ilikeValue,
        };
        if (JSON.stringify(currentOr) === JSON.stringify(nextOr)) {
          return;
        }
        nextFilterValues["@or"] = nextOr;
      } else {
        if (currentOr == null) {
          return;
        }
        delete nextFilterValues["@or"];
      }
      setFilters(nextFilterValues, displayedFilters);
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [displayedFilters, filterValues, query, setFilters]);

  return (
    <TopToolbar className="w-full justify-between items-center">
      <Tabs value={activeType} onValueChange={(value) => onTypeChange(value as Person["type"])}>
        <TabsList>
          {personTypeTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-2">
        <SpotlightSearchButton
          title="Search People"
          description="Find employees, salespeople, or subcontractors in one focused search."
          placeholder="Search people..."
          value={query}
          onValueChange={setQuery}
        />
        <ExportButton />
        {canManagePeople ? (
          <Button asChild variant="outline">
            <Link to={`/people/create?type=${activeType}`}>New {personTypeLabels[activeType]}</Link>
          </Button>
        ) : null}
        <ModuleInfoPopover
          title="People"
          description="Unified team records for employees, salespeople, and subcontractors."
        />
      </div>
    </TopToolbar>
  );
};

export const PeopleList = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeType = useMemo(
    () => getTypeFromSearch(location.search),
    [location.search],
  );

  const permanentFilter = useMemo(() => {
    return { type: activeType };
  }, [activeType]);

  return (
    <List
      title={false}
      disableBreadcrumb
      actions={
        <PeopleListActions
          activeType={activeType}
          onTypeChange={(nextType) => navigate(`/people?type=${nextType}`)}
        />
      }
      sort={{ field: "created_at", order: "DESC" }}
      filter={permanentFilter}
      filters={filters}
    >
      <DataTable
        rowClick={(_id, _resource, record) => {
          const group = quickGroupByType[(record as Person).type ?? activeType];
          return `/people/${group}/${record.id}`;
        }}
        rowDoubleClick="edit"
      >
        {activeType === "employee" ? (
          <>
            <DataTable.Col label="Name">
              <NameField />
            </DataTable.Col>
            <DataTable.Col label="Compensation">
              <CompensationModeField />
            </DataTable.Col>
            <DataTable.Col label="Rate">
              <RateField />
            </DataTable.Col>
            <DataTable.Col source="status" label="Status">
              <StatusField />
            </DataTable.Col>
            <DataTable.Col source="created_at" label="Created At">
              <DateField source="created_at" />
            </DataTable.Col>
            <DataTable.Col label="Actions">
              <RowActionsField />
            </DataTable.Col>
          </>
        ) : null}

        {activeType === "salesperson" ? (
          <>
            <DataTable.Col label="Name">
              <NameField />
            </DataTable.Col>
            <DataTable.Col label="Email">
              <EmailField />
            </DataTable.Col>
            <DataTable.Col label="Phone">
              <PhoneField />
            </DataTable.Col>
            <DataTable.Col source="status" label="Status">
              <StatusField />
            </DataTable.Col>
            <DataTable.Col label="Notes">
              <NotesField />
            </DataTable.Col>
            <DataTable.Col source="created_at" label="Created At">
              <DateField source="created_at" />
            </DataTable.Col>
            <DataTable.Col label="Actions">
              <RowActionsField />
            </DataTable.Col>
          </>
        ) : null}

        {activeType === "subcontractor" ? (
          <>
            <DataTable.Col label="Name / Business">
              <PersonOrBusinessField />
            </DataTable.Col>
            <DataTable.Col label="Trade / Specialty">
              <SpecialtyField />
            </DataTable.Col>
            <DataTable.Col label="Email">
              <EmailField />
            </DataTable.Col>
            <DataTable.Col label="Phone">
              <PhoneField />
            </DataTable.Col>
            <DataTable.Col source="status" label="Status">
              <StatusField />
            </DataTable.Col>
            <DataTable.Col source="created_at" label="Created At">
              <DateField source="created_at" />
            </DataTable.Col>
            <DataTable.Col label="Actions">
              <RowActionsField />
            </DataTable.Col>
          </>
        ) : null}
      </DataTable>
    </List>
  );
};
