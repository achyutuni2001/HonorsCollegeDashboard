import { z } from "zod";
import type { DashboardFilters } from "@/types/analytics";

const booleanish = z
  .union([z.string(), z.boolean(), z.undefined(), z.null()])
  .transform((v) => {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on";
  });

export function parseDashboardFilters(input: URLSearchParams): DashboardFilters {
  const schema = z.object({
    datasetId: z.string().min(1),
    campus: z.string().optional(),
    majorDescription: z.string().optional(),
    classStanding: z.string().optional(),
    studentType: z.string().optional(),
    gpaMin: z.coerce.number().min(0).max(5).optional(),
    gpaMax: z.coerce.number().min(0).max(5).optional(),
    excludeZeroGpa: booleanish.optional(),
    search: z.string().optional()
  });

  const parsed = schema.parse(Object.fromEntries(input.entries()));
  return {
    ...parsed,
    campus: parsed.campus || undefined,
    majorDescription: parsed.majorDescription || undefined,
    classStanding: parsed.classStanding || undefined,
    studentType: parsed.studentType || undefined,
    search: parsed.search || undefined,
    excludeZeroGpa: parsed.excludeZeroGpa ?? false
  };
}

export function parseRecordsParams(input: URLSearchParams) {
  const filters = parseDashboardFilters(input);
  const schema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(10).max(100).default(25),
    sortField: z.string().default("gpa"),
    sortDirection: z.enum(["asc", "desc"]).default("desc")
  });
  const parsed = schema.parse(Object.fromEntries(input.entries()));
  return { ...filters, ...parsed };
}
