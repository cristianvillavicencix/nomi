import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Folder,
  FolderOpen,
  Globe,
  XCircle,
} from "lucide-react";
import {
  buildPageLinkTree,
  filterLinkTree,
  type LinkTreeNode,
} from "@/lbs/website-monitor/audit/websiteAuditLinkTree";
import type { PageLinkJson } from "@/lbs/website-monitor/audit/types";
import { cn } from "@/lib/utils";

const statusLabel = (link: PageLinkJson) => {
  if (link.ok) return "Activo";
  if (link.status != null) return `HTTP ${link.status}`;
  return link.error ?? "Error";
};

const LinkRow = ({ link, depth }: { link: PageLinkJson; depth: number }) => (
  <div
    className="flex flex-wrap items-start gap-2 border-b border-border/40 py-2 last:border-0"
    style={{ paddingLeft: `${depth * 1.25 + 1.75}rem` }}
  >
    <span
      className={cn(
        "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        link.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
      )}
    >
      {link.ok ? (
        <CheckCircle2 className="size-3" />
      ) : (
        <XCircle className="size-3" />
      )}
      {statusLabel(link)}
    </span>
    <div className="min-w-0 flex-1">
      {link.text ? (
        <p className="text-sm font-medium leading-snug">{link.text}</p>
      ) : null}
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <span className="break-all">{link.url}</span>
        <ExternalLink className="size-3 shrink-0" />
      </a>
      {!link.ok && link.error ? (
        <p className="mt-1 text-[11px] text-red-600/80">{link.error}</p>
      ) : null}
    </div>
  </div>
);

const TreeBranch = ({
  node,
  depth,
  defaultOpen,
}: {
  node: LinkTreeNode;
  depth: number;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen ?? depth < 2);
  const hasChildren = node.children.length > 0 || node.links.length > 0;
  const FolderIcon = open ? FolderOpen : Folder;

  if (!hasChildren) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md py-1.5 text-left text-sm hover:bg-muted/50",
          depth === 0 && "font-semibold",
        )}
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
      >
        {node.children.length > 0 ? (
          open ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="size-4 shrink-0" />
        )}
        {node.isExternalRoot && depth === 0 ? (
          <Globe className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <FolderIcon className="size-4 shrink-0 text-amber-600/80" />
        )}
        <span className="truncate">{node.label}</span>
        <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {node.stats.total}
          {node.stats.broken > 0 ? (
            <span className="ml-1 text-red-600">
              · {node.stats.broken} rotos
            </span>
          ) : null}
        </span>
      </button>

      {open ? (
        <div>
          {node.links.map((link) => (
            <LinkRow key={link.url} link={link} depth={depth + 1} />
          ))}
          {node.children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              defaultOpen={depth < 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const WebsiteAuditLinkTreeView = ({
  internal,
  external,
}: {
  internal: LinkTreeNode;
  external: LinkTreeNode;
}) => {
  const hasInternal =
    internal.stats.total > 0 ||
    internal.links.length > 0 ||
    internal.children.length > 0;
  const hasExternal =
    external.stats.total > 0 ||
    external.links.length > 0 ||
    external.children.length > 0;

  if (!hasInternal && !hasExternal) {
    return (
      <p className="text-sm text-muted-foreground">
        Ningún enlace con este filtro.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        Vista jerárquica por ruta del sitio y dominio externo
      </div>
      <div className="max-h-[640px] overflow-y-auto py-2">
        {hasInternal ? (
          <TreeBranch node={internal} depth={0} defaultOpen />
        ) : null}
        {hasExternal ? (
          <TreeBranch node={external} depth={0} defaultOpen={!hasInternal} />
        ) : null}
      </div>
    </div>
  );
};

export const useFilteredLinkTrees = (
  auditUrl: string,
  links: PageLinkJson[],
  filter: "all" | "ok" | "broken" | "internal" | "external",
) =>
  useMemo(() => {
    const predicate = (link: PageLinkJson) => {
      if (filter === "ok") return link.ok;
      if (filter === "broken") return !link.ok;
      if (filter === "internal") return link.isInternal;
      if (filter === "external") return !link.isInternal;
      return true;
    };

    const { internal, external } = buildPageLinkTree(auditUrl, links);
    const filteredInternal =
      filter === "external" ? null : filterLinkTree(internal, predicate);
    const filteredExternal =
      filter === "internal" ? null : filterLinkTree(external, predicate);

    return {
      internal: filteredInternal ?? {
        ...internal,
        links: [],
        children: [],
        stats: { total: 0, ok: 0, broken: 0 },
      },
      external: filteredExternal ?? {
        ...external,
        links: [],
        children: [],
        stats: { total: 0, ok: 0, broken: 0 },
      },
    };
  }, [auditUrl, filter, links]);
