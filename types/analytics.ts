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
};
