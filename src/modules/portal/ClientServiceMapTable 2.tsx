import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PortalCopy } from "@/modules/portal/portalI18n";
import {
  inferCredentialLocation,
  inferCredentialProvider,
} from "@/modules/portal/portalServiceMeta";
import type { PortalCredential } from "@/modules/portal/portalTypes";

export const ClientServiceMapTable = ({
  entries,
  copy,
}: {
  entries: PortalCredential[];
  copy: PortalCopy;
}) => {
  if (entries.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{copy.serviceColumn}</TableHead>
            <TableHead>{copy.serviceProviderColumn}</TableHead>
            <TableHead>{copy.serviceLocationColumn}</TableHead>
            <TableHead>{copy.managedByLabel}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const provider =
              inferCredentialProvider(entry) ?? copy.serviceProviderUnknown;
            const location =
              inferCredentialLocation(entry) ?? copy.serviceLocationUnknown;

            return (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.label}</TableCell>
                <TableCell>{provider}</TableCell>
                <TableCell className="font-mono text-xs">{location}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {entry.managed_by === "client"
                      ? copy.managedByClient
                      : copy.managedByLbs}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
