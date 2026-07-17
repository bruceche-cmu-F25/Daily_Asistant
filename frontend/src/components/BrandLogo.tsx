import type { ReactNode } from "react";

const brandRules: Array<[string, string, string]> = [
  ["linkedin.com", "linkedin", "in"], ["github.com", "github", "GH"],
  ["youtube.com", "youtube", "YT"], ["leetcode.com", "leetcode", "LC"],
  ["neetcode.io", "neetcode", "NC"], ["freecodecamp.org", "freecodecamp", "fC"],
  ["notion.so", "notion", "N"], ["jobright.ai", "jobright", "JR"],
  ["simplify.jobs", "simplify", "S"], ["mail.google.com", "gmail", "M"],
  ["joinhandshake.com", "handshake", "H"], ["google.com", "google", "G"],
];

export function brandIdentity(url: string) {
  const match = brandRules.find(([host]) => url.includes(host));
  return match ? { mark: match[2], brand: match[1] } : { mark: "↗", brand: "default" };
}

function LogoFrame({ children }: { children: ReactNode }) {
  return <svg className="brand-logo-svg" viewBox="0 0 24 24" focusable="false" aria-hidden="true">{children}</svg>;
}

export function BrandGlyph({ brand, fallback }: { brand: string; fallback: string }) {
  switch (brand) {
    case "gmail":
      return <LogoFrame><path d="M3 6.3 12 13l9-6.7V19h-4v-8l-5 3.7L7 11v8H3V6.3Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" /></LogoFrame>;
    case "youtube":
      return <LogoFrame><rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" /><path d="m10 8.6 6 3.4-6 3.4Z" fill="#050a07" /></LogoFrame>;
    case "linkedin":
      return <LogoFrame><rect x="2" y="2" width="20" height="20" rx="2" fill="currentColor" /><circle cx="7" cy="7" r="1.5" fill="#050a07" /><path d="M5.7 10h2.6v8H5.7Zm4.4 0h2.5v1.1c.8-1 1.8-1.4 3-1.4 2.2 0 3.4 1.4 3.4 4.1V18h-2.7v-3.8c0-1.3-.5-2.1-1.6-2.1-1.3 0-1.9.9-1.9 2.6V18h-2.7Z" fill="#050a07" /></LogoFrame>;
    case "github":
      return <LogoFrame><path fill="currentColor" d="M12 .8A11.2 11.2 0 0 0 8.5 22.6c.6.1.8-.3.8-.6v-2.1c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.4-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.3 11.3 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2V22c0 .3.2.7.8.6A11.2 11.2 0 0 0 12 .8Z" /></LogoFrame>;
    case "notion":
      return <LogoFrame><rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M7 17V7l3-.2 7 10V7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" /></LogoFrame>;
    case "leetcode":
      return <LogoFrame><path d="m14.5 3-7 7a4.5 4.5 0 0 0 0 6.4l4 4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><path d="M9 12h11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><path d="m8 10 5-5" stroke="#ffc55c" strokeWidth="2.5" strokeLinecap="round" /></LogoFrame>;
    case "neetcode":
      return <LogoFrame><path d="M14.5 3.2c3.1 1 5.3 3.2 6.3 6.3l-5.9 5.9-6.3-6.3 5.9-5.9Z" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="15.8" cy="8.2" r="1.6" fill="currentColor" /><path d="m9.2 14.8-3.4 3.4m1.1-5.7-3.2.9 2.9 2.9m4.9.8-.9 3.2-2.9-2.9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></LogoFrame>;
    case "freecodecamp":
      return <LogoFrame><path d="M12 2.5c1.1 3.3-.3 4.8-1.5 6.1-1.1 1.2-2 2.2-1.2 4.1.5-1.2 1.4-1.8 2.2-2.4 1.5 1.6 3.2 3.1 3.2 5.6 0 2.4-1.6 4.1-3.9 4.1-2.9 0-5-2.1-5-5.2 0-4.7 4.6-6.3 6.2-12.3Zm3.2 6.2c1.7 1.4 3 3.3 3 5.7 0 3.8-2.6 6.6-6.2 7.1 4.9.4 8.4-2.7 8.4-7.1 0-2.7-1.7-4.8-5.2-5.7Z" fill="currentColor" /></LogoFrame>;
    case "jobright":
      return <LogoFrame><path d="M5 4h9v10H9V9H5V4Zm5 6h9v10h-9V10Z" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="m14 4 5 5m0-5v5h-5" fill="none" stroke="currentColor" strokeWidth="2" /></LogoFrame>;
    case "simplify":
      return <LogoFrame><path d="M14 2 5 13h6l-1 9 9-12h-6l1-8Z" fill="currentColor" /></LogoFrame>;
    case "handshake":
      return <LogoFrame><path d="m3 11 5-5 4 3 4-3 5 5-5 6-4-3-4 3-5-6Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="m8 11 4 3 4-3" fill="none" stroke="currentColor" strokeWidth="2" /></LogoFrame>;
    case "google":
      return <LogoFrame><path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12V14h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" /><path fill="#34a853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 1-3.5 1-2.6 0-4.8-1.8-5.6-4.2H3.1v2.6A10 10 0 0 0 12 22Z" /><path fill="#fbbc05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z" /><path fill="#ea4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.5 9.5 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6c.8-2.4 3-4.2 5.6-4.2Z" /></LogoFrame>;
    default:
      return <span className="brand-logo-fallback">{fallback}</span>;
  }
}
