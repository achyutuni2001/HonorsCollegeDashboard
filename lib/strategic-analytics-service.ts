import { and, asc, desc, eq, ilike, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { datasets, studentRecords } from "@/db/schema";
import { andAll, buildCrossDatasetFilterConditions, buildStudentFilterConditions } from "@/lib/dashboard-filters";
import type { DashboardFilters, StrategicInsightsResponse, StudentHistoryResponse } from "@/types/analytics";

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function semesterSortKey(label: string, createdAt: string | Date) {
  const normalized = label.trim().toLowerCase();
  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : NaN;
  const termOrder =
    normalized.includes("spring")
      ? 1
      : normalized.includes("summer")
        ? 2
        : normalized.includes("fall")
          ? 3
          : normalized.includes("winter")
            ? 0
            : 9;
  if (Number.isFinite(year)) return year * 10 + termOrder;
  return new Date(createdAt).getTime();
}

function inferNextSemesterLabel(latestLabel: string) {
  const normalized = latestLabel.trim();
  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  if (!yearMatch) return "Next Semester";
  const year = Number(yearMatch[1]);
  const lower = normalized.toLowerCase();
  if (lower.includes("spring")) return `Summer ${year}`;
  if (lower.includes("summer")) return `Fall ${year}`;
  if (lower.includes("fall")) return `Spring ${year + 1}`;
  if (lower.includes("winter")) return `Spring ${year}`;
  return `Next Semester ${year + 1}`;
}

function linearForecast(values: number[]) {
  if (values.length < 3) {
    return { projected: null, lower: null, upper: null };
  }
  const n = values.length;
  const xs = values.map((_, i) => i + 1);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  const numerator = xs.reduce((sum, x, i) => sum + (x - xMean) * (values[i] - yMean), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0) || 1;
  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;
  const projected = intercept + slope * (n + 1);
  const residuals = values.map((y, i) => y - (intercept + slope * (i + 1)));
  const residualStd = Math.sqrt(
    residuals.reduce((sum, r) => sum + r * r, 0) / Math.max(1, residuals.length - 2)
  );
  return {
    projected: Math.round(Math.max(0, projected)),
    lower: Math.round(Math.max(0, projected - 1.96 * residualStd)),
    upper: Math.round(Math.max(0, projected + 1.96 * residualStd))
  };
}

export async function getStrategicInsights(
  filters: DashboardFilters,
  cohortDatasetId?: string
): Promise<StrategicInsightsResponse> {
  const [allDatasets, selectedDatasetRows] = await Promise.all([
    db
      .select({ id: datasets.id, semesterLabel: datasets.semesterLabel, createdAt: datasets.createdAt })
      .from(datasets),
    db
      .select({ id: datasets.id, semesterLabel: datasets.semesterLabel, createdAt: datasets.createdAt })
      .from(datasets)
      .where(eq(datasets.id, filters.datasetId))
      .limit(1)
  ]);

  const selectedDataset = selectedDatasetRows[0];
  if (!selectedDataset) throw new Error("Dataset not found");

  const sortedDatasets = [...allDatasets].sort(
    (a, b) => semesterSortKey(a.semesterLabel, a.createdAt) - semesterSortKey(b.semesterLabel, b.createdAt)
  );
  const selectedIndex = sortedDatasets.findIndex((d) => d.id === selectedDataset.id);
  const previousDataset = selectedIndex > 0 ? sortedDatasets[selectedIndex - 1] : null;

  const selectedWhere = andAll(buildStudentFilterConditions(filters));
  const crossWhere = andAll(buildCrossDatasetFilterConditions(filters));

  const [gpaRiskRows, campusCurrentRows, campusPreviousRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentRecords)
      .where(and(selectedWhere, sql`${studentRecords.gpa} < 2`)),
    db
      .select({ campus: studentRecords.campus, count: sql<number>`count(*)::int` })
      .from(studentRecords)
      .where(selectedWhere)
      .groupBy(studentRecords.campus),
    previousDataset
      ? db
          .select({ campus: studentRecords.campus, count: sql<number>`count(*)::int` })
          .from(studentRecords)
          .where(
            and(
              andAll(buildCrossDatasetFilterConditions({ ...filters, datasetId: previousDataset.id })),
              eq(studentRecords.datasetId, previousDataset.id)
            )
          )
          .groupBy(studentRecords.campus)
      : Promise.resolve([])
  ]);

  const perDatasetRows = await db
    .select({
      datasetId: studentRecords.datasetId,
      totalStudents: sql<number>`count(*)::int`,
      averageGpa: sql<number | null>`avg(${studentRecords.gpa})::float`,
      returningCount: sql<number>`
        sum(case when lower(coalesce(${studentRecords.studentType}, '')) like '%return%' or lower(coalesce(${studentRecords.studentType}, '')) like '%continu%' then 1 else 0 end)::int
      `,
      newCount: sql<number>`
        sum(case when not (lower(coalesce(${studentRecords.studentType}, '')) like '%return%' or lower(coalesce(${studentRecords.studentType}, '')) like '%continu%') then 1 else 0 end)::int
      `
    })
    .from(studentRecords)
    .where(crossWhere)
    .groupBy(studentRecords.datasetId);

  const perDatasetMap = new Map(perDatasetRows.map((row) => [row.datasetId, row]));
  const sortedWithAgg = sortedDatasets.map((dataset) => {
    const agg = perDatasetMap.get(dataset.id);
    return {
      datasetId: dataset.id,
      semesterLabel: dataset.semesterLabel,
      createdAt: dataset.createdAt,
      totalStudents: toNumber(agg?.totalStudents),
      averageGpa: toNullableNumber(agg?.averageGpa),
      returningCount: toNumber(agg?.returningCount),
      newCount: toNumber(agg?.newCount)
    };
  });

  const selectedAgg = sortedWithAgg.find((row) => row.datasetId === selectedDataset.id);
  const prevAgg = previousDataset
    ? sortedWithAgg.find((row) => row.datasetId === previousDataset.id)
    : undefined;

  const campusPrevMap = new Map(campusPreviousRows.map((row) => [row.campus ?? "Unknown", toNumber(row.count)]));
  const campusCurrentMap = new Map(campusCurrentRows.map((row) => [row.campus ?? "Unknown", toNumber(row.count)]));
  const campusShiftHighlights = Array.from(
    new Set([...campusCurrentMap.keys(), ...campusPrevMap.keys()])
  )
    .map((campus) => {
      const previous = campusPrevMap.get(campus) ?? 0;
      const current = campusCurrentMap.get(campus) ?? 0;
      return { campus, previous, current, delta: current - previous };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);

  const cohortBaseDataset = sortedDatasets.find((d) => d.id === cohortDatasetId) ?? sortedDatasets[0] ?? null;
  const cohortIdsRows = cohortBaseDataset
    ? await db
        .selectDistinct({ pantherId: studentRecords.pantherId })
        .from(studentRecords)
        .where(
          and(
            andAll(buildCrossDatasetFilterConditions(filters)),
            eq(studentRecords.datasetId, cohortBaseDataset.id),
            ne(studentRecords.pantherId, "")
          )
        )
    : [];
  const cohortIds = cohortIdsRows
    .map((row) => row.pantherId?.trim())
    .filter((value): value is string => Boolean(value));
  const cohortSize = cohortIds.length;
  const cohortHistoryRows =
    cohortSize > 0
      ? await db
          .select({
            datasetId: studentRecords.datasetId,
            pantherId: studentRecords.pantherId,
            gpa: studentRecords.gpa,
            campus: studentRecords.campus
          })
          .from(studentRecords)
          .where(and(crossWhere, inArray(studentRecords.pantherId, cohortIds)))
      : [];
  const cohortByDataset = new Map<
    string,
    { ids: Set<string>; gpas: number[]; campuses: Set<string> }
  >();
  for (const row of cohortHistoryRows) {
    const id = row.datasetId;
    if (!cohortByDataset.has(id)) {
      cohortByDataset.set(id, { ids: new Set(), gpas: [], campuses: new Set() });
    }
    const bucket = cohortByDataset.get(id)!;
    if (row.pantherId) bucket.ids.add(row.pantherId);
    if (row.gpa != null) bucket.gpas.push(Number(row.gpa));
    if (row.campus) bucket.campuses.add(row.campus);
  }

  const outcomesExpr = sql<string>`
    coalesce(
      nullif(trim(${studentRecords.raw} ->> 'GRADUATION_INTENT'), ''),
      nullif(trim(${studentRecords.raw} ->> 'DEGREE_PROGRESS'), ''),
      nullif(trim(${studentRecords.raw} ->> 'EXPECTED_GRAD_TERM'), '')
    )
  `;
  const outcomesRows = await db
    .select({ label: outcomesExpr, count: sql<number>`count(*)::int` })
    .from(studentRecords)
    .where(selectedWhere)
    .groupBy(outcomesExpr)
    .orderBy(desc(sql`count(*)`));
  const graduationIntentDistribution = outcomesRows
    .filter((row) => Boolean(row.label))
    .slice(0, 8)
    .map((row) => ({ label: String(row.label), count: toNumber(row.count) }));

  const [missingGpaRows, duplicatePantherRows, unknownCampusRows, unknownTypeRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentRecords)
      .where(and(selectedWhere, isNull(studentRecords.gpa))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(
        db
          .select({
            pantherId: studentRecords.pantherId,
            duplicateCount: sql<number>`count(*)::int`
          })
          .from(studentRecords)
          .where(and(selectedWhere, ne(studentRecords.pantherId, "")))
          .groupBy(studentRecords.pantherId)
          .having(sql`count(*) > 1`)
          .as("dup")
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentRecords)
      .where(
        and(
          selectedWhere,
          sql`(${studentRecords.campus} is null or trim(${studentRecords.campus}) = '' or lower(trim(${studentRecords.campus})) = 'unknown')`
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentRecords)
      .where(
        and(
          selectedWhere,
          sql`(${studentRecords.studentType} is null or trim(${studentRecords.studentType}) = '' or lower(trim(${studentRecords.studentType})) = 'unknown')`
        )
      )
  ]);

  const baselineRows = sortedWithAgg
    .filter((row) => row.datasetId !== selectedDataset.id)
    .slice(Math.max(0, selectedIndex - 3), selectedIndex);
  const baselineEnrollmentAvg =
    baselineRows.length > 0
      ? baselineRows.reduce((sum, row) => sum + row.totalStudents, 0) / baselineRows.length
      : null;
  const baselineGpaRows = baselineRows.map((row) => row.averageGpa).filter((v): v is number => v != null);
  const baselineGpaAvg =
    baselineGpaRows.length > 0
      ? baselineGpaRows.reduce((sum, value) => sum + value, 0) / baselineGpaRows.length
      : null;

  const forecastRows = sortedWithAgg.filter((row) => row.totalStudents > 0);
  const forecastCalc = linearForecast(forecastRows.map((row) => row.totalStudents));
  const latestLabel = forecastRows.length > 0 ? forecastRows[forecastRows.length - 1].semesterLabel : "Current Semester";

  return {
    selectedDatasetId: selectedDataset.id,
    alerts: {
      gpaRiskCount: toNumber(gpaRiskRows[0]?.count),
      enrollmentDeltaVsPrevious:
        prevAgg && selectedAgg ? selectedAgg.totalStudents - prevAgg.totalStudents : null,
      enrollmentDeltaPctVsPrevious:
        prevAgg && selectedAgg && prevAgg.totalStudents > 0
          ? (selectedAgg.totalStudents - prevAgg.totalStudents) / prevAgg.totalStudents
          : null,
      campusShiftHighlights
    },
    retention: {
      bySemester: sortedWithAgg.map((row) => ({
        datasetId: row.datasetId,
        semesterLabel: row.semesterLabel,
        returningCount: row.returningCount,
        newCount: row.newCount,
        returningPct:
          row.returningCount + row.newCount > 0
            ? row.returningCount / (row.returningCount + row.newCount)
            : null
      }))
    },
    cohortTracking: {
      cohortDatasetId: cohortBaseDataset?.id ?? null,
      cohortLabel: cohortBaseDataset?.semesterLabel ?? null,
      cohortSize,
      bySemester: sortedDatasets.map((dataset) => {
        const data = cohortByDataset.get(dataset.id);
        const persistedCount = data?.ids.size ?? 0;
        const avgGpa =
          data && data.gpas.length > 0
            ? data.gpas.reduce((sum, value) => sum + value, 0) / data.gpas.length
            : null;
        return {
          datasetId: dataset.id,
          semesterLabel: dataset.semesterLabel,
          persistedCount,
          persistenceRate: cohortSize > 0 ? persistedCount / cohortSize : null,
          averageGpa: avgGpa,
          campuses: Array.from(data?.campuses ?? [])
        };
      })
    },
    outcomes: {
      available: graduationIntentDistribution.length > 0,
      graduationIntentDistribution
    },
    dataQuality: {
      missingGpaCount: toNumber(missingGpaRows[0]?.count),
      duplicatePantherIdCount: toNumber(duplicatePantherRows[0]?.count),
      unknownCampusCount: toNumber(unknownCampusRows[0]?.count),
      unknownStudentTypeCount: toNumber(unknownTypeRows[0]?.count)
    },
    benchmark: {
      baselineSemesters: baselineRows.map((row) => row.semesterLabel),
      enrollmentVariance:
        baselineEnrollmentAvg != null && selectedAgg ? selectedAgg.totalStudents - baselineEnrollmentAvg : null,
      enrollmentVariancePct:
        baselineEnrollmentAvg && selectedAgg
          ? (selectedAgg.totalStudents - baselineEnrollmentAvg) / baselineEnrollmentAvg
          : null,
      averageGpaVariance:
        baselineGpaAvg != null && selectedAgg?.averageGpa != null
          ? selectedAgg.averageGpa - baselineGpaAvg
          : null
    },
    forecast: {
      nextSemesterLabel: inferNextSemesterLabel(latestLabel),
      projectedEnrollment: forecastCalc.projected,
      lowerBound: forecastCalc.lower,
      upperBound: forecastCalc.upper
    }
  };
}

