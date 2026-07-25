import { useMemo } from "react";
import { useGetList } from "ra-core";
import type { ServicePackage } from "@/modules/types";
import type { TicketCatalogPackage } from "@/modules/catalog/ticketCatalogPricing";

export const useTicketCatalogPackages = () => {
  const { data: packages = [], isPending } = useGetList<ServicePackage>(
    "service_packages",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "sort_order", order: "ASC" },
      filter: { "ticket_billing_enabled@eq": true, "active@eq": true },
    },
  );

  const ticketPackages = useMemo(
    () =>
      packages.map(
        (pkg): TicketCatalogPackage => ({
          id: pkg.id,
          name: pkg.name,
          description: pkg.description,
          suggested_price: Number(pkg.suggested_price) || 0,
          ticket_billing_slug: pkg.ticket_billing_slug,
          ticket_pricing_mode: pkg.ticket_pricing_mode ?? "flat",
          active: pkg.active,
          sort_order: pkg.sort_order,
        }),
      ),
    [packages],
  );

  return { ticketPackages, isPending };
};
