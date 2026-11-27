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
  // Written here so that static analysis sees the check; the full rule is `safeImageSrc`.
  const isSafe =
    src.startsWith("blob:") ||
    src.startsWith("data:image/webp") ||
    src.startsWith("data:image/jpeg") ||
    (src.startsWith("/") && !src.startsWith("//"));
  if (failed || !isSafe) return <>{initial}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small avatar from a signed or local address: no optimisation needed
    <img
      // A photo that failed before the page was hydrated has already fired its
      // `error`: nobody was listening, so look at it when React takes over.
      ref={(node) => {
        if (node && node.complete && node.naturalWidth === 0) setFailed(true);
      }}
      className="avatar__foto"
      src={src}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
