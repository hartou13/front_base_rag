import type { Components } from "react-markdown";

/**
 * Answers are rendered as Markdown only (react-markdown escapes raw HTML; never add rehype-raw).
 * Images and links to unknown hosts are dropped: an injected passage could use them to leak data in the URL.
 */
const ALLOWED_HOSTS = (process.env.NEXT_PUBLIC_ALLOWED_LINK_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export function isAllowedUrl(href: string | undefined): boolean {
  if (!href) return false;
  try {
    const u = new URL(href);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export const safeMarkdownComponents: Components = {
  // Never render images from the model output.
  img: ({ src }) => (isAllowedUrl(typeof src === "string" ? src : undefined) ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src as string} alt="" referrerPolicy="no-referrer" loading="lazy" />
  ) : null),
  a: ({ href, children }) =>
    href?.startsWith("#") || isAllowedUrl(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
};

/** react-markdown's default URL filter, plus: no javascript:/data: URLs ever reach the components. */
export const safeUrlTransform = (url: string): string =>
  /^(https?:|#)/i.test(url) ? url : "";
