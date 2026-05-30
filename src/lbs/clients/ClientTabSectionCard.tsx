import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTabCount } from "@/lbs/clients/clientShowUtils";

type ClientTabSectionCardProps = {
  title: string;
  count?: number;
  action?: ReactNode;
  flush?: boolean;
  children: ReactNode;
};

export const ClientTabSectionCard = ({
  title,
  count,
  action,
  flush = false,
  children,
}: ClientTabSectionCardProps) => (
  <Card className="gap-0 overflow-hidden py-0 shadow-none">
    <CardHeader className="border-b px-4 py-3">
      <CardTitle className="text-sm font-semibold">
        {title}
        {formatTabCount(count)}
      </CardTitle>
      {action ? <CardAction>{action}</CardAction> : null}
    </CardHeader>
    <CardContent className={flush ? "p-0" : "p-4"}>{children}</CardContent>
  </Card>
);

export const clientSubTabsListClassName =
  "mb-4 inline-flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1";

export const clientSubTabTriggerClassName = "shrink-0";

export const clientTableWrapperClassName = "overflow-x-auto";

/** Bordered content area without a header — use inside accordion sections. */
export const ClientTabContentCard = ({
  flush = false,
  children,
}: {
  flush?: boolean;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "overflow-hidden rounded-lg border bg-card shadow-none",
      flush ? undefined : "p-4",
    )}
  >
    {children}
  </div>
);

type ClientInnerSectionCardProps = {
  title: string;
  flush?: boolean;
  children: ReactNode;
};

export const ClientInnerSectionCard = ({
  title,
  flush = false,
  children,
}: ClientInnerSectionCardProps) => (
  <div className="overflow-hidden rounded-lg border bg-card shadow-none">
    <div className="border-b bg-muted/20 px-4 py-2.5 text-sm font-medium">
      {title}
    </div>
    <div className={flush ? undefined : "p-4"}>{children}</div>
  </div>
);
