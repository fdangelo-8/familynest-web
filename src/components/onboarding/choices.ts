import type { Database } from "@/types/database";

type MemberColor = Database["public"]["Enums"]["member_color"];

export type Living = "solo" | "coppia" | "famiglia" | "coinquilini";

export type Choice = {
  value: Living;
  title: string;
  info: string;
  circles: { color: MemberColor; small?: boolean }[];
};

export const CHOICES: readonly Choice[] = [
  {
    value: "solo",
    title: "Solo io",
    info: "Per organizzare le tue cose",
    circles: [{ color: "pomodoro" }],
  },
  {
    value: "coppia",
    title: "In coppia",
    info: "Tu e il tuo partner",
    circles: [{ color: "pomodoro" }, { color: "glicine" }],
  },
  {
    value: "famiglia",
    title: "In famiglia, con figli",
    info: "Si attivano scuola e profili dei figli",
    circles: [
      { color: "pomodoro" },
      { color: "glicine" },
      { color: "salvia", small: true },
    ],
  },
  {
    value: "coinquilini",
    title: "Con coinquilini",
    info: "Spesa e spese di casa in comune",
    circles: [
      { color: "pomodoro" },
      { color: "cobalto" },
      { color: "zafferano" },
    ],
  },
];

export function isLiving(value: unknown): value is Living {
  return CHOICES.some((c) => c.value === value);
}
