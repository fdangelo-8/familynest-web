"use client";

import { useState } from "react";

/**
 * The photo inside an `Avatar` (`img.avatar__foto`). If it does not load, or
 * the address is not one of the safe kinds, the initial comes back, on the
 * colour of the avatar (still there under the photo).
 */
export function AvatarPhoto({
  src,
  initial,
}: {
  src: string;
  initial: string;
}) {
  const [failed, setFailed] = useState(false);
  const isSafe =
    src.startsWith("blob:") ||
    src.startsWith("data:image/webp") ||
    src.startsWith("data:image/jpeg") ||
    (src.startsWith("/") && !src.startsWith("//"));
  if (failed || !isSafe) return <>{initial}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small avatar from a signed or local address: no optimisation needed
    <img
      className="avatar__foto"
      src={src}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
