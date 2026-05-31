import type { PageLinkJson } from "@/lbs/website-monitor/audit/types";

export type LinkTreeStats = {
  total: number;
  ok: number;
  broken: number;
};

export type LinkTreeNode = {
  id: string;
  label: string;
  path: string;
  links: PageLinkJson[];
  children: LinkTreeNode[];
  stats: LinkTreeStats;
  isExternalRoot?: boolean;
  hostname?: string;
};

const emptyStats = (): LinkTreeStats => ({ total: 0, ok: 0, broken: 0 });

const addLinkStats = (stats: LinkTreeStats, link: PageLinkJson) => {
  stats.total += 1;
  if (link.ok) stats.ok += 1;
  else stats.broken += 1;
};

const mergeStats = (target: LinkTreeStats, source: LinkTreeStats) => {
  target.total += source.total;
  target.ok += source.ok;
  target.broken += source.broken;
};

const sameSite = (base: URL, target: URL) =>
  base.hostname.replace(/^www\./, "") === target.hostname.replace(/^www\./, "");

const findOrCreateChild = (
  parent: LinkTreeNode,
  segment: string,
  path: string,
): LinkTreeNode => {
  const existing = parent.children.find((child) => child.label === segment);
  if (existing) return existing;

  const child: LinkTreeNode = {
    id: `${parent.id}/${segment}`,
    label: segment,
    path,
    links: [],
    children: [],
    stats: emptyStats(),
  };
  parent.children.push(child);
  parent.children.sort((a, b) => a.label.localeCompare(b.label));
  return child;
};

const insertInternalLink = (root: LinkTreeNode, link: PageLinkJson, base: URL) => {
  let url: URL;
  try {
    url = new URL(link.url, base.href);
  } catch {
    root.links.push(link);
    return;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    root.links.push(link);
    return;
  }

  let node = root;
  let path = "";
  for (const segment of segments) {
    path += `/${segment}`;
    node = findOrCreateChild(node, segment, path);
  }

  node.links.push(link);
};

const insertExternalLink = (externalRoot: LinkTreeNode, link: PageLinkJson) => {
  let url: URL;
  try {
    url = new URL(link.url);
  } catch {
    externalRoot.links.push(link);
    return;
  }

  const hostNode = findOrCreateChild(
    externalRoot,
    url.hostname,
    url.hostname,
  );
  hostNode.hostname = url.hostname;

  const segments = url.pathname.split("/").filter(Boolean);
  let node = hostNode;
  let path = url.hostname;

  for (const segment of segments) {
    path += `/${segment}`;
    node = findOrCreateChild(node, segment, path);
  }

  node.links.push(link);
};

const finalizeStats = (node: LinkTreeNode): LinkTreeStats => {
  const stats = emptyStats();
  for (const link of node.links) addLinkStats(stats, link);
  for (const child of node.children) {
    mergeStats(stats, finalizeStats(child));
  }
  node.stats = stats;
  return stats;
};

export const buildPageLinkTree = (
  auditUrl: string,
  links: PageLinkJson[],
): { internal: LinkTreeNode; external: LinkTreeNode } => {
  let base: URL;
  try {
    base = new URL(auditUrl);
  } catch {
    base = new URL("https://example.com/");
  }

  const internal: LinkTreeNode = {
    id: "internal-root",
    label: base.hostname.replace(/^www\./, ""),
    path: "/",
    links: [],
    children: [],
    stats: emptyStats(),
  };

  const external: LinkTreeNode = {
    id: "external-root",
    label: "Enlaces externos",
    path: "external",
    links: [],
    children: [],
    stats: emptyStats(),
    isExternalRoot: true,
  };

  for (const link of links) {
    let url: URL;
    try {
      url = new URL(link.url, base.href);
    } catch {
      internal.links.push(link);
      continue;
    }

    const isInternal = link.isInternal || sameSite(base, url);
    if (isInternal) {
      insertInternalLink(internal, link, base);
    } else {
      insertExternalLink(external, link);
    }
  }

  finalizeStats(internal);
  finalizeStats(external);

  return { internal, external };
};

export const filterLinkTree = (
  node: LinkTreeNode,
  predicate: (link: PageLinkJson) => boolean,
): LinkTreeNode | null => {
  const links = node.links.filter(predicate);
  const children = node.children
    .map((child) => filterLinkTree(child, predicate))
    .filter((child): child is LinkTreeNode => child != null);

  if (links.length === 0 && children.length === 0) return null;

  const filtered: LinkTreeNode = {
    ...node,
    links,
    children,
    stats: emptyStats(),
  };
  finalizeStats(filtered);
  return filtered;
};
