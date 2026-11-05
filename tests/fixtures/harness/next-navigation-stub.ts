// Stand-in for `next/navigation` in the browser harness. The real module needs
// the router of Next.js, which does not exist outside the app: the shared
// components import it (BarIconLink, NestProvider), but the scenarios never
// navigate.
export function useRouter() {
  return {
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  };
}

export function usePathname() {
  return "/privacy";
}
