import {
  and,
  asc,
  desc,
  eq,
  isNotNull,
  sql
} from "drizzle-orm";
import { db } from "@/lib/db";
import { datasets, studentRecords } from "@/db/schema";
import {
  andAll,
  buildCrossDatasetFilterConditions,
  buildStudentFilterConditions
} from "@/lib/dashboard-filters";
import type {
  DashboardFilters,
  DatasetsResponse,
  RecordsResponse,
  SemesterTrendsResponse,
  SummaryResponse
} from "@/types/analytics";
import { logAuditEvent } from "@/lib/audit-service";

function sortAlpha(values: Array<string | null | undefined>) {
  return values
    .filter((v): v is string => Boolean(v && v.trim()))
    .sort((a, b) => a.localeCompare(b));
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = toNumber(value, Number.NaN);
  return Number.isFinite(n) ? n : null;
}

export async function listDatasets(): Promise<DatasetsResponse> {
  const rows = await db
    .select({
      id: datasets.id,
      semesterLabel: datasets.semesterLabel,
      rowCount: datasets.rowCount,
      createdAt: datasets.createdAt
    })
    .from(datasets)
    .orderBy(desc(datasets.createdAt));

  return rows.map((d) => ({
    id: d.id,
    semesterLabel: d.semesterLabel,
    rowCount: toNumber(d.rowCount),
    createdAt: new Date(d.createdAt).toISOString()
  }));
}

export async function deleteDatasetById(
  datasetId: string,
  actor?: { name: string; role: "admin" | "viewer" }
) {
  const existing = await db
    .select({
      id: datasets.id,
      semesterLabel: datasets.semesterLabel,
      rowCount: datasets.rowCount
    })
    .from(datasets)
    .where(eq(datasets.id, datasetId))
    .limit(1);

  if (!existing.length) {
    throw new Error("Dataset not found");
  }

  await db.delete(datasets).where(eq(datasets.id, datasetId));

  if (actor) {
    await logAuditEvent({
      datasetId,
      action: "DELETE",
      actorName: actor.name,
      actorRole: actor.role,
      details: {
        semesterLabel: existing[0].semesterLabel,
        rowCount: toNumber(existing[0].rowCount)
      }
    });
  }

  return {
    id: existing[0].id,
    semesterLabel: existing[0].semesterLabel,
    rowCount: toNumber(existing[0].rowCount)
  };
}

export async function renameDatasetById(
  datasetId: string,
  semesterLabel: string,
  actor?: { name: string; role: "admin" | "viewer" }
) {
  const nextLabel = semesterLabel.trim();
  if (!nextLabel) throw new Error("Semester label is required");

  const existing = await db
    .select({ id: datasets.id, semesterLabel: datasets.semesterLabel })
    .from(datasets)
    .where(eq(datasets.id, datasetId))
    .limit(1);

  if (!existing.length) {
    throw new Error("Dataset not found");
  }

  await db
    .update(datasets)
    .set({
      semesterLabel: nextLabel,
      updatedAt: new Date()
    })
    .where(eq(datasets.id, datasetId));

  if (actor) {
    await logAuditEvent({
      datasetId,
      action: "RENAME",
      actorName: actor.name,
      actorRole: actor.role,
      details: {
        previousSemesterLabel: existing[0].semesterLabel,
        nextSemesterLabel: nextLabel
      }
    });
  }

  return {
    id: datasetId,
    semesterLabel: nextLabel
  };
}

