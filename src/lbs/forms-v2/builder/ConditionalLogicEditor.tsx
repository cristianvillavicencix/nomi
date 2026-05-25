import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  evaluateCondition,
  isConditionGroup,
  normalizeVisibleWhen,
  type ConditionGroup,
  type ConditionOperator,
  type SingleCondition,
  type VisibleWhen,
} from "@/lib/forms-v2/conditionalLogic";

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "greater_than", label: "greater than" },
  { value: "less_than", label: "less than" },
  { value: "greater_or_equal", label: "greater or equal" },
  { value: "less_or_equal", label: "less or equal" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
  { value: "in", label: "is one of" },
  { value: "not_in", label: "is not one of" },
];

const VALUELESS_OPS = new Set<ConditionOperator>(["is_empty", "is_not_empty"]);

const emptyGroup = (): ConditionGroup => ({
  operator: "and",
  conditions: [{ field: "", op: "equals", value: "" }],
});

type ConditionalLogicEditorProps = {
  visibleWhen: VisibleWhen | undefined;
  priorFields: { key: string; label: string }[];
  previewAnswers?: Record<string, unknown>;
  onChange: (next: VisibleWhen | undefined) => void;
};

const describeCondition = (
  condition: SingleCondition,
  priorFields: { key: string; label: string }[],
) => {
  const fieldLabel =
    priorFields.find((field) => field.key === condition.field)?.label ??
    condition.field;
  const opLabel =
    OPERATORS.find((item) => item.value === condition.op)?.label ??
    condition.op;
  if (VALUELESS_OPS.has(condition.op)) {
    return `"${fieldLabel}" ${opLabel}`;
  }
  return `"${fieldLabel}" ${opLabel} "${String(condition.value ?? "")}"`;
};

export const ConditionalLogicEditor = ({
  visibleWhen,
  priorFields,
  previewAnswers = {},
  onChange,
}: ConditionalLogicEditorProps) => {
  const enabled = Boolean(visibleWhen);
  const group = normalizeVisibleWhen(visibleWhen) ?? emptyGroup();

  const updateGroup = (next: ConditionGroup) => {
    if (next.conditions.length === 0) {
      onChange(undefined);
      return;
    }
    onChange(next);
  };

  const previewVisible = enabled
    ? evaluateCondition(group, previewAnswers)
    : true;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="conditional-enabled">Conditional logic</Label>
        <Switch
          id="conditional-enabled"
          checked={enabled}
          onCheckedChange={(checked) => {
            if (!checked) {
              onChange(undefined);
              return;
            }
            onChange(
              isConditionGroup(visibleWhen)
                ? visibleWhen
                : emptyGroup(),
            );
          }}
        />
      </div>

      {enabled ? (
        <>
          <p className="text-xs text-muted-foreground">
            Show only when the rules below match earlier answers.
          </p>

          <div className="space-y-2">
            <Label>Match</Label>
            <Select
              value={group.operator}
              onValueChange={(next: "and" | "or") =>
                updateGroup({ ...group, operator: next })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="and">All conditions (AND)</SelectItem>
                <SelectItem value="or">Any condition (OR)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {group.conditions.map((condition, index) => (
              <div
                key={`${condition.field}-${index}`}
                className="space-y-2 rounded-md border bg-muted/20 p-3"
              >
                <div className="grid gap-2 sm:grid-cols-3">
                  <Select
                    value={condition.field || undefined}
                    onValueChange={(field) => {
                      const conditions = [...group.conditions];
                      conditions[index] = { ...condition, field };
                      updateGroup({ ...group, conditions });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {priorFields.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.op}
                    onValueChange={(op: ConditionOperator) => {
                      const conditions = [...group.conditions];
                      conditions[index] = { ...condition, op };
                      updateGroup({ ...group, conditions });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((operator) => (
                        <SelectItem key={operator.value} value={operator.value}>
                          {operator.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!VALUELESS_OPS.has(condition.op) ? (
                    <Input
                      value={String(condition.value ?? "")}
                      placeholder="Value"
                      onChange={(event) => {
                        const conditions = [...group.conditions];
                        conditions[index] = {
                          ...condition,
                          value: event.target.value,
                        };
                        updateGroup({ ...group, conditions });
                      }}
                    />
                  ) : (
                    <div className="flex items-center text-xs text-muted-foreground">
                      No value needed
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={group.conditions.length <= 1}
                    onClick={() => {
                      const conditions = group.conditions.filter(
                        (_, itemIndex) => itemIndex !== index,
                      );
                      updateGroup({ ...group, conditions });
                    }}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={priorFields.length === 0}
            onClick={() =>
              updateGroup({
                ...group,
                conditions: [
                  ...group.conditions,
                  {
                    field: priorFields[0]?.key ?? "",
                    op: "equals",
                    value: "",
                  },
                ],
              })
            }
          >
            <Plus className="size-4" />
            Add condition
          </Button>

          {priorFields.length === 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Add at least one field above this one to build conditions.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Preview: this field will{" "}
              {previewVisible ? "show" : "hide"} when{" "}
              {group.conditions
                .filter((condition) => condition.field)
                .map((condition) => describeCondition(condition, priorFields))
                .join(group.operator === "or" ? " OR " : " AND ") ||
                "conditions are configured"}
              .
            </p>
          )}
        </>
      ) : null}
    </div>
  );
};
