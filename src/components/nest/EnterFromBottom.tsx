"use client";

import { useEffect } from "react";

/**
 * On mobile (up to 1023 px) "Il tuo Nest" rises from the bottom when it opens,
 * with the keyframe of the sheets (`foglio-entra`) in `--durata-normale` and
 * `--curva`. From 1024 px it is a normal page: no animation. With reduced
 * motion the global rule switches every animation off.
 *
 * It is set from here, not from a CSS file of the page: a stylesheet linked
 * only by this page would keep the loading skeleton on screen until it loads.
 */
export function EnterFromBottom() {
  useEffect(() => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const main = document.getElementById("contenuto");
    if (!main) return;
    main.style.animation = "foglio-entra var(--durata-normale) var(--curva)";
    return () => {
      main.style.animation = "";
    };
  }, []);

  return null;
}
