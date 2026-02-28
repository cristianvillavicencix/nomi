import { useMemo, type MouseEvent } from "react";
import {
  useCreatePath,
  useNotify,
  useRecordContext,
  useRefresh,
  useUpdate,
} from "ra-core";
import { Link, useLocation } from "react-router";
import {
  CreateButton,
  DataTable,
  DateField,
  ExportButton,
  List,
  SearchInput,
  SelectInput,
} from "@/components/admin";
import { TopToolbar } from "@/components/atomic-crm/layout/TopToolbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Person } from "@/components/atomic-crm/types";
import {
  formatRate,
  getPersonDisplayName,
  payTypeChoices,
  payTypeLabels,
  personStatusChoices,
  personTypeLabels,
} from "./constants";

const filters = [
  <SearchInput key="q" source="q" alwaysOn />,
  <SelectInput key="status" source="status" choices={personStatusChoices} />,
  <SelectInput key="pay_type" source="pay_type" choices={payTypeChoices} />,
];

const NameField = () => {
  const record = useRecordContext<Person>();
  if (!record) return null;
  return <span>{getPersonDisplayName(record)}</span>;
};

const PayTypeField = () => {
  const record = useRecordContext<Person>();
  if (!record) return null;
  return <span>{payTypeLabels[record.pay_type]}</span>;
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

  if (!record) return null;

  const nextStatus = record.status === "active" ? "inactive" : "active";

  const handleToggleStatus = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    update(
      "people",
      {
        id: record.id,
        data: { status: nextStatus },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify(
            nextStatus === "active"
              ? "Employee activated"
              : "Employee deactivated",
          );
          refresh();
        },
        onError: () => {
          notify("Could not update employee status", { type: "error" });
        },
      },
    );
  };

  return (
    <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
      <Button asChild size="sm" variant="outline">
        <Link to={createPath({ resource: "people", id: record.id, type: "edit" })}>
          Edit
        </Link>
      </Button>
      <Button size="sm" variant="outline" onClick={handleToggleStatus} disabled={isPending}>
        {record.status === "active" ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
};

const PeopleListActions = () => (
  <TopToolbar>
    <ExportButton />
    <CreateButton label="New Employee" />
  </TopToolbar>
);

export const PeopleList = () => {
  const location = useLocation();

  const permanentFilter = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get("type");
    if (!type) return {};
    if (!Object.keys(personTypeLabels).includes(type)) return {};
    return { type };
  }, [location.search]);

  const title =
    permanentFilter && "type" in permanentFilter && permanentFilter.type
      ? personTypeLabels[permanentFilter.type as Person["type"]]
      : "Personal";

  return (
    <List
      title={title}
      actions={<PeopleListActions />}
      sort={{ field: "created_at", order: "DESC" }}
      filter={permanentFilter}
      filters={filters}
    >
      <DataTable rowClick={false}>
        <DataTable.Col label="Name">
          <NameField />
        </DataTable.Col>
        <DataTable.Col source="pay_type" label="Pay Type">
          <PayTypeField />
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
      </DataTable>
    </List>
  );
};
