/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { Command as CommandPrimitive } from "cmdk";
import type { ChoicesProps, InputProps } from "ra-core";
import {
  useChoices,
  useChoicesContext,
  useGetRecordRepresentation,
  useInput,
  useTranslate,
  FieldTitle,
  useEvent,
} from "ra-core";
import { InputHelperText } from "./input-helper-text";
import { useCallback, useState } from "react";
import {
  FloatingFieldShell,
  floatingFieldPlaceholder,
} from "@/components/ui/floating-field";
import { cn } from "@/lib/utils";

/**
 * Form control that lets users choose multiple values from a list using a dropdown with autocompletion.
 *
 * This input allows editing array values with a searchable dropdown interface and displays selected items as removable badges.
 * Works seamlessly inside ReferenceArrayInput for editing many-to-many relationships.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/autocompletearrayinput/ AutocompleteArrayInput documentation}
 *
 * @example
 * import {
 *   Create,
 *   SimpleForm,
 *   AutocompleteArrayInput,
 *   ReferenceArrayInput,
 * } from '@/components/admin';
 *
 * const PostCreate = () => (
 *   <Create>
 *     <SimpleForm>
 *       <AutocompleteArrayInput
 *         source="tags"
 *         choices={[
 *           { id: 'tech', name: 'Tech' },
 *           { id: 'news', name: 'News' },
 *           { id: 'lifestyle', name: 'Lifestyle' },
 *         ]}
 *       />
 *       <ReferenceArrayInput source="tag_ids" reference="tags">
 *         <AutocompleteArrayInput />
 *       </ReferenceArrayInput>
 *     </SimpleForm>
 *   </Create>
 * );
 */
export const AutocompleteArrayInput = (
  props: Omit<InputProps, "source"> &
    Partial<Pick<InputProps, "source">> &
    ChoicesProps & {
      className?: string;
      disableValue?: string;
      filterToQuery?: (searchText: string) => any;
      translateChoice?: boolean;
      placeholder?: string;
      labelVariant?: "default" | "floating";
      inputText?:
        | React.ReactNode
        | ((option: any | undefined) => React.ReactNode);
    },
) => {
  const {
    filterToQuery = DefaultFilterToQuery,
    inputText,
    labelVariant = "default",
  } = props;
  const {
    allChoices = [],
    source,
    resource,
    isFromReference,
    setFilters,
  } = useChoicesContext(props);
  const { id, field, isRequired } = useInput({ ...props, source });
  const translate = useTranslate();
  const { placeholder = translate("ra.action.search", { _: "Search..." }) } =
    props;

  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const { getChoiceText, getChoiceValue } = useChoices({
    optionText:
      props.optionText ?? (isFromReference ? getRecordRepresentation : "name"),
    optionValue: props.optionValue ?? "id",
    disableValue: props.disableValue,
    translateChoice: props.translateChoice ?? !isFromReference,
  });

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [focused, setFocused] = useState(false);

  const handleUnselect = useEvent((choice: any) => {
    field.onChange(
      field.value.filter((v: any) => v !== getChoiceValue(choice)),
    );
  });

  const handleKeyDown = useEvent((e: React.KeyboardEvent<HTMLDivElement>) => {
    const input = inputRef.current;
    if (input) {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (input.value === "") {
          field.onChange(field.value.slice(0, -1));
        }
      }
      // This is not a default behavior of the <input /> field
      if (e.key === "Escape") {
        input.blur();
      }
    }
  });

  const availableChoices = allChoices.filter(
    (choice) => !field.value.includes(getChoiceValue(choice)),
  );
  const selectedChoices = allChoices.filter((choice) =>
    field.value.includes(getChoiceValue(choice)),
  );
  const [filterValue, setFilterValue] = React.useState("");

  const getInputText = useCallback(
    (selectedChoice: any) => {
      if (typeof inputText === "function") {
        return inputText(selectedChoice);
      }
      if (inputText !== undefined) {
        return inputText;
      }
      return getChoiceText(selectedChoice);
    },
    [inputText, getChoiceText],
  );

  const useFloating = labelVariant === "floating" && props.label !== false;
  const floatingActive =
    focused || open || selectedChoices.length > 0 || Boolean(filterValue.trim());
  const resolvedPlaceholder = useFloating
    ? floatingFieldPlaceholder(floatingActive, placeholder)
    : placeholder;

  const labelNode =
    props.label !== false ? (
      <FieldTitle
        label={props.label}
        source={props.source ?? source}
        resource={resource}
        isRequired={useFloating ? false : isRequired}
      />
    ) : null;

  const control = (
    <Command
      onKeyDown={handleKeyDown}
      shouldFilter={!isFromReference}
      className="overflow-visible bg-transparent"
    >
      <div
        className={cn(
          "group text-sm transition-all",
          useFloating
            ? "w-full border-0 bg-transparent px-3 py-1.5 shadow-none"
            : "rounded-md border border-input bg-transparent px-3 py-1.75 ring-offset-background focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] dark:bg-input/30",
        )}
      >
        <div className="flex flex-wrap gap-1">
          {selectedChoices.map((choice) => (
            <Badge
              key={getChoiceValue(choice)}
              variant="secondary"
              className="bg-muted text-foreground"
            >
              {getInputText(choice)}
              <button
                type="button"
                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUnselect(choice);
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  handleUnselect(choice);
                }}
              >
                <span className="sr-only">
                  {translate("ra.action.remove", {
                    _: "Remove",
                  })}
                </span>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <CommandPrimitive.Input
            ref={inputRef}
            value={filterValue}
            onValueChange={(filter) => {
              setFilterValue(filter);
              if (isFromReference) {
                setFilters(filterToQuery(filter), undefined, true);
              }
            }}
            onBlur={() => {
              setOpen(false);
              setFocused(false);
            }}
            onFocus={() => {
              setOpen(true);
              setFocused(true);
            }}
            placeholder={resolvedPlaceholder}
            className="ml-0.5 min-w-[6rem] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className={cn("relative", open && "z-50")}>
        <CommandList>
          {open && availableChoices.length > 0 ? (
            <div className="absolute top-2 z-50 w-full rounded-md border border-input bg-background text-foreground shadow-lg outline-none animate-in">
              <CommandGroup className="h-full overflow-auto bg-background">
                {availableChoices.map((choice) => {
                  return (
                    <CommandItem
                      key={getChoiceValue(choice)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onSelect={() => {
                        setFilterValue("");
                        if (isFromReference) {
                          setFilters(filterToQuery(""));
                        }
                        field.onChange([
                          ...field.value,
                          getChoiceValue(choice),
                        ]);
                      }}
                      className="cursor-pointer bg-background data-[selected=true]:bg-accent"
                    >
                      {getChoiceText(choice)}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          ) : null}
        </CommandList>
      </div>
    </Command>
  );

  return (
    <FormField
      className={cn(useFloating && "gap-1.5", props.className)}
      id={id}
      name={field.name}
    >
      {useFloating ? (
        <FloatingFieldShell
          active={floatingActive}
          label={labelNode}
          htmlFor={id}
          required={isRequired}
          labelAlign="top"
          className="min-h-9 items-start py-1"
        >
          <FormControl>{control}</FormControl>
        </FloatingFieldShell>
      ) : (
        <>
          {labelNode ? <FormLabel>{labelNode}</FormLabel> : null}
          <FormControl>{control}</FormControl>
        </>
      )}
      <InputHelperText helperText={props.helperText} />
      <FormError />
    </FormField>
  );
};

const DefaultFilterToQuery = (searchText: string) => ({ q: searchText });
