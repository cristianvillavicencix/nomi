import { PeopleQuickNavItem } from "./people-quick-nav-item";
import type { PeopleQuickNavItem as QuickItem } from "./types";

export const SalespersonQuickNavItem = ({
  item,
  active,
  onSelect,
}: {
  item: QuickItem;
  active: boolean;
  onSelect: (id: string) => void;
}) => (
  <PeopleQuickNavItem
    item={item}
    active={active}
    onSelect={onSelect}
    secondaryLine={item.email || item.phone || "No contact info"}
  />
);

