import type { DigestTime } from "@/lib/digest";
import { joinNames } from "@/lib/spaces";

/*
 * Plain module (no "use client"): shared by the page, the two routes and the
 * client components of «Il tuo profilo» (#38).
 */

export type Failure = "network" | "server";

export type StartLens = "io" | "nest";
export type DefaultVisibility = "private" | "busy" | "household";

// The times of the morning summary live in `src/lib/digest.ts` (Notifiche
// uses them too); the profile keeps importing them from here.
export {
  DEFAULT_DIGEST_TIME,
  DIGEST_TIMES,
  digestTimeLabel,
  toDigestTime,
  type DigestTime,
} from "@/lib/digest";

export const LENS_OPTIONS: ReadonlyArray<{
  value: StartLens;
  label: string;
  info: string;
}> = [
  { value: "io", label: "Io", info: "Le tue cose e quelle a cui partecipi" },
  { value: "nest", label: "Nest", info: "Le cose di tutto il Nest" },
];

export const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: DefaultVisibility;
  label: string;
  info: string;
}> = [
  { value: "private", label: "Solo io", info: "Li vedi solo tu" },
  {
    value: "busy",
    label: "Occupato",
    info: "Gli altri vedono solo che sei occupato",
  },
  {
    value: "household",
    label: "Tutto il Nest",
    info: "Tutti nel Nest vedono i dettagli",
  },
];

export function lensLabel(value: StartLens): string {
  return LENS_OPTIONS.find((o) => o.value === value)?.label ?? "Io";
}

export function visibilityLabel(value: DefaultVisibility): string {
  return VISIBILITY_OPTIONS.find((o) => o.value === value)?.label ?? "Occupato";
}

/**
 * «Con Google», «Con la mail», «Con Google e la mail»: the identities of the
 * account in the order Apple, Google, mail. Unknown ones are not named; an
 * account with none of them reads as «Con la mail».
 */
export function accessText(providers: ReadonlyArray<string>): string {
  const names: string[] = [];
  if (providers.includes("apple")) names.push("Apple");
  if (providers.includes("google")) names.push("Google");
  if (providers.includes("email")) names.push("la mail");
  return `Con ${joinNames(names.length > 0 ? names : ["la mail"])}`;
}

/** What deleting the account does to the Nest, as the dialog needs it. */
export type DeletionOutlook = {
  /** No other adult has an account: the Nest goes away with the account */
  isLastAdultWithAccount: boolean;
  /** Who stays (adults and children, no pets), in order of insertion */
  remainingNames: string[];
  /** The one who becomes administrator, when the person is the only one */
  newAdministratorName: string | null;
};

export type Preferences = {
  lens: StartLens;
  digestTime: DigestTime;
  visibility: DefaultVisibility;
};
