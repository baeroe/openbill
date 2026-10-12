import { withBase } from 'vitepress';

export const isExternal = (link: string) => /^https?:\/\//.test(link);

/** Docs links in the frontmatter start with the locale (/en/setup); the site may live below a base (/openbill/). */
export const href = (link: string) => (isExternal(link) ? link : withBase(link));
