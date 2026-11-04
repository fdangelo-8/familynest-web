import { expect, type Page } from "@playwright/test";
import type { ThrowawayUser } from "./throwaway-user";

// Helpers for the tests of the profile preferences read by the app frame
// (issue #231): the lens the person starts from and the visibility proposed for
// a new event. Tests use throwaway users, never the seed.

export type StartLens = "io" | "nest";
export type DefaultVisibility = "household" | "busy" | "private";

export const LENS_LABEL = "Punto di vista: solo tu o tutto il Nest";

/** Writes the preferences with the session of the user (the column grants apply) and checks them. */
export async function setPreferences(
  user: ThrowawayUser,
  preferences: {
    start_lens?: StartLens;
    default_event_visibility?: DefaultVisibility;
  },
): Promise<void> {
  const { error } = await user.client
    .from("profiles")
    .update(preferences)
    .eq("id", user.id);
  if (error) throw new Error("Preferenze di prova non scritte");
  const { data, error: readError } = await user.admin
    .from("profiles")
    .select("start_lens, default_event_visibility")
    .eq("id", user.id)
    .single();
  if (readError) throw new Error("Preferenze di prova non lette");
  expect(data).toMatchObject(preferences);
}

/** A button of the lens switch («Io» or «Nest»). */
export const lensButton = (page: Page, which: "Io" | "Nest") =>
  page
    .getByRole("group", { name: LENS_LABEL })
    .getByRole("button", { name: new RegExp(`${which}$`) });

/** Clicks a lens button until the client is hydrated and the state changes. */
export async function chooseLens(page: Page, which: "Io" | "Nest") {
  const button = lensButton(page, which);
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true", {
      timeout: 1000,
    });
  }).toPass();
}

/** Labels («Io» / «Nest») of the lens buttons that are pressed in a piece of HTML. */
export function pressedLenses(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(
    /<button[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/g,
  )) {
    const text = match[1]!.replace(/<[^>]*>/g, "").trim();
    const label = /(Io|Nest)$/.exec(text)?.[1];
    if (label) found.add(label);
  }
  return [...found];
}

/** Collects the hydration errors the page writes in the console, from now on. */
export function watchHydration(page: Page): () => string[] {
  const found: string[] = [];
  const pattern =
    /hydrat|did not match|Minified React error #(418|419|422|423|425)/i;
  page.on("console", (message) => {
    if (message.type() === "error" && pattern.test(message.text())) {
      found.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (pattern.test(error.message)) found.push(error.message);
  });
  return () => found;
}
