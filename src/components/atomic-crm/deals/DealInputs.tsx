import {
  FieldTitle,
  required,
  useGetList,
  useGetOne,
  useInput,
  useResourceContext,
  type InputProps,
} from "ra-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";

import { AutocompleteCompanyInput } from "../companies/AutocompleteCompanyInput";
import { contactOptionText } from "../misc/ContactOption";
import type { Contact, Deal, Person } from "../types";

const GOOGLE_PLACES_API_KEY =
  import.meta.env.VITE_GOOGLE_PLACES_API_KEY ??
  "AIzaSyCOI-vWlZI24dGycSZLoPWEx5_6RTFKkAI";

const projectCategoryChoices = [
  { value: "retail", label: "Retail" },
  { value: "insurance", label: "Insurance" },
];

const projectTypeChoices = [
  { value: "roofing", label: "Roofing" },
  { value: "siding", label: "Siding" },
  { value: "gutters", label: "Gutters" },
  { value: "painting", label: "Painting" },
  { value: "mitigation", label: "Mitigation" },
  { value: "reconstruction", label: "Reconstruction" },
];

const projectStageChoices = [
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "material_ordered", label: "Material Ordered" },
  { value: "pending_inspection", label: "Pending Inspection" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

type GoogleAddressSuggestion = { placeId: string; text: string };

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getPersonOptionText = (person?: Partial<Person>) => {
  if (!person) return "";
  const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ");
  if (person.email) return `${fullName} (${person.email})`;
  return fullName;
};

const withCurrentCustomChoice = (
  choices: Array<{ value: string; label: string }>,
  current?: string,
) => {
  if (!current) return choices;
  const exists = choices.some((choice) => choice.value === current);
  if (exists) return choices;
  return [
    ...choices,
    {
      value: current,
      label: `${current} (Custom)`,
    },
  ];
};

const positiveCurrency = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "Estimated project value must be greater than 0";
  }
  return undefined;
};


