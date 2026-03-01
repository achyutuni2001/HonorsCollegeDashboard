export type DashboardFilters = {
  datasetId: string;
  campus?: string;
  majorDescription?: string;
  classStanding?: string;
  studentType?: string;
  gpaMin?: number;
  gpaMax?: number;
  excludeZeroGpa?: boolean;
  search?: string;
};

export type SummaryResponse = {
  dataset: {
    id: string;
    semesterLabel: string;
    rowCount: number;
    createdAt: string;
  };
  kpis: {
    totalEnrolledHonorsStudents: number;
    averageGpa: number | null;
    dualEnrollment: {
      count: number;
      percentage: number | null;
      available: boolean;
    };
    campusesRepresented: number;
  };
  charts: {
    studentsByCampus: Array<{ campus: string; count: number }>;
    averageGpaByCampus: Array<{ campus: string; averageGpa: number | null; count: number }>;
    studentsByStudentType: Array<{ studentType: string; count: number }>;
    classStandingByCampus: Array<{ campus: string; classStanding: string; count: number }>;
    gpaDistribution: Array<{ bucket: string; count: number }>;
    averageGpaByMajor: Array<{ majorDescription: string; averageGpa: number | null; count: number }>;
    genderDistribution: Array<{ gender: string; count: number }>;
    raceDistribution: Array<{ race: string; count: number }>;
    ethnicityDistribution: Array<{ ethnicity: string; count: number }>;
    ageDistribution: Array<{ ageBand: string; count: number }>;
  };
  filterOptions: {
    campuses: string[];
    majors: string[];
    classStandings: string[];
    studentTypes: string[];
    gpaMin: number;
    gpaMax: number;
  };
};

export type RecordsResponse = {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
  sort: {
    field: string;
    direction: "asc" | "desc";
  };
  rows: Array<{
    id: string;
    pantherId: string | null;
    firstName?: string | null;
    lastName?: string | null;
    fullName: string | null;
    gpa: number | null;
    majorDescription: string | null;
    campus: string | null;
  }>;
};

export type DatasetsResponse = Array<{
  id: string;
  semesterLabel: string;
  rowCount: number;
  createdAt: string;
}>;

export type SemesterTrendsResponse = {
  selectedDatasetId: string;
  rows: Array<{
    datasetId: string;
    semesterLabel: string;
    createdAt: string;
    totalStudents: number;
    averageGpa: number | null;
    campusesRepresented: number;
    dualEnrollmentCount: number;
    dualEnrollmentPct: number | null;
  }>;
  campusRows: Array<{
    datasetId: string;
    semesterLabel: string;
    createdAt: string;
    campus: string;
    totalStudents: number;
    averageGpa: number | null;
  }>;
};

export type StrategicInsightsResponse = {
  selectedDatasetId: string;
  alerts: {
    gpaRiskCount: number;
    enrollmentDeltaVsPrevious: number | null;
    enrollmentDeltaPctVsPrevious: number | null;
    campusShiftHighlights: Array<{
      campus: string;
      previous: number;
      current: number;
      delta: number;
    }>;
  };
  retention: {
    bySemester: Array<{
      datasetId: string;
      semesterLabel: string;
      returningCount: number;
      newCount: number;
      returningPct: number | null;
    }>;
  };
  cohortTracking: {
    cohortDatasetId: string | null;
    cohortLabel: string | null;
    cohortSize: number;
    bySemester: Array<{
      datasetId: string;
      semesterLabel: string;
      persistedCount: number;
      persistenceRate: number | null;
      averageGpa: number | null;
      campuses: string[];
    }>;
  };
  outcomes: {
    available: boolean;
    graduationIntentDistribution: Array<{ label: string; count: number }>;
  };
  dataQuality: {
    missingGpaCount: number;
    duplicatePantherIdCount: number;
    unknownCampusCount: number;
    unknownStudentTypeCount: number;
  };
  benchmark: {
    baselineSemesters: string[];
    enrollmentVariance: number | null;
    enrollmentVariancePct: number | null;
    averageGpaVariance: number | null;
  };
  forecast: {
    nextSemesterLabel: string;
    projectedEnrollment: number | null;
    lowerBound: number | null;
    upperBound: number | null;
  };
};

export type StudentHistoryResponse = {
  pantherId: string;
  fullName: string;
  demographics: {
    gender: string | null;
    race: string | null;
    ethnicity: string | null;
    age: string | null;
  };
  history: Array<{
    datasetId: string;
    semesterLabel: string;
    gpa: number | null;
    campus: string | null;
    majorDescription: string | null;
    classStanding: string | null;
    studentType: string | null;
  }>;
};

export type AuditEventsResponse = Array<{
  id: string;
  datasetId: string | null;
  action: "UPLOAD" | "RENAME" | "DELETE";
  actorName: string;
  actorRole: "admin" | "viewer";
  details: Record<string, unknown>;
  createdAt: string;
}>;