export async function getDashboardSummary(filters: DashboardFilters): Promise<SummaryResponse> {
  const [dataset] = await db
    .select({
      id: datasets.id,
      semesterLabel: datasets.semesterLabel,
      rowCount: datasets.rowCount,
      createdAt: datasets.createdAt
    })
    .from(datasets)
    .where(eq(datasets.id, filters.datasetId))
    .limit(1);

  if (!dataset) throw new Error("Dataset not found");

  const baseConditions = buildStudentFilterConditions(filters);
  const excludeAtlantaCampus = sql<boolean>`
    coalesce(lower(trim(${studentRecords.campus})), '') <> 'atlanta'
  `;
  const baseWhere = andAll([...baseConditions, excludeAtlantaCampus]);
  const datasetOnly = eq(studentRecords.datasetId, filters.datasetId);
  const datasetOnlyWhere = and(datasetOnly, excludeAtlantaCampus);
  const genderExpr = sql<string>`
    coalesce(nullif(trim(${studentRecords.raw} ->> 'GENDER'), ''), 'Unknown')
  `;
  const raceExpr = sql<string>`
    coalesce(nullif(trim(${studentRecords.raw} ->> 'RACE_DESC'), ''), 'Unknown')
  `;
  const ethnicityExpr = sql<string>`
    coalesce(nullif(trim(${studentRecords.raw} ->> 'ETHNICITY'), ''), 'Unknown')
  `;
  const ageBandExpr = sql<string>`
    CASE
      WHEN (${studentRecords.raw} ->> 'AGE') ~ '^[0-9]+$' THEN
        CASE
          WHEN ((${studentRecords.raw} ->> 'AGE')::int) < 18 THEN '<18'
          WHEN ((${studentRecords.raw} ->> 'AGE')::int) BETWEEN 18 AND 20 THEN '18-20'
          WHEN ((${studentRecords.raw} ->> 'AGE')::int) BETWEEN 21 AND 24 THEN '21-24'
          WHEN ((${studentRecords.raw} ->> 'AGE')::int) BETWEEN 25 AND 29 THEN '25-29'
          WHEN ((${studentRecords.raw} ->> 'AGE')::int) BETWEEN 30 AND 39 THEN '30-39'
          ELSE '40+'
        END
      ELSE 'Unknown'
    END
  `;
  const gpaBucket = sql<string>`
    CASE
      WHEN ${studentRecords.gpa} >= 0 AND ${studentRecords.gpa} < 1 THEN '0.00-0.99'
      WHEN ${studentRecords.gpa} >= 1 AND ${studentRecords.gpa} < 2 THEN '1.00-1.99'
      WHEN ${studentRecords.gpa} >= 2 AND ${studentRecords.gpa} < 2.5 THEN '2.00-2.49'
      WHEN ${studentRecords.gpa} >= 2.5 AND ${studentRecords.gpa} < 3 THEN '2.50-2.99'
      WHEN ${studentRecords.gpa} >= 3 AND ${studentRecords.gpa} < 3.5 THEN '3.00-3.49'
      WHEN ${studentRecords.gpa} >= 3.5 THEN '3.50-4.50'
      ELSE NULL
    END
  `;

  const [
    totalCountRows,
    avgRows,
    campusesDistinctFiltered,
    byCampusRows,
    byCampusPerformanceRows,
    byStudentTypeRows,
    byCampusStandingRows,
    majorAggRows,
    gpaDistRows,
    dualAvailableRows,
    dualCountRows,
    filterCampusRows,
    filterMajorRows,
    filterStandingRows,
    filterTypeRows,
    filterGpaRows,
    genderRows,
    raceRows,
    ethnicityRows,
    ageRows
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentRecords)
      .where(baseWhere),
    db
      .select({ averageGpa: sql<number | null>`avg(${studentRecords.gpa})::float` })
      .from(studentRecords)
      .where(baseWhere),
    db
      .selectDistinct({ campus: studentRecords.campus })
      .from(studentRecords)
      .where(baseWhere),
    db
      .select({
        campus: studentRecords.campus,
        count: sql<number>`count(*)::int`
      })
      .from(studentRecords)
      .where(baseWhere)
      .groupBy(studentRecords.campus)
      .orderBy(sql`count(*) DESC`),
    db
      .select({
        campus: studentRecords.campus,
        averageGpa: sql<number | null>`avg(${studentRecords.gpa})::float`,
        count: sql<number>`count(*)::int`
      })
      .from(studentRecords)
      .where(baseWhere)
      .groupBy(studentRecords.campus)
      .orderBy(sql`avg(${studentRecords.gpa}) DESC`),
    db
      .select({
        studentType: studentRecords.studentType,
        count: sql<number>`count(*)::int`
      })
      .from(studentRecords)
      .where(baseWhere)
      .groupBy(studentRecords.studentType)
      .orderBy(sql`count(*) DESC`),
    db
      .select({
        campus: studentRecords.campus,
        classStanding: studentRecords.classStanding,
        count: sql<number>`count(*)::int`
      })
      .from(studentRecords)
      .where(baseWhere)
      .groupBy(studentRecords.campus, studentRecords.classStanding),
    db
      .select({
        majorDescription: studentRecords.majorDescription,
        averageGpa: sql<number | null>`avg(${studentRecords.gpa})::float`,
        count: sql<number>`count(*)::int`
      })
      .from(studentRecords)
      .where(and(baseWhere, isNotNull(studentRecords.majorDescription)))
      .groupBy(studentRecords.majorDescription)
      .orderBy(sql`count(*) DESC`),
    db
      .select({
        bucket: gpaBucket,
        count: sql<number>`count(*)::int`
      })
      .from(studentRecords)
      .where(and(baseWhere, isNotNull(studentRecords.gpa)))
      .groupBy(gpaBucket),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentRecords)
      .where(and(datasetOnlyWhere, isNotNull(studentRecords.dualEnrollment))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentRecords)
      .where(and(baseWhere, eq(studentRecords.dualEnrollment, true))),
    db
      .selectDistinct({ campus: studentRecords.campus })
      .from(studentRecords)
      .where(datasetOnlyWhere),
    db
      .selectDistinct({ majorDescription: studentRecords.majorDescription })
      .from(studentRecords)
      .where(datasetOnlyWhere),
    db
      .selectDistinct({ classStanding: studentRecords.classStanding })
      .from(studentRecords)
      .where(datasetOnlyWhere),
    db
      .selectDistinct({ studentType: studentRecords.studentType })
      .from(studentRecords)
      .where(datasetOnlyWhere),
    db
      .select({
        minGpa: sql<number | null>`min(${studentRecords.gpa})::float`,
        maxGpa: sql<number | null>`max(${studentRecords.gpa})::float`
      })
      .from(studentRecords)
      .where(datasetOnlyWhere),
    db
      .select({
        gender: genderExpr,
        count: sql<number>`count(*)::int`
      })
      .from(studentRecords)
      .where(baseWhere)
      .groupBy(genderExpr)
      .orderBy(sql`count(*) DESC`),
    db
      .select({
        race: raceExpr,
        count: sql<number>`count(*)::int`
      })
      .from(studentRecords)
      .where(baseWhere)
      .groupBy(raceExpr)
      .orderBy(sql`count(*) DESC`),
    db
      .select({
        ethnicity: ethnicityExpr,
        count: sql<number>`count(*)::int`
      })
      .from(studentRecords)
      .where(baseWhere)
      .groupBy(ethnicityExpr)
      .orderBy(sql`count(*) DESC`),
    db
      .select({
        ageBand: ageBandExpr,
        count: sql<number>`count(*)::int`
      })
      .from(studentRecords)
      .where(baseWhere)
      .groupBy(ageBandExpr)
      .orderBy(sql`count(*) DESC`)
  ]);

  const totalCount = toNumber(totalCountRows[0]?.count);
  const averageGpa = toNullableNumber(avgRows[0]?.averageGpa);
  const dualAvailableCount = toNumber(dualAvailableRows[0]?.count);
  const dualCount = toNumber(dualCountRows[0]?.count);

  const gpaBucketMap = new Map<string, number>();
  for (const row of gpaDistRows) {
    if (!row.bucket) continue;
    gpaBucketMap.set(String(row.bucket), toNumber(row.count));
  }

  const gpaBucketsOrder = [
    "0.00-0.99",
    "1.00-1.99",
    "2.00-2.49",
    "2.50-2.99",
    "3.00-3.49",
    "3.50-4.50"
  ];

  const filterGpa = filterGpaRows[0] ?? { minGpa: null, maxGpa: null };
  const ageBandOrder = ["<18", "18-20", "21-24", "25-29", "30-39", "40+", "Unknown"];
  const ageBandMap = new Map(ageRows.map((row) => [String(row.ageBand), toNumber(row.count)]));

  return {
    dataset: {
      id: dataset.id,
      semesterLabel: dataset.semesterLabel,
      rowCount: toNumber(dataset.rowCount),
      createdAt: new Date(dataset.createdAt).toISOString()
    },
    kpis: {
      totalEnrolledHonorsStudents: totalCount,
      averageGpa,
      dualEnrollment: {
        count: dualCount,
        percentage: totalCount > 0 ? dualCount / totalCount : null,
        available: dualAvailableCount > 0
      },
      campusesRepresented: campusesDistinctFiltered.filter((r) => r.campus).length
    },
    charts: {
      studentsByCampus: byCampusRows.map((row) => ({
        campus: row.campus ?? "Unknown",
        count: toNumber(row.count)
      })),
      averageGpaByCampus: byCampusPerformanceRows.map((row) => ({
        campus: row.campus ?? "Unknown",
        averageGpa: toNullableNumber(row.averageGpa),
        count: toNumber(row.count)
      })),
      studentsByStudentType: byStudentTypeRows.map((row) => ({
        studentType: row.studentType ?? "Unknown",
        count: toNumber(row.count)
      })),
      classStandingByCampus: byCampusStandingRows.map((row) => ({
        campus: row.campus ?? "Unknown",
        classStanding: row.classStanding ?? "Unknown",
        count: toNumber(row.count)
      })),
      gpaDistribution: gpaBucketsOrder.map((bucket) => ({
        bucket,
        count: gpaBucketMap.get(bucket) ?? 0
      })),
      averageGpaByMajor: majorAggRows.map((row) => ({
        majorDescription: row.majorDescription ?? "Unknown",
        averageGpa: toNullableNumber(row.averageGpa),
        count: toNumber(row.count)
      })),
      genderDistribution: genderRows.map((row) => ({
        gender: String(row.gender || "Unknown"),
        count: toNumber(row.count)
      })),
      raceDistribution: raceRows.slice(0, 10).map((row) => ({
        race: String(row.race || "Unknown"),
        count: toNumber(row.count)
      })),
      ethnicityDistribution: ethnicityRows.slice(0, 8).map((row) => ({
        ethnicity: String(row.ethnicity || "Unknown"),
        count: toNumber(row.count)
      })),
      ageDistribution: ageBandOrder
        .filter((ageBand) => ageBandMap.has(ageBand))
        .map((ageBand) => ({
          ageBand,
          count: ageBandMap.get(ageBand) ?? 0
        }))
    },
    filterOptions: {
      campuses: sortAlpha(filterCampusRows.map((r) => r.campus)),
      majors: sortAlpha(filterMajorRows.map((r) => r.majorDescription)),
      classStandings: sortAlpha(filterStandingRows.map((r) => r.classStanding)),
      studentTypes: sortAlpha(filterTypeRows.map((r) => r.studentType)),
      gpaMin: toNullableNumber(filterGpa.minGpa) ?? 0,
      gpaMax: toNullableNumber(filterGpa.maxGpa) ?? 4
    }
  };
}

