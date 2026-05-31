import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const WebsiteAuditTableShell = ({
  columns,
  children,
  className,
}: {
  columns: string[];
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm",
      className,
    )}
  >
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          {columns.map((col) => (
            <TableHead key={col} className="text-xs font-semibold uppercase">
              {col}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  </div>
);

export { TableCell, TableRow };
