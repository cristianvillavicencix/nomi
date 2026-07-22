/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { useCallback, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
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
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import type {
  ChoicesProps,
  InputProps,
  SupportCreateSuggestionOptions,
} from "ra-core";
import {
  useChoices,
  useChoicesContext,
  useGetRecordRepresentation,
  useInput,
  useTranslate,
  FieldTitle,
  useEvent,
  useSupportCreateSuggestion,
} from "ra-core";
import { InputHelperText } from "./input-helper-text";
import { PopoverProps } from "@radix-ui/react-popover";
import {
  entitySearchPopoverClassName,
  getReferenceOptionShortLabel,
  renderReferenceOptionContent,
} from "@/modules/shared/referenceAutocompleteOptions";

/**
 * Form control that lets users choose a value from a list using a dropdown with autocompletion.
 *
 * This input allows editing scalar values with a searchable dropdown interface. It supports creating
 * new choices on the fly and works seamlessly inside ReferenceInput for editing foreign key relationships.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/autocompleteinput/ AutocompleteInput documentation}
 *
 * @example
 * import {
 *   Create,
 *   SimpleForm,
 *   AutocompleteInput,
 *   ReferenceInput,
 * } from '@/components/admin';
 *
 * const PostCreate = () => (
 *   <Create>
 *     <SimpleForm>
 *       <AutocompleteInput
 *         source="category"
 *         choices={[
 *           { id: 'tech', name: 'Tech' },
 *           { id: 'lifestyle', name: 'Lifestyle' },
 *           { id: 'people', name: 'People' },
 *         ]}
 *       />
 *       <ReferenceInput label="Author" source="author_id" reference="authors">
 *         <AutocompleteInput />
 *       </ReferenceInput>
 *     </SimpleForm>
 *   </Create>
 * );
 */
export const AutocompleteInput = (
  props: Omit<InputProps, "source"> &
    Omit<SupportCreateSuggestionOptions, "handleChange" | "filter"> &
    Partial<Pick<InputProps, "source">> &
    ChoicesProps & {
      className?: string;
      disableValue?: string;
      filterToQuery?: (searchText: string) => any;
      translateChoice?: boolean;
      placeholder?: string;
      inputText?:
        | React.ReactNode
        | ((option: any | undefined) => React.ReactNode);
      optionContent?:
        | React.ReactNode
        | ((option: any | undefined) => React.ReactNode);
      popoverContentClassName?: string;
    } & Pick<PopoverProps, "modal">,
) => {
  const {
    filterToQuery = DefaultFilterToQuery,
    inputText,
    create,
    createValue,
    createLabel,
    createHintValue,
    createItemLabel,
    onCreate,
    optionText,
    optionContent,
    popoverContentClassName,
    modal,
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

  const [filterValue, setFilterValue] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const suppressCloseRef = React.useRef(false);
  const selectedChoice = allChoices.find(
    (choice) => getChoiceValue(choice) === field.value,
  );

  const getInputText = useCallback(
    (selectedChoice: any) => {
      if (typeof inputText === "function") {
        return inputText(selectedChoice);
      }
      if (inputText !== undefined) {
        return inputText;
      }
      const shortLabel = getReferenceOptionShortLabel(resource, selectedChoice);
      if (shortLabel) return shortLabel;
      return getChoiceText(selectedChoice);
    },
    [inputText, getChoiceText, resource],
  );

  const getOptionContent = useCallback(
    (choice: any, isCreateItem: boolean) => {
      if (isCreateItem) return getChoiceText(choice);
      if (optionContent) {
        return typeof optionContent === "function"
          ? optionContent(choice)
          : optionContent;
      }
      const richContent = renderReferenceOptionContent(resource, choice);
      if (richContent) return richContent;
      return getChoiceText(choice);
    },
    [getChoiceText, optionContent, resource],
  );

  const toInputString = (value: React.ReactNode) => {
    if (value == null || value === false) return "";
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    return "";
  };

  const selectedLabel = selectedChoice ? getInputText(selectedChoice) : null;
  const inputDisplayValue = open ? filterValue : toInputString(selectedLabel);

  const applySearchFilter = useCallback(
    (value: string) => {
      setFilterValue(value);
      if (isFromReference) {
        setFilters(filterToQuery(value));
      }
    },
    [filterToQuery, isFromReference, setFilters],
  );

  const scheduleSuppressClose = useCallback(() => {
    suppressCloseRef.current = true;
    window.requestAnimationFrame(() => {
      suppressCloseRef.current = false;
    });
  }, []);

  const handleOpenChange = useEvent((isOpen: boolean) => {
    if (!isOpen && suppressCloseRef.current) {
      return;
    }
    setOpen(isOpen);
    if (!isOpen) {
      setFilterValue("");
      if (isFromReference) {
        setFilters(filterToQuery(""));
      }
    }
  });

  const handleInputFocus = useCallback(() => {
    setOpen(true);
    if (selectedChoice) {
      setFilterValue("");
      if (isFromReference) {
        setFilters(filterToQuery(""));
      }
    }
  }, [filterToQuery, isFromReference, selectedChoice, setFilters]);

  const handleInputPointerDown = useCallback(() => {
    scheduleSuppressClose();
    setOpen(true);
  }, [scheduleSuppressClose]);

  const handlePopoverInteractOutside = useCallback((event: Event) => {
    const target = event.target;
    if (anchorRef.current?.contains(target as Node)) {
      event.preventDefault();
    }
  }, []);

  const stopScrollPropagation = useCallback(
    (event: React.WheelEvent | React.TouchEvent) => {
      event.stopPropagation();
    },
    [],
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      applySearchFilter(value);
      if (!open) setOpen(true);
    },
    [applySearchFilter, open],
  );

  const handleChange = useCallback(
    (choice: any) => {
      if (field.value === getChoiceValue(choice) && !isRequired) {
        field.onChange("");
        setFilterValue("");
        if (isFromReference) {
          setFilters(filterToQuery(""));
        }
        setOpen(false);
        return;
      }
      field.onChange(getChoiceValue(choice));
      setFilterValue("");
      if (isFromReference) {
        setFilters(filterToQuery(""));
      }
      setOpen(false);
    },
    [
      field,
      getChoiceValue,
      isRequired,
      setFilterValue,
      isFromReference,
      setFilters,
      filterToQuery,
      setOpen,
    ],
  );

  const {
    getCreateItem,
    handleChange: handleChangeWithCreateSupport,
    createElement,
    getOptionDisabled,
  } = useSupportCreateSuggestion({
    create,
    createLabel,
    createValue,
    createHintValue,
    createItemLabel,
    onCreate,
    handleChange,
    optionText,
    filter: filterValue,
  });

  const createItem =
    (create || onCreate) && (filterValue !== "" || createLabel)
      ? getCreateItem(filterValue)
      : null;
  let finalChoices = allChoices;
  if (createItem) {
    finalChoices = [...finalChoices, createItem];
  }

  const visibleChoices = useMemo(() => {
    if (isFromReference || !filterValue.trim()) return finalChoices;
    const query = filterValue.trim().toLowerCase();
    return finalChoices.filter((choice) =>
      String(getChoiceText(choice)).toLowerCase().includes(query),
    );
  }, [filterValue, finalChoices, getChoiceText, isFromReference]);

  React.useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: 0 });
  }, [open, visibleChoices.length]);

  return (
    <>
      <FormField className={props.className} id={id} name={source}>
        {props.label !== false && (
          <FormLabel>
            <FieldTitle
              label={props.label}
              source={props.source ?? source}
              resource={resource}
              isRequired={isRequired}
            />
          </FormLabel>
        )}
        <FormControl>
          <div className="relative w-full">
            <Popover
              open={open}
              onOpenChange={handleOpenChange}
              modal={modal ?? false}
            >
              <PopoverAnchor asChild>
                <div ref={anchorRef} className="relative w-full">
                  <Input
                    value={inputDisplayValue}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onPointerDown={handleInputPointerDown}
                    placeholder={
                      !open && selectedLabel ? undefined : placeholder
                    }
                    aria-expanded={open}
                    aria-autocomplete="list"
                    role="combobox"
                    className="pr-9"
                  />
                  <ChevronsUpDown
                    className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 shrink-0 opacity-50"
                    aria-hidden
                  />
                </div>
              </PopoverAnchor>
              <PopoverContent
                className={cn(
                  entitySearchPopoverClassName,
                  popoverContentClassName,
                )}
                align="start"
                side="bottom"
                sideOffset={4}
                collisionPadding={12}
                onOpenAutoFocus={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => event.preventDefault()}
                onInteractOutside={handlePopoverInteractOutside}
                onPointerDownOutside={handlePopoverInteractOutside}
                onWheel={stopScrollPropagation}
                onTouchMove={stopScrollPropagation}
              >
                <Command shouldFilter={false}>
                  <CommandList
                    ref={listRef}
                    className="max-h-[min(18rem,50vh)] scroll-py-0"
                  >
                    {visibleChoices.length === 0 ? (
                      <CommandEmpty>No matching item found.</CommandEmpty>
                    ) : null}
                    <CommandGroup>
                      {visibleChoices.map((choice) => {
                        const isCreateItem =
                          !!createItem && choice?.id === createItem.id;
                        const disabled = getOptionDisabled(choice);
                        const choiceValue = String(getChoiceValue(choice));

                        return (
                          <CommandItem
                            key={choiceValue}
                            value={
                              isCreateItem ? `?${filterValue}?` : choiceValue
                            }
                            onSelect={() =>
                              handleChangeWithCreateSupport(choice)
                            }
                            disabled={disabled}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                field.value === getChoiceValue(choice)
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {getOptionContent(
                              isCreateItem ? createItem : choice,
                              isCreateItem,
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </FormControl>
        <InputHelperText helperText={props.helperText} />
        <FormError />
      </FormField>
      {createElement}
    </>
  );
};

const DefaultFilterToQuery = (searchText: string) => ({ q: searchText });
