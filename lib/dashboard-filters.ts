import { and, eq, gte, ilike, lte, ne, or, type SQL } from "drizzle-orm";
import { studentRecords } from "@/db/schema";
import type { DashboardFilters } from "@/types/analytics";

function buildFilterConditions(filters: DashboardFilters, includeDataset = true): SQL[] {
  const conditions: SQL[] = includeDataset ? [eq(studentRecords.datasetId, filters.datasetId)] : [];

  if (filters.campus) conditions.push(eq(studentRecords.campus, filters.campus));
  if (filters.majorDescription) {
    conditions.push(eq(studentRecords.majorDescription, filters.majorDescription));
  }
  if (filters.classStanding) conditions.push(eq(studentRecords.classStanding, filters.classStanding));
  if (filters.studentType) conditions.push(eq(studentRecords.studentType, filters.studentType));
  if (filters.excludeZeroGpa) conditions.push(ne(studentRecords.gpa, 0));
  if (filters.gpaMin != null) conditions.push(gte(studentRecords.gpa, filters.gpaMin));
  if (filters.gpaMax != null) conditions.push(lte(studentRecords.gpa, filters.gpaMax));

  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(studentRecords.pantherId, q),
        ilike(studentRecords.fullName, q),
        ilike(studentRecords.majorDescription, q),
        ilike(studentRecords.campus, q)
      )!
    );
  }

  return conditions;
}

export function buildStudentFilterConditions(filters: DashboardFilters): SQL[] {
  return buildFilterConditions(filters, true);
}

export function buildCrossDatasetFilterConditions(filters: DashboardFilters): SQL[] {
  return buildFilterConditions(filters, false);
}

export function andAll(conditions: SQL[]): SQL | undefined {
  if (!conditions.length) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
}
