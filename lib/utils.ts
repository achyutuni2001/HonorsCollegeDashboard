import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatGpa(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(2);
}

export function formatCampusName(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value
    .replace(/\s*-\s*associates\s+courses/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatClassStanding(value: string | null | undefined) {
  if (!value) return "Unknown";
  const normalized = value.trim().toUpperCase();
  const map: Record<string, string> = {
    FR: "Freshman",
    SO: "Sophomore",
    JR: "Junior",
    SR: "Senior",
    GR: "Graduate",
    PB: "Post-Baccalaureate"
  };
  return map[normalized] ?? value;
}

export function formatSemesterLabel(value: string | null | undefined) {
  if (!value) return "Unknown Semester";
  return value.replace(/\.(csv|xlsx|xls)$/i, "").trim();
}