const AddressAutocompleteInput = ({
  source,
  label,
  helperText,
  validate,
  existingAddressOptions,
  onPickAddress,
  onManualChange,
  placeholder,
}: InputProps & {
  existingAddressOptions: string[];
  onPickAddress: (payload: { text: string; placeId: string | null }) => void;
  onManualChange: () => void;
  placeholder?: string;
}) => {
  const resource = useResourceContext({ source });
  const { id, field, isRequired } = useInput({
    source,
    label,
    helperText,
    validate,
  });
  const [open, setOpen] = useState(false);
  const [googleSuggestions, setGoogleSuggestions] = useState<GoogleAddressSuggestion[]>([]);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const query = String(field.value ?? "").trim();

  const filteredExistingOptions = useMemo(() => {
    const loweredQuery = query.toLowerCase();
    const uniqueAddresses = Array.from(new Set(existingAddressOptions.filter(Boolean)));
    if (!loweredQuery) return uniqueAddresses.slice(0, 8);
    return uniqueAddresses
      .filter((address) => address.toLowerCase().includes(loweredQuery))
      .slice(0, 8);
  }, [existingAddressOptions, query]);

  useEffect(() => {
    if (!open || query.length < 3 || !GOOGLE_PLACES_API_KEY) {
      setGoogleSuggestions([]);
      setIsLoadingGoogle(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoadingGoogle(true);
      try {
        const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask":
              "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
          },
          body: JSON.stringify({
            input: query,
            languageCode: "en",
            regionCode: "US",
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          setGoogleSuggestions([]);
          return;
        }
        const payload = (await response.json()) as {
          suggestions?: Array<{
            placePrediction?: { placeId?: string; text?: { text?: string } };
          }>;
        };
        const nextSuggestions =
          payload.suggestions
            ?.map((item) => ({
              placeId: String(item.placePrediction?.placeId ?? ""),
              text: String(item.placePrediction?.text?.text ?? ""),
            }))
            .filter((item) => item.placeId && item.text) ?? [];
        setGoogleSuggestions(nextSuggestions.slice(0, 6));
      } catch {
        setGoogleSuggestions([]);
      } finally {
        setIsLoadingGoogle(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  return (
    <FormField id={id} name={field.name}>
      {label !== false ? (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      ) : null}
      <FormControl>
        <div className="relative">
          <Input
            {...field}
            value={field.value ?? ""}
            placeholder={placeholder ?? "Search project address"}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onBlur={() => {
              setTimeout(() => setOpen(false), 150);
            }}
            onChange={(event) => {
              field.onChange(event.target.value);
              onManualChange();
            }}
          />
          {open ? (
            <div className="absolute top-[calc(100%+6px)] z-40 max-h-72 w-full overflow-y-auto rounded-md border bg-background p-2 shadow-md">
              <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                PROJECTOS EXISTENTES
              </div>
              {filteredExistingOptions.length > 0 ? (
                filteredExistingOptions.map((address) => (
                  <button
                    key={`existing-${address}`}
                    type="button"
                    className="mb-1 block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      field.onChange(address);
                      onPickAddress({ text: address, placeId: null });
                      setOpen(false);
                    }}
                  >
                    {address}
                  </button>
                ))
              ) : (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  No matching project addresses.
                </div>
              )}

              <div className="my-2 border-t" />
              <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                SUGERENCIA DE DIRECCIONES DE GOOGLE
              </div>
              {isLoadingGoogle ? (
                <div className="px-2 py-1 text-xs text-muted-foreground">Loading suggestions...</div>
              ) : googleSuggestions.length > 0 ? (
                googleSuggestions.map((item) => (
                  <button
                    key={`google-${item.placeId}`}
                    type="button"
                    className="mb-1 block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      field.onChange(item.text);
                      onPickAddress({ text: item.text, placeId: item.placeId });
                      setOpen(false);
                    }}
                  >
                    {item.text}
                  </button>
                ))
              ) : (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  Type at least 3 characters to search.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};

export const DealInputs = () => {
  const isMobile = useIsMobile();
  const { control, setValue } = useFormContext<Deal & Record<string, unknown>>();
  const contactId = useWatch({ control, name: "contact_id" });
  const contactIds = useWatch({ control, name: "contact_ids" });
  const stage = useWatch({ control, name: "stage" });
  const projectType = useWatch({ control, name: "project_type" });
  const category = useWatch({ control, name: "category" });
  const estimatedValue = useWatch({ control, name: "estimated_value" });
  const amount = useWatch({ control, name: "amount" });
  const notes = useWatch({ control, name: "notes" });
  const description = useWatch({ control, name: "description" });

  const selectedContactId = toNumber(contactId);
  const previousContactId = useRef<number | null>(null);
  const { data: selectedContact } = useGetOne<Contact>(
    "contacts_summary",
    { id: selectedContactId as number },
    { enabled: selectedContactId != null },
  );
  const { data: projects = [] } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 400 },
      sort: { field: "updated_at", order: "DESC" },
      filter: { "archived_at@is": null },
    },
    { staleTime: 30_000 },
  );

  const projectAddressOptions = useMemo(
    () =>
      projects
        .map((project) => String(project.project_address ?? "").trim())
        .filter(Boolean),
    [projects],
  );

  const stageChoices = useMemo(
    () => withCurrentCustomChoice(projectStageChoices, String(stage ?? "")),
    [stage],
  );
  const typeChoices = useMemo(
    () => withCurrentCustomChoice(projectTypeChoices, String(projectType ?? "")),
    [projectType],
  );
  const projectTypeAutocompleteChoices = useMemo(
    () =>
      typeChoices.map((c) => ({
        id: c.value,
        name: c.label,
      })),
    [typeChoices],
  );

  useEffect(() => {
    if (!category) {
      setValue("category", projectCategoryChoices[0].value, {
        shouldDirty: false,
      });
    }
    if (!projectType) {
      setValue("project_type", projectTypeChoices[0].value, {
        shouldDirty: false,
      });
    }
    if (!stage) {
      setValue("stage", projectStageChoices[0].value, {
        shouldDirty: false,
      });
    }
    setValue("pipeline_id", "default", { shouldDirty: false });
  }, [category, projectType, setValue, stage]);

  useEffect(() => {
    const normalizedContactIds = Array.isArray(contactIds)
      ? contactIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];
    if (!selectedContactId && normalizedContactIds.length > 0) {
      setValue("contact_id", normalizedContactIds[0], { shouldDirty: false });
    }
  }, [contactIds, selectedContactId, setValue]);

  useEffect(() => {
    if (selectedContactId == null) {
      setValue("contact_ids", [], { shouldDirty: true });
      previousContactId.current = null;
      return;
    }
    setValue("contact_ids", [selectedContactId], { shouldDirty: true });
  }, [selectedContactId, setValue]);

  useEffect(() => {
    if (!selectedContact || selectedContactId == null) return;
    if (previousContactId.current === selectedContactId) return;

    if (selectedContact.company_id) {
      setValue("company_id", Number(selectedContact.company_id), {
        shouldDirty: true,
      });
      setValue("company_name", selectedContact.company_name ?? "", {
        shouldDirty: false,
      });
    } else {
      setValue("company_id", null, { shouldDirty: true });
      if (selectedContact.company_name) {
        setValue("company_name", selectedContact.company_name, { shouldDirty: true });
      }
    }

    if (selectedContact.address) {
      setValue("project_address", selectedContact.address, { shouldDirty: true });
      setValue("project_place_id", null, { shouldDirty: true });
      setValue("project_address_meta", null, { shouldDirty: true });
    }

    previousContactId.current = selectedContactId;
  }, [selectedContact, selectedContactId, setValue]);

  useEffect(() => {
    const estimatedAsNumber = toNumber(estimatedValue);
    const amountAsNumber = toNumber(amount);

    if (estimatedAsNumber == null && amountAsNumber != null) {
      setValue("estimated_value", amountAsNumber, { shouldDirty: false });
      return;
    }

    if (
      estimatedAsNumber != null &&
      (amountAsNumber == null || amountAsNumber !== estimatedAsNumber)
    ) {
      setValue("amount", estimatedAsNumber, { shouldDirty: false });
    }
  }, [amount, estimatedValue, setValue]);

  useEffect(() => {
    if (!notes && description) {
      setValue("notes", description, { shouldDirty: false });
      return;
    }
    if (notes !== description) {
      setValue("description", String(notes ?? ""), { shouldDirty: false });
    }
  }, [description, notes, setValue]);

  return (
    <div className="flex flex-col gap-7">
      <section className="space-y-4 rounded-lg border p-4">
        <h3 className="text-base font-semibold">Basic project info</h3>
        <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <TextInput
            source="name"
            label="Project name"
            validate={required()}
            helperText={false}
            placeholder="Enter project name"
          />
          <ReferenceInput source="contact_id" reference="contacts_summary">
            <AutocompleteInput
              label="Contact"
              optionText={contactOptionText}
              validate={required()}
              helperText={false}
              placeholder="Search contact"
              filterToQuery={(searchText) => ({ q: searchText })}
            />
          </ReferenceInput>
          <ReferenceInput source="company_id" reference="companies">
            <AutocompleteCompanyInput validate={undefined} />
          </ReferenceInput>
          <AddressAutocompleteInput
            source="project_address"
            label="Project address"
            validate={required()}
            helperText={false}
            placeholder="Search project address"
            existingAddressOptions={projectAddressOptions}
            onManualChange={() => {
              setValue("project_place_id", null, { shouldDirty: true });
              setValue("project_address_meta", null, { shouldDirty: true });
            }}
            onPickAddress={({ text, placeId }) => {
              setValue("project_address", text, { shouldDirty: true });
              setValue("project_place_id", placeId, { shouldDirty: true });
              setValue(
                "project_address_meta",
                placeId
                  ? {
                      source: "google_places",
                      place_id: placeId,
                      formatted_address: text,
                    }
                  : {
                      source: "project_history",
                      formatted_address: text,
                    },
                { shouldDirty: true },
              );
            }}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <h3 className="text-base font-semibold">Project details</h3>
        <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <SelectInput
            source="category"
            label="Project category"
            choices={projectCategoryChoices}
            optionText="label"
            optionValue="value"
            helperText={false}
            validate={required()}
          />
          <AutocompleteInput
            source="project_type"
            label="Project type"
            choices={projectTypeAutocompleteChoices}
            optionText="name"
            optionValue="id"
            translateChoice={false}
            validate={required()}
            create
            placeholder="Search or add a type"
            helperText="Pick a common type or type a new name, then use Create in the list."
          />
          <NumberInput
            source="estimated_value"
            label="Estimated project value (USD)"
            helperText={false}
            validate={[required(), positiveCurrency]}
            min={0}
            step={0.01}
          />
          <NumberInput
            source="original_project_value"
            label="Original project value (USD)"
            helperText={false}
            min={0}
            step={0.01}
          />
          <NumberInput
            source="current_project_value"
            label="Current project value (USD)"
            helperText={false}
            min={0}
            step={0.01}
          />
          <SelectInput
            source="stage"
            label="Project stage"
            choices={stageChoices}
            optionText="label"
            optionValue="value"
            helperText={false}
            validate={required()}
          />
          <SelectInput
            source="value_includes_material"
            label="Value includes material?"
            choices={[
              { value: true, label: "Yes" },
              { value: false, label: "No" },
            ]}
            optionText="label"
            optionValue="value"
            helperText={false}
          />
          <TextInput
            source="start_date"
            type="date"
            label="Start date"
            helperText={false}
          />
          <TextInput
            source="expected_end_date"
            type="date"
            label="Expected end date"
            helperText={false}
          />
          <TextInput
            source="actual_completion_date"
            type="date"
            label="Actual completion date"
            helperText={false}
          />
          <TextInput
            source="estimated_completion_time"
            label="Estimated completion / delivery time"
            helperText={false}
            placeholder="e.g. 6 weeks"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <h3 className="text-base font-semibold">Assignment</h3>
        <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <ReferenceArrayInput
            source="salesperson_ids"
            reference="people"
            filter={{ "type@eq": "salesperson" }}
          >
            <AutocompleteArrayInput
              label="Salespersons"
              optionText={getPersonOptionText}
              helperText={false}
              placeholder="Select salespersons"
              filterToQuery={(searchText) => ({ q: searchText })}
            />
          </ReferenceArrayInput>
          <ReferenceArrayInput
            source="subcontractor_ids"
            reference="people"
            filter={{ "type@eq": "subcontractor" }}
          >
            <AutocompleteArrayInput
              label="Subcontractors"
              optionText={getPersonOptionText}
              helperText={false}
              placeholder="Select subcontractors"
              filterToQuery={(searchText) => ({ q: searchText })}
            />
          </ReferenceArrayInput>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <h3 className="text-base font-semibold">Notes</h3>
        <TextInput
          source="notes"
          label="General notes"
          multiline
          rows={4}
          helperText={false}
          placeholder="Add project context, scope, or internal notes"
        />
      </section>
    </div>
  );
};
