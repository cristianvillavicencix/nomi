export * from "../../share-meta/publicShareMeta";
import type { PublicShareMeta } from "../../share-meta/publicShareMeta";

const META_TAGS: Array<{
  selector: string;
  key: keyof Pick<
    PublicShareMeta,
    "title" | "description" | "siteName" | "imageUrl" | "url"
  >;
}> = [
  { selector: 'meta[name="description"]', key: "description" },
  { selector: 'meta[property="og:site_name"]', key: "siteName" },
  { selector: 'meta[property="og:title"]', key: "title" },
  { selector: 'meta[property="og:description"]', key: "description" },
  { selector: 'meta[property="og:image"]', key: "imageUrl" },
  { selector: 'meta[property="og:url"]', key: "url" },
  { selector: 'meta[name="twitter:title"]', key: "title" },
  { selector: 'meta[name="twitter:description"]', key: "description" },
  { selector: 'meta[name="twitter:image"]', key: "imageUrl" },
];

const ensureMetaTag = (attribute: "name" | "property", value: string) => {
  const selector = `meta[${attribute}="${value}"]`;
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }
  return element;
};

export const applyPublicShareMeta = (meta: PublicShareMeta) => {
  if (typeof document === "undefined") return;

  document.title = meta.title;

  ensureMetaTag("property", "og:type").content = "website";
  ensureMetaTag("name", "twitter:card").content = "summary_large_image";

  for (const tag of META_TAGS) {
    const node = document.querySelector(tag.selector) as HTMLMetaElement | null;
    if (node) {
      node.content = meta[tag.key];
      continue;
    }

    if (tag.selector.includes('property="og:')) {
      const property = tag.selector.match(/property="([^"]+)"/)?.[1];
      if (property) ensureMetaTag("property", property).content = meta[tag.key];
      continue;
    }

    const name = tag.selector.match(/name="([^"]+)"/)?.[1];
    if (name) ensureMetaTag("name", name).content = meta[tag.key];
  }
};
