import "server-only";
import { headers } from "next/headers";
import { originForHost } from "@/lib/origin";

/**
 * The one way the server knows the address of the app outside a route
 * (routes use `request.nextUrl.origin`). `https` unless the host is
 * `localhost` or `127.0.0.1`. The only file in `src/` that reads the host
 * headers.
 */
export async function getRequestOrigin(): Promise<string> {
  const list = await headers();
  return originForHost(list.get("x-forwarded-host") ?? list.get("host"));
}
