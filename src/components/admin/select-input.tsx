import { X } from "lucide-react";
import type {
  ChoicesProps,
  InputProps,
  SupportCreateSuggestionOptions,
} from "ra-core";
import {
  FieldTitle,
  useChoices,
  useChoicesContext,
  useGetRecordRepresentation,
  useInput,
  useSupportCreateSuggestion,
  useTranslate,
} from "ra-core";
import type { ComponentProps, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import { FormError, FormField, FormLabel } from "@/components/admin/form";
import { InputHelperText } from "@/components/admin/input-helper-text";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FloatingFieldShell } from "@/components/ui/floating-field";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Dropdown select input for choosing a single value from a list of options.
 *
 * Use `<SelectInput>` for fields with many possible values (5+) like categories, statuses, or
 * countries. Supports creating new options on the fly with the `create` or `onCreate` props.
 * Wrap in `<ReferenceInput>` to select from related resources.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/selectinput/ SelectInput documentation}
 * @see {@link https://ui.shadcn.com/docs/components/select Select documentation}
 *
 * @example
 * import { Edit, SimpleForm, TextInput, SelectInput } from '@/components/admin';
 *
 * const PostEdit = () => (
 *   <Edit>
 *     <SimpleForm>
 *       <TextInput source="title" />
 *       <SelectInput
 *         source="category"
 *         choices={[
 *           { id: 'tech', name: 'Tech' },
 *           { id: 'lifestyle', name: 'Lifestyle' },
 *           { id: 'people', name: 'People' },
 *         ]}
 *       />
 *     </SimpleForm>
 *   </Edit>
 * );
 */
export const SelectInput = (props: SelectInputProps) => {
  const {
    choices: choicesProp,
    isLoading: isLoadingProp,
    isFetching: isFetchingProp,
    isPending: isPendingProp,
    resource: resourceProp,
    source: sourceProp,

    optionText,
    optionValue,
    disableValue = "disabled",
    translateChoice,
    createValue,
    createHintValue,

    alwaysOn,
    defaultValue,
    format,
    label,
    helperText,
    name,
    onBlur,
    onChange,
    parse,
    validate,
    readOnly,
    disabled,

    className,
    emptyText = "",
    emptyValue = "",
    filter: _filter,
    create,
    createLabel,
    onCreate,
    labelVariant = "default",

    ...rest
  } = props;
  const translate = useTranslate();
  const [selectOpen, setSelectOpen] = useState(false);

  useEffect(() => {
    if (emptyValue == null) {
      throw new Error(
        `emptyValue being set to null or undefined is not supported. Use parse to turn the empty string into null.`,
      );
    }
  }, [emptyValue]);

  const {
    allChoices,
    isPending,
    error: fetchError,
    source,
    resource,
    isFromReference,
  } = useChoicesContext({
    choices: choicesProp,
    isLoading: isLoadingProp,
    isFetching: isFetchingProp,
    isPending: isPendingProp,
    resource: resourceProp,
    source: sourceProp,
  });

  if (source === undefined) {
    throw new Error(
      `If you're not wrapping the SelectInput inside a ReferenceInput, you must provide the source prop`,
    );
  }

  if (!isPending && !fetchError && allChoices === undefined) {
    throw new Error(
      `If you're not wrapping the SelectInput inside a ReferenceInput, you must provide the choices prop`,
    );
  }

  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const { getChoiceText, getChoiceValue, getDisableValue } = useChoices({
    optionText:
      optionText ?? (isFromReference ? getRecordRepresentation : undefined),
    optionValue,
    disableValue,
    translateChoice: translateChoice ?? !isFromReference,
    createValue,
    createHintValue,
  });
  const { id, field, isRequired } = useInput({
    alwaysOn,
    defaultValue,
    format,
    label,
    helperText,
    name,
    onBlur,
    onChange,
    parse,
    resource,
    source,
    validate,
    readOnly,
    disabled,
  });

  const renderEmptyItemOption = useCallback(() => {
    return typeof emptyText === "string"
      ? emptyText === ""
        ? " " // em space, forces the display of an empty line of normal height
        : translate(emptyText, { _: emptyText })
      : emptyText;
  }, [emptyText, translate]);

  const renderMenuItemOption = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (choice: any) => getChoiceText(choice),
    [getChoiceText],
  );

  const handleChange = useCallback(
    async (value: string) => {
      if (value === emptyValue) {
        field.onChange(emptyValue);
      } else {
        // Find the choice by value and pass it to field.onChange
        const choice = allChoices?.find(
          (choice) => getChoiceValue(choice) === value,
        );
        field.onChange(choice ? getChoiceValue(choice) : value);
      }
    },
    [field, getChoiceValue, emptyValue, allChoices],
  );

  const {
    getCreateItem,
    handleChange: handleChangeWithCreateSupport,
    createElement,
  } = useSupportCreateSuggestion({
    create,
    createLabel,
    createValue,
    createHintValue,
    onCreate,
    handleChange,
    optionText,
  });

  if (isPending) {
    return (
      <FormField
        id={id}
        name={field.name}
        className={cn("w-full min-w-20", className)}
      >
        {label !== "" && label !== false && (
          <FormLabel>
            <FieldTitle
              label={label}
              source={source}
              resource={resourceProp}
              isRequired={isRequired}
            />
          </FormLabel>
        )}
        <div className="relative">
          <Skeleton className="w-full h-9" />
        </div>
        <InputHelperText helperText={helperText} />
        <FormError />
      </FormField>
    );
  }

  const createItem = create || onCreate ? getCreateItem() : null;
  let finalChoices = fetchError ? [] : allChoices;
  if (create || onCreate) {
    finalChoices = [...finalChoices, createItem];
  }

  // Handle reset functionality
  const handleReset = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    field.onChange(emptyValue);
  };

  const hasSelectValue =
    field.value != null &&
    field.value !== "" &&
    field.value !== emptyValue;
  const floatingActive = selectOpen || hasSelectValue;
  const useFloating =
    labelVariant === "floating" && label !== "" && label !== false;

  const labelTitle =
    label !== "" && label !== false ? (
      <FieldTitle
        label={label}
        source={source}
        resource={resourceProp}
        isRequired={useFloating ? false : isRequired}
      />
    ) : null;

  const selectControl = (
    <div className="relative">
      <Select
        //FIXME https://github.com/radix-ui/primitives/issues/3135
        key={`select:${field.value?.toString() ?? emptyValue}`}
        value={field.value?.toString() || emptyValue}
        onValueChange={handleChangeWithCreateSupport}
        open={selectOpen}
        onOpenChange={setSelectOpen}
      >
        <SelectTrigger
          className={cn(
            "w-full transition-all hover:bg-accent",
            useFloating &&
              "h-9 border-0 bg-transparent px-3 shadow-none hover:bg-transparent focus:ring-0 data-[size=default]:h-9",
          )}
          disabled={field.disabled}
        >
          <SelectValue
            placeholder={useFloating ? " " : renderEmptyItemOption()}
          />

          {hasSelectValue ? (
            <div
              role="button"
              className="pointer-events-auto ml-auto p-0 text-muted-foreground opacity-50 hover:bg-transparent hover:opacity-100"
              onClick={handleReset}
            >
              <X className="h-4 w-4" />
            </div>
          ) : null}
        </SelectTrigger>
        <SelectContent>
          {finalChoices?.map((choice) => {
            if (!choice) return null;
            const value = getChoiceValue(choice);
            const isDisabled = getDisableValue(choice);

            return (
              <SelectItem
                key={value}
                value={value?.toString()}
                disabled={isDisabled}
              >
                {renderMenuItemOption(
                  !!createItem && choice?.id === createItem.id
                    ? createItem
                    : choice,
                )}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <FormField
        id={id}
        name={field.name}
        className={cn("w-full min-w-20", useFloating && "gap-1.5", className)}
        {...rest}
      >
        {useFloating ? (
          <FloatingFieldShell
            active={floatingActive}
            label={labelTitle}
            htmlFor={id}
            required={isRequired}
          >
            {selectControl}
          </FloatingFieldShell>
        ) : (
          <>
            {labelTitle ? <FormLabel>{labelTitle}</FormLabel> : null}
            {selectControl}
          </>
        )}
        <InputHelperText helperText={helperText} />
        <FormError />
      </FormField>
      {createElement}
    </>
  );
};

export type SelectInputProps = ChoicesProps &
  // Source is optional as SelectInput can be used inside a ReferenceInput that already defines the source
  Partial<InputProps> &
  Omit<SupportCreateSuggestionOptions, "handleChange"> & {
    emptyText?: string | ReactElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emptyValue?: any;
    onChange?: (value: string) => void;
    labelVariant?: "default" | "floating";
  } & Omit<ComponentProps<typeof FormField>, "id" | "name" | "children">;