export async function getStudentHistory(pantherId: string): Promise<StudentHistoryResponse | null> {
  const normalizedId = pantherId.trim();
  if (!normalizedId) return null;

  const rows = await db
    .select({
      datasetId: studentRecords.datasetId,
      semesterLabel: datasets.semesterLabel,
      createdAt: datasets.createdAt,
      pantherId: studentRecords.pantherId,
      firstName: studentRecords.firstName,
      lastName: studentRecords.lastName,
      fullName: studentRecords.fullName,
      gpa: studentRecords.gpa,
      campus: studentRecords.campus,
      majorDescription: studentRecords.majorDescription,
      classStanding: studentRecords.classStanding,
      studentType: studentRecords.studentType,
      raw: studentRecords.raw
    })
    .from(studentRecords)
    .innerJoin(datasets, eq(studentRecords.datasetId, datasets.id))
    .where(eq(studentRecords.pantherId, normalizedId))
    .orderBy(asc(datasets.createdAt));

  if (!rows.length) return null;

  const latest = rows[rows.length - 1];
  const first = latest.firstName?.trim() ?? "";
  const last = latest.lastName?.trim() ?? "";
  const fullName = [first, last].filter(Boolean).join(" ").trim() || latest.fullName || "Student";
  const raw = (latest.raw ?? {}) as Record<string, unknown>;

  return {
    pantherId: normalizedId,
    fullName,
    demographics: {
      gender: typeof raw.GENDER === "string" ? raw.GENDER : null,
      race: typeof raw.RACE_DESC === "string" ? raw.RACE_DESC : null,
      ethnicity: typeof raw.ETHNICITY === "string" ? raw.ETHNICITY : null,
      age: raw.AGE != null ? String(raw.AGE) : null
    },
    history: rows
      .sort((a, b) => semesterSortKey(a.semesterLabel, a.createdAt) - semesterSortKey(b.semesterLabel, b.createdAt))
      .map((row) => ({
        datasetId: row.datasetId,
        semesterLabel: row.semesterLabel,
        gpa: toNullableNumber(row.gpa),
        campus: row.campus,
        majorDescription: row.majorDescription,
        classStanding: row.classStanding,
        studentType: row.studentType
      }))
  };
}
