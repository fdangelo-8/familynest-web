"use client";

import { useState } from "react";
import { safeImageSrc } from "@/lib/safe-image-src";

/**
 * The photo inside an `Avatar` (`img.avatar__foto`). If it does not load the
 * initial comes back, on the colour of the avatar (still there under the photo).
 */
export function AvatarPhoto({
  src,
  initial,
}: {
  src: string;
  initial: string;
}) {
  const [failed, setFailed] = useState(false);
  // The address is checked here too, right before it reaches the `img`.
  const safe = safeImageSrc(src);
  if (failed || !safe) return <>{initial}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small avatar from a signed or local address: no optimisation needed
    <img
      className="avatar__foto"
      src={safe}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