export async function getSemesterTrends(
  filters: DashboardFilters
): Promise<SemesterTrendsResponse> {
  const datasetFilterRows = await db
    .select({ id: datasets.id })
    .from(datasets)
    .where(eq(datasets.id, filters.datasetId))
    .limit(1);
  if (!datasetFilterRows.length) throw new Error("Dataset not found");

  const excludeAtlantaCampus = sql<boolean>`
    coalesce(lower(trim(${studentRecords.campus})), '') <> 'atlanta'
  `;
  const crossWhere = andAll([
    ...buildCrossDatasetFilterConditions(filters),
    excludeAtlantaCampus
  ]);

  const [datasetRows, aggRows, campusAggRows] = await Promise.all([
    db
      .select({
        id: datasets.id,
        semesterLabel: datasets.semesterLabel,
        createdAt: datasets.createdAt
      })
      .from(datasets)
      .orderBy(asc(datasets.createdAt)),
    db
      .select({
        datasetId: studentRecords.datasetId,
        totalStudents: sql<number>`count(*)::int`,
        averageGpa: sql<number | null>`avg(${studentRecords.gpa})::float`,
        campusesRepresented:
          sql<number>`count(distinct nullif(${studentRecords.campus}, ''))::int`,
        dualEnrollmentCount:
          sql<number>`sum(case when ${studentRecords.dualEnrollment} = true then 1 else 0 end)::int`,
        dualEnrollmentAvailableCount:
          sql<number>`sum(case when ${studentRecords.dualEnrollment} is not null then 1 else 0 end)::int`
      })
      .from(studentRecords)
      .where(crossWhere)
      .groupBy(studentRecords.datasetId),
    db
      .select({
        datasetId: studentRecords.datasetId,
        campus: studentRecords.campus,
        totalStudents: sql<number>`count(*)::int`,
        averageGpa: sql<number | null>`avg(${studentRecords.gpa})::float`
      })
      .from(studentRecords)
      .where(crossWhere)
      .groupBy(studentRecords.datasetId, studentRecords.campus)
  ]);

  const aggByDataset = new Map(
    aggRows.map((row) => [
      row.datasetId,
      {
        totalStudents: toNumber(row.totalStudents),
        averageGpa: toNullableNumber(row.averageGpa),
        campusesRepresented: toNumber(row.campusesRepresented),
        dualEnrollmentCount: toNumber(row.dualEnrollmentCount),
        dualEnrollmentAvailableCount: toNumber(row.dualEnrollmentAvailableCount)
      }
    ])
  );

  const datasetMeta = new Map(
    datasetRows.map((row) => [
      row.id,
      {
        semesterLabel: row.semesterLabel,
        createdAt: new Date(row.createdAt).toISOString()
      }
    ])
  );

  return {
    selectedDatasetId: filters.datasetId,
    rows: datasetRows.map((datasetRow) => {
      const agg = aggByDataset.get(datasetRow.id);
      const dualPct =
        agg && agg.dualEnrollmentAvailableCount > 0
          ? agg.dualEnrollmentCount / agg.totalStudents
          : null;
      return {
        datasetId: datasetRow.id,
        semesterLabel: datasetRow.semesterLabel,
        createdAt: new Date(datasetRow.createdAt).toISOString(),
        totalStudents: agg?.totalStudents ?? 0,
        averageGpa: agg?.averageGpa ?? null,
        campusesRepresented: agg?.campusesRepresented ?? 0,
        dualEnrollmentCount: agg?.dualEnrollmentCount ?? 0,
        dualEnrollmentPct: dualPct
      };
    }),
    campusRows: campusAggRows
      .map((row) => {
        const meta = datasetMeta.get(row.datasetId);
        if (!meta) return null;
        return {
          datasetId: row.datasetId,
          semesterLabel: meta.semesterLabel,
          createdAt: meta.createdAt,
          campus: row.campus?.trim() ? row.campus : "Unknown",
          totalStudents: toNumber(row.totalStudents),
          averageGpa: toNullableNumber(row.averageGpa)
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
  };
}

type RecordsQuery = DashboardFilters & {
  page: number;
  pageSize: number;
  sortField: string;
  sortDirection: "asc" | "desc";
};

type RecordsExportQuery = DashboardFilters & {
  sortField: string;
  sortDirection: "asc" | "desc";
};

const sortableFields = {
  pantherId: studentRecords.pantherId,
  fullName: studentRecords.fullName,
  gpa: studentRecords.gpa,
  majorDescription: studentRecords.majorDescription,
  campus: studentRecords.campus
} as const;

export async function getDashboardRecords(query: RecordsQuery): Promise<RecordsResponse> {
  const conditions = buildStudentFilterConditions(query);
  const where = andAll(conditions);

  const page = Math.max(1, query.page);
  const pageSize = Math.min(100, Math.max(10, query.pageSize));
  const sortField = query.sortField in sortableFields ? query.sortField : "gpa";
  const direction = query.sortDirection === "asc" ? "asc" : "desc";
  const sortColumn = sortableFields[sortField as keyof typeof sortableFields];

  const [countRows, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentRecords)
      .where(where),
    db
      .select({
        id: studentRecords.id,
        pantherId: studentRecords.pantherId,
        fullName: studentRecords.fullName,
        gpa: studentRecords.gpa,
        majorDescription: studentRecords.majorDescription,
        campus: studentRecords.campus
      })
      .from(studentRecords)
      .where(where)
      .orderBy(direction === "asc" ? asc(sortColumn) : desc(sortColumn), asc(studentRecords.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
  ]);

  const total = toNumber(countRows[0]?.count);

  return {
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize))
    },
    sort: {
      field: sortField,
      direction
    },
    rows: rows.map((row) => ({
      id: String(row.id),
      pantherId: row.pantherId,
      fullName: row.fullName,
      gpa: toNullableNumber(row.gpa),
      majorDescription: row.majorDescription,
      campus: row.campus
    }))
  };
}

export async function getDashboardRecordsForExport(query: RecordsExportQuery) {
  const conditions = buildStudentFilterConditions(query);
  const where = andAll(conditions);

  const sortField = query.sortField in sortableFields ? query.sortField : "gpa";
  const direction = query.sortDirection === "asc" ? "asc" : "desc";
  const sortColumn = sortableFields[sortField as keyof typeof sortableFields];

  const rows = await db
    .select({
      id: studentRecords.id,
      pantherId: studentRecords.pantherId,
      firstName: studentRecords.firstName,
      lastName: studentRecords.lastName,
      fullName: studentRecords.fullName,
      gpa: studentRecords.gpa,
      majorDescription: studentRecords.majorDescription,
      campus: studentRecords.campus,
      classStanding: studentRecords.classStanding,
      studentType: studentRecords.studentType
    })
    .from(studentRecords)
    .where(where)
    .orderBy(direction === "asc" ? asc(sortColumn) : desc(sortColumn), asc(studentRecords.id));

  return rows.map((row) => ({
    id: String(row.id),
    pantherId: row.pantherId,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    gpa: toNullableNumber(row.gpa),
    majorDescription: row.majorDescription,
    campus: row.campus,
    classStanding: row.classStanding,
    studentType: row.studentType
  }));
}
