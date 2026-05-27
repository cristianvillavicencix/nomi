import { useMemo, useState } from "react";
import { Copy, ExternalLink, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PortalCopy } from "@/lbs/portal/portalI18n";
import {
  logPortalCredentialCopy,
  revealPortalCredentialPassword,
} from "@/lbs/portal/portalCredentialsApi";
import { SensitiveSessionDialog } from "@/lbs/portal/SensitiveSessionDialog";
import { usePortalSensitiveSession } from "@/lbs/portal/usePortalSensitiveSession";
import { formatPortalDate, type PortalCredential } from "@/lbs/portal/portalTypes";

const maskPassword = () => "••••••••••";

export const ClientCredentialsSection = ({
  portalToken,
  dealId,
  accountEmail,
  credentials,
  copy,
  locale,
}: {
  portalToken: string;
  dealId: number;
  accountEmail?: string | null;
  credentials: PortalCredential[];
  copy: PortalCopy;
  locale: "es" | "en";
}) => {
  const localeTag = locale === "es" ? "es-US" : "en-US";
  const [revealed, setRevealed] = useState<Record<number, string | null>>({});
  const [visibleIds, setVisibleIds] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);

  const sensitive = usePortalSensitiveSession(portalToken, accountEmail);

  const sortedCredentials = useMemo(
    () =>
      [...credentials].sort(
        (left, right) =>
          (left.portal_sort_order ?? 0) - (right.portal_sort_order ?? 0),
      ),
    [credentials],
  );

  const revealEntry = async (entryId: number) => {
    if (!sensitive.sensitiveSessionToken) return;
    setBusyId(entryId);
    try {
      const credential = credentials.find((row) => row.id === entryId);
      const password = await revealPortalCredentialPassword({
        portalToken,
        sensitiveSession: sensitive.sensitiveSessionToken,
        dealId,
        entryId,
        kind: credential?.kind ?? null,
      });
      setRevealed((current) => ({ ...current, [entryId]: password }));
      setVisibleIds((current) => new Set(current).add(entryId));
    } finally {
      setBusyId(null);
    }
  };

  const handleView = (entryId: number) => {
    if (visibleIds.has(entryId) && revealed[entryId] !== undefined) {
      setVisibleIds((current) => {
        const next = new Set(current);
        next.delete(entryId);
        return next;
      });
      return;
    }
    sensitive.requireSensitiveSession(() => {
      void revealEntry(entryId);
    });
  };

  const handleCopy = (entry: PortalCredential) => {
    const entryId = entry.id;
    const copyPassword = async (password: string | null) => {
      if (!password || !sensitive.sensitiveSessionToken) return;
      await navigator.clipboard.writeText(password);
      await logPortalCredentialCopy({
        portalToken,
        sensitiveSession: sensitive.sensitiveSessionToken,
        dealId,
        entryId,
        kind: entry.kind ?? null,
      });
    };

    if (revealed[entryId] !== undefined) {
      void copyPassword(revealed[entryId]);
      return;
    }

    sensitive.requireSensitiveSession(() => {
      void (async () => {
        setBusyId(entryId);
        try {
          const password = await revealPortalCredentialPassword({
            portalToken,
            sensitiveSession: sensitive.sensitiveSessionToken!,
            dealId,
            entryId,
            kind: entry.kind ?? null,
          });
          setRevealed((current) => ({ ...current, [entryId]: password }));
          setVisibleIds((current) => new Set(current).add(entryId));
          await copyPassword(password);
        } finally {
          setBusyId(null);
        }
      })();
    });
  };

  if (sortedCredentials.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {copy.noSharedCredentials}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{copy.credentialsIntro}</p>
        {sensitive.isActive ? (
          <Badge variant="outline" className="w-fit">
            {copy.sensitiveSessionActive}
            {sensitive.expiresLabel ? ` · ${sensitive.expiresLabel}` : ""}
          </Badge>
        ) : (
          <Badge variant="secondary" className="w-fit">
            {copy.sensitiveSessionLocked}
          </Badge>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.serviceColumn}</TableHead>
              <TableHead>{copy.usernameColumn}</TableHead>
              <TableHead>{copy.passwordColumn}</TableHead>
              <TableHead className="text-right">{copy.actionsColumn}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCredentials.map((entry) => {
              const isVisible = visibleIds.has(entry.id);
              const passwordValue = revealed[entry.id];
              const displayPassword =
                isVisible && passwordValue
                  ? passwordValue
                  : entry.has_password
                    ? maskPassword()
                    : "—";

              return (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="font-medium">{entry.label}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {entry.managed_by === "client"
                          ? copy.managedByClient
                          : copy.managedByLbs}
                      </Badge>
                      {entry.password_updated_at ? (
                        <span className="text-[10px] text-muted-foreground">
                          {copy.updated}{" "}
                          {formatPortalDate(entry.password_updated_at, localeTag)}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.username || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{displayPassword}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {entry.has_password ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8"
                            disabled={busyId === entry.id}
                            aria-label={isVisible ? copy.hidePassword : copy.viewPassword}
                            onClick={() => handleView(entry.id)}
                          >
                            {isVisible ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8"
                            disabled={busyId === entry.id}
                            aria-label={copy.copyPassword}
                            onClick={() => handleCopy(entry)}
                          >
                            <Copy className="size-4" />
                          </Button>
                        </>
                      ) : null}
                      {entry.url ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8"
                          asChild
                        >
                          <a
                            href={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={copy.openPanel}
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <SensitiveSessionDialog
        open={sensitive.confirmOpen}
        onOpenChange={sensitive.setConfirmOpen}
        copy={copy}
        accountEmail={accountEmail}
        confirming={sensitive.confirming}
        error={sensitive.confirmError}
        codeSent={sensitive.codeSent}
        codeExpiresAt={sensitive.codeExpiresAt}
        onRequestCode={() => void sensitive.requestCode()}
        onVerifyCode={(code) => void sensitive.verifyCode(code)}
      />
    </div>
  );
};
