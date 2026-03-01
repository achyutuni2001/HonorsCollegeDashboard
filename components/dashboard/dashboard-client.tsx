"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { Search, Upload, RefreshCw, X, Sun, Moon, Trash2, Pencil, Settings, Loader2, Eye } from "lucide-react";
import type {
  DatasetsResponse,
  RecordsResponse,
  SemesterTrendsResponse,
  SummaryResponse
} from "@/types/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RangeSlider } from "@/components/ui/range-slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  formatCampusName,
  formatClassStanding,
  formatGpa,
  formatNumber,
  formatPercent,
  formatSemesterLabel
} from "@/lib/utils";
import {
  AgeDistributionBarChart,
  AvgGpaByMajorChart,
  CampusBarChart,
  CampusPerformanceChart,
  CategoryDonutChart,
  ChartCard,
  ClassStandingStackedChart,
  ForecastLineChart,
  GpaDistributionChart,
  HorizontalCategoryBarChart,
  SemesterComparisonBarChart,
  SemesterEnrollmentTrendChart,
  SemesterMetricLineChart,
  StudentTypeDonutChart
} from "@/components/dashboard/charts";
import { useDashboardFilterStore } from "@/stores/dashboard-filters";
import { useShallow } from "zustand/react/shallow";
import { authClient } from "@/lib/auth-client";

type DatasetItem = DatasetsResponse[number];
type DashboardSection =
  | "overview"
  | "academic"
  | "demographics"
  | "trends"
  | "strategic"
  | "semesters";

type FiltersState = {
  datasetId: string;
  campus?: string;
  majorDescription?: string;
  classStanding?: string;
  studentType?: string;
  gpaRange: [number, number];
  excludeZeroGpa: boolean;
};

type RecordsState = {
  page: number;
  pageSize: number;
  sortField: string;
  sortDirection: "asc" | "desc";
  search: string;
};

type AccessUser = {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: boolean;
  image: string | null;
  role: "admin" | "viewer";
  roleSource: "explicit" | "default";
  createdAt: string;
  updatedAt: string;
};

function buildQuery(filters: FiltersState, records?: RecordsState) {
  const params = new URLSearchParams();
  params.set("datasetId", filters.datasetId);
  if (filters.campus) params.set("campus", filters.campus);
  if (filters.majorDescription) params.set("majorDescription", filters.majorDescription);
  if (filters.classStanding) params.set("classStanding", filters.classStanding);
  if (filters.studentType) params.set("studentType", filters.studentType);
  params.set("gpaMin", filters.gpaRange[0].toFixed(2));
  params.set("gpaMax", filters.gpaRange[1].toFixed(2));
  if (filters.excludeZeroGpa) params.set("excludeZeroGpa", "true");
  if (records) {
    params.set("page", String(records.page));
    params.set("pageSize", String(records.pageSize));
    params.set("sortField", records.sortField);
    params.set("sortDirection", records.sortDirection);
    if (records.search.trim()) params.set("search", records.search.trim());
  }
  return params.toString();
}

function defaultRecordsState(): RecordsState {
  return {
    page: 1,
    pageSize: 25,
    sortField: "gpa",
    sortDirection: "desc",
    search: ""
  };
}

const GPA_BUCKETS: Array<{ key: string; range: [number, number] }> = [
  { key: "0.00-0.99", range: [0, 0.99] },
  { key: "1.00-1.99", range: [1, 1.99] },
  { key: "2.00-2.49", range: [2, 2.49] },
  { key: "2.50-2.99", range: [2.5, 2.99] },
  { key: "3.00-3.49", range: [3, 3.49] },
  { key: "3.50-4.50", range: [3.5, 4.5] }
];

function rangesEqual(a: [number, number], b: [number, number]) {
  return Math.abs(a[0] - b[0]) < 0.001 && Math.abs(a[1] - b[1]) < 0.001;
}

function getBucketRange(bucket: string): [number, number] | null {
  return GPA_BUCKETS.find((b) => b.key === bucket)?.range ?? null;
}

function getSelectedGpaBucket(
  selectedRange: [number, number],
  datasetRange?: [number, number]
): string | undefined {
  if (!datasetRange || rangesEqual(selectedRange, datasetRange)) return undefined;
  return GPA_BUCKETS.find((b) => rangesEqual(selectedRange, b.range))?.key;
}

function formatPantherIdDisplay(value: string | null | undefined) {
  if (!value) return "—";
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  return trimmed.padStart(9, "0");
}

function getUserInitials(name?: string | null, email?: string | null) {
  const source = (name?.trim() || email?.trim() || "User").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function sectionTitle(section: DashboardSection) {
  if (section === "academic") return "Academic";
  if (section === "demographics") return "Demographics";
  if (section === "trends") return "Trends";
  if (section === "strategic") return "Strategic";
  if (section === "semesters") return "Semesters";
  return "Overview";
}

function getSectionPath(section: DashboardSection) {
  if (section === "overview") return "/dashboard";
  if (section === "academic") return "/dashboard/academic";
  if (section === "demographics") return "/dashboard/demographics";
  if (section === "trends") return "/dashboard/trends";
  if (section === "strategic") return "/dashboard/strategic";
  return "/dashboard/semesters";
}

function getSemesterSortKey(label: string, createdAt?: string) {
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

  if (Number.isFinite(year)) {
    return year * 10 + termOrder;
  }
  return createdAt ? new Date(createdAt).getTime() : Number.MAX_SAFE_INTEGER;
}

function nextSemesterLabel(label: string) {
  const trimmed = label.trim();
  const match = trimmed.match(/(spring|summer|fall|winter)[-\s]?(\d{4})/i);
  if (!match) return `Next (${trimmed})`;

  const term = match[1].toLowerCase();
  const year = Number(match[2]);
  if (!Number.isFinite(year)) return `Next (${trimmed})`;

  if (term === "spring") return `Summer-${year}`;
  if (term === "summer") return `Fall-${year}`;
  if (term === "fall") return `Spring-${year + 1}`;
  return `Spring-${year}`;
}

function linearForecast(values: number[]) {
  const n = values.length;
  if (n < 2) return null;

  const xs = values.map((_, index) => index + 1);
  const meanX = xs.reduce((sum, x) => sum + x, 0) / n;
  const meanY = values.reduce((sum, y) => sum + y, 0) / n;
  const varX = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  if (varX === 0) return null;

  const covXY = xs.reduce((sum, x, i) => sum + (x - meanX) * (values[i] - meanY), 0);
  const slope = covXY / varX;
  const intercept = meanY - slope * meanX;
  const nextX = n + 1;
  const projected = intercept + slope * nextX;
  const residualMse =
    values.reduce((sum, y, i) => {
      const predicted = intercept + slope * xs[i];
      return sum + (y - predicted) ** 2;
    }, 0) / Math.max(1, n - 2);
  const residualStdDev = Math.sqrt(Math.max(0, residualMse));

  return { projected, slope, residualStdDev };
}

function KpiCard({
  label,
  value,
  subtext,
  tone = "blue"
}: {
  label: string;
  value: string;
  subtext?: string;
  tone?: "blue" | "teal" | "amber" | "violet";
}) {
  const toneStyles =
    tone === "teal"
      ? "border-teal-200 bg-gradient-to-br from-teal-50 to-white"
      : tone === "amber"
        ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white"
        : tone === "violet"
          ? "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white"
          : "border-blue-200 bg-gradient-to-br from-blue-50 to-white";
  const valueStyles =
    tone === "teal"
      ? "text-teal-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "violet"
          ? "text-indigo-700"
          : "text-blue-700";
  return (
    <Card className={`tile-glow ${toneStyles}`}>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-2 text-2xl font-semibold ${valueStyles}`}>{value}</div>
        {subtext ? <div className="mt-1 text-xs text-muted-foreground">{subtext}</div> : null}
      </CardContent>
    </Card>
  );
}

function LoadingCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-40 animate-pulse rounded-lg bg-secondary" />
      </CardContent>
    </Card>
  );
}

function SectionSwitchLoader({ target }: { target: string }) {
  return (
    <div className="relative flex flex-col items-center justify-center gap-5 rounded-2xl border border-blue-100/80 bg-white/70 px-10 py-12 backdrop-blur-sm">
      <div className="absolute inset-0 -z-10 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_55%)]" />
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-500 border-r-cyan-400" />
        <div className="absolute inset-[10px] animate-spin rounded-full border-4 border-transparent border-b-teal-400 border-l-blue-300 [animation-direction:reverse] [animation-duration:1.4s]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-3 w-3 animate-ping rounded-full bg-blue-500" />
        </div>
      </div>
      <div className="space-y-1 text-center">
        <p className="text-sm font-semibold text-slate-700">Loading {target}...</p>
        <p className="text-xs text-muted-foreground">
          Updating dashboard components for your selection
        </p>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  onClear
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary"
    >
      {label}
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

function ThemeToggle({
  theme,
  onToggle
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative ml-auto inline-flex h-10 w-[90px] items-center rounded-full border border-slate-300 bg-white/80 p-1 shadow-sm transition dark:border-slate-700 dark:bg-slate-900"
    >
      <span
        className={`absolute top-1 h-8 w-[40px] rounded-full bg-primary transition-transform ${
          dark ? "translate-x-[40px]" : "translate-x-0"
        }`}
      />
      <span className="relative z-10 flex w-full items-center justify-between px-2">
        <Sun className={`h-4 w-4 ${dark ? "text-slate-400" : "text-white"}`} />
        <Moon className={`h-4 w-4 ${dark ? "text-white" : "text-slate-400"}`} />
      </span>
    </button>
  );
}

function FilePickerControl({
  inputRef,
  inputId,
  inputName,
  selectedFileName,
  onFileChange,
  buttonLabel
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  inputId?: string;
  inputName: string;
  selectedFileName: string;
  onFileChange: () => void;
  buttonLabel: string;
}) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-md border bg-background px-2">
      <input
        ref={inputRef}
        id={inputId}
        name={inputName}
        type="file"
        accept=".csv,.xls,.xlsx"
        onChange={onFileChange}
        className="sr-only"
      />
      <Button
        type="button"
        variant="outline"
        className="h-8 shrink-0 px-3"
        onClick={() => inputRef.current?.click()}
      >
        {buttonLabel}
      </Button>
      <span className="min-w-0 truncate text-sm text-muted-foreground">
        {selectedFileName || "No file selected"}
      </span>
    </div>
  );
}

function DashboardModal({
  open,
  title,
  description,
  children,
  footer,
  onClose
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative z-[101] w-full max-w-lg rounded-2xl border bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b px-5 py-4 dark:border-slate-700">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children ? <div className="px-5 py-4">{children}</div> : null}
        <div className="flex justify-end gap-2 border-t px-5 py-4 dark:border-slate-700">
          {footer}
        </div>
      </div>
    </div>
  );
}

function InstitutionalHeader({
  canManageAccess,
  userName,
  userEmail,
  userImage,
  onLogout,
  theme,
  onToggleTheme,
  onOpenAccessSettings
}: {
  canManageAccess: boolean;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  onLogout: () => Promise<void> | void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenAccessSettings: () => void;
}) {
  const profileInitials = getUserInitials(userName, userEmail);
  return (
    <header className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex min-h-14 items-center justify-between border-b px-4 py-2 dark:border-slate-700 md:px-5">
        <div className="flex w-full min-h-12 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-md border bg-white dark:border-slate-700 dark:bg-slate-900">
              <img
                src="/gsu-logo.png"
                alt="Georgia State University logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Georgia State University
            </div>
            <div className="text-sm font-medium tracking-wide text-[#0f43ad] dark:text-blue-300">
              Perimeter Honors College
            </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <div className="text-right">
              <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                {userEmail || "Signed in"}
              </div>
            </div>
            <span
              className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-2 ring-slate-200/80 dark:ring-slate-600/80"
              title={userName || userEmail || "Profile"}
              aria-label="Signed in profile"
            >
              {userImage ? (
                <img src={userImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                  {profileInitials}
                </span>
              )}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={onLogout}>
              Log out
            </Button>
            {canManageAccess ? (
              <Button type="button" variant="outline" size="sm" onClick={onOpenAccessSettings}>
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Access
              </Button>
            ) : null}
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-b bg-[#f4f5f7] px-4 py-3 dark:border-slate-700 dark:bg-slate-800 md:grid-cols-[170px_1fr] md:px-5">
        <div className="grid gap-3 md:col-span-2 md:grid-cols-[220px_1fr]">
          <div className="flex items-center justify-center rounded-lg border bg-white/60 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50 md:justify-start">
            <div className="text-left">
              <div className="text-2xl font-light leading-tight tracking-tight text-neutral-700 dark:text-slate-100 md:text-3xl">
                Honors
                <br />
                College
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Analytics Dashboard
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border bg-black/5 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="relative h-[92px] w-full md:h-[110px]">
              <img
                src="/gsu-cover-photo.jpg"
                alt="Georgia State University Atlanta skyline banner"
                className="block h-full w-full object-cover object-center"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 md:col-span-2 md:hidden">
            <span
              className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-2 ring-slate-200/80 dark:ring-slate-600/80"
              title={userName || userEmail || "Profile"}
              aria-label="Signed in profile"
            >
              {userImage ? (
                <img src={userImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                  {profileInitials}
                </span>
              )}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={onLogout}>
              Log out
            </Button>
            {canManageAccess ? (
              <Button type="button" variant="outline" size="sm" onClick={onOpenAccessSettings}>
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Access
              </Button>
            ) : null}
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>
      </div>

      <div className="bg-[#0f43ad] px-4 py-2 dark:bg-slate-950 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-white">
          <div className="text-sm font-semibold tracking-tight">
            Honors College Overview Dashboard
          </div>
        </div>
      </div>
    </header>
  );
}

export function DashboardClient({
  initialDatasets,
  initialDatasetId,
  initialUserRole = "viewer",
  section = "overview"
}: {
  initialDatasets: DatasetsResponse;
  initialDatasetId: string | null;
  initialUserRole?: "admin" | "viewer";
  section?: DashboardSection;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [datasets, setDatasets] = useState<DatasetItem[]>(initialDatasets);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [records, setRecords] = useState<RecordsResponse | null>(null);
  const [semesterTrends, setSemesterTrends] = useState<SemesterTrendsResponse | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [semesterTrendsError, setSemesterTrendsError] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);
  const [isSemesterTrendsLoading, setIsSemesterTrendsLoading] = useState(false);
  const [isExportingRecords, setIsExportingRecords] = useState(false);
  const [isUploading, startUploadTransition] = useTransition();
  const [showAllMajors, setShowAllMajors] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hasInitFile, setHasInitFile] = useState(false);
  const [initFileName, setInitFileName] = useState("");
  const [isDeletingDataset, setIsDeletingDataset] = useState(false);
  const [isRenamingDataset, setIsRenamingDataset] = useState(false);
  const [showDeleteDatasetModal, setShowDeleteDatasetModal] = useState(false);
  const [showRenameDatasetModal, setShowRenameDatasetModal] = useState(false);
  const [showDeleteSemesterRowModal, setShowDeleteSemesterRowModal] = useState(false);
  const [showAccessSettingsModal, setShowAccessSettingsModal] = useState(false);
  const [renameDatasetDraft, setRenameDatasetDraft] = useState("");
  const [semesterToDelete, setSemesterToDelete] = useState<DatasetItem | null>(null);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [isAccessUsersLoading, setIsAccessUsersLoading] = useState(false);
  const [isUpdatingAccessRole, setIsUpdatingAccessRole] = useState<string | null>(null);
  const [accessUsersError, setAccessUsersError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<DashboardSection>(section);
  const [isSectionSwitching, setIsSectionSwitching] = useState(false);
  const [pendingSection, setPendingSection] = useState<DashboardSection | null>(null);
  const [selectedTrendCampus, setSelectedTrendCampus] = useState<string | undefined>(undefined);
  const gpaRangeSeededDatasetRef = useRef<string | null>(null);
  const sectionSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerUploadInputRef = useRef<HTMLInputElement>(null);
  const initFileInputRef = useRef<HTMLInputElement>(null);
  const filters = useDashboardFilterStore(
    useShallow((state) => ({
      datasetId: state.datasetId,
      campus: state.campus,
      majorDescription: state.majorDescription,
      classStanding: state.classStanding,
      studentType: state.studentType,
      gpaRange: state.gpaRange,
      excludeZeroGpa: state.excludeZeroGpa
    }))
  );
  const setFilterPartial = useDashboardFilterStore((state) => state.setPartial);
  const setDatasetFilter = useDashboardFilterStore((state) => state.setDataset);
  const toggleCategorical = useDashboardFilterStore((state) => state.toggleCategorical);
  const clearStoreFilters = useDashboardFilterStore((state) => state.clearFilters);
  const [recordsState, setRecordsState] = useState<RecordsState>(defaultRecordsState);
  const { data: session } = authClient.useSession();

  const selectedDataset = datasets.find((d) => d.id === filters.datasetId) ?? null;
  const isOverview = activeSection === "overview";
  const isAcademic = activeSection === "academic";
  const isDemographics = activeSection === "demographics";
  const isTrends = activeSection === "trends";
  const isStrategic = activeSection === "strategic";
  const isSemesters = activeSection === "semesters";
  const canManageData = initialUserRole === "admin";
  const canManageAccess = initialUserRole === "admin";
  const sectionNavItems: Array<{ key: DashboardSection; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "academic", label: "Academic" },
    { key: "demographics", label: "Demographics" },
    { key: "trends", label: "Trends" },
    { key: "strategic", label: "Forecasting" }
  ];
  const chartDescriptionsBySection: Record<DashboardSection, string[]> = {
    overview: [
      "Students by Campus: distribution of honors students by campus.",
      "Students by Student Type: proportion of student categories.",
      "Class Standing Distribution by Campus: class-level mix across campuses."
    ],
    academic: [
      "GPA Distribution: count of students by GPA bucket.",
      "Average GPA by Major: average GPA and volume by major.",
      "Academic Profile Records: filtered table used for detailed review."
    ],
    demographics: [
      "Gender Distribution: gender composition of the selected cohort.",
      "Ethnicity Distribution: ethnicity mix under current filters.",
      "Race Distribution (Top 10): largest race groups by count.",
      "Age Distribution: student counts across age bands."
    ],
    trends: [
      "Enrollment Across Semesters: total roster trend by semester.",
      "Average GPA Across Semesters: GPA trend by semester.",
      "Campuses and Dual Enrollment by Semester: campus coverage and DE share.",
      "Campus Performance Snapshot: enrollment and average GPA by campus.",
      "Campus Enrollment Distribution: compare student counts across campuses.",
      "Most Selected Courses (Majors): top majors by enrollment volume.",
      "Campus Enrollment Across Semesters: enrollment trend for selected campus.",
      "Campus Average GPA Across Semesters: GPA trend for selected campus."
    ],
    strategic: [
      "Enrollment Forecast: historical enrollment with next-semester projection.",
      "GPA Forecast: historical average GPA with projected next-semester value.",
      "Strategic Signals: planning metrics summarizing direction and uncertainty."
    ],
    semesters: [
      "Uploaded Semesters: complete list of uploaded semester files and metadata.",
      "Delete Controls: admin-only permanent delete action with confirmation warning."
    ]
  };

  useEffect(() => {
    setActiveSection(section);
  }, [section]);

  useEffect(() => {
    return () => {
      if (sectionSwitchTimeoutRef.current) {
        clearTimeout(sectionSwitchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const hasValidSelection =
      Boolean(filters.datasetId) && datasets.some((d) => d.id === filters.datasetId);
    if (hasValidSelection) return;
    const seededId =
      (initialDatasetId && datasets.some((d) => d.id === initialDatasetId) ? initialDatasetId : null) ??
      datasets[0]?.id;
    if (seededId) {
      setDatasetFilter(seededId);
    }
  }, [datasets, filters.datasetId, initialDatasetId, setDatasetFilter]);

  useEffect(() => {
    const stored = window.localStorage.getItem("honors-dashboard-theme");
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("honors-dashboard-theme", theme);
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (filters.datasetId) params.set("datasetId", filters.datasetId);
    const query = params.toString();
    const nextRoute = (query ? `${pathname}?${query}` : pathname) as Route;
    router.replace(nextRoute, { scroll: false });
  }, [filters.datasetId, pathname, router]);

  useEffect(() => {
    if (!filters.datasetId) return;
    let cancelled = false;
    setIsSummaryLoading(true);
    setSummaryError(null);
    fetch(`/api/analytics/summary?${buildQuery(filters)}`, { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Failed to load summary");
        return payload as SummaryResponse;
      })
      .then((payload) => {
        if (cancelled) return;
        setSummary(payload);
        const nextMin = Number(payload.filterOptions.gpaMin.toFixed(2));
        const nextMax = Number(payload.filterOptions.gpaMax.toFixed(2));
        const [prevMin, prevMax] = filters.gpaRange;

        let nextRange: [number, number];
        if (gpaRangeSeededDatasetRef.current !== payload.dataset.id) {
          // Initialize slider bounds once per selected dataset.
          nextRange = [nextMin, nextMax];
          gpaRangeSeededDatasetRef.current = payload.dataset.id;
        } else {
          // Preserve user's current selection and only clamp if it falls outside dataset bounds.
          const clampedLow = Math.max(nextMin, Math.min(prevMin, nextMax));
          const clampedHigh = Math.max(clampedLow, Math.min(prevMax, nextMax));
          nextRange = [clampedLow, clampedHigh];
        }

        if (!rangesEqual(nextRange, [prevMin, prevMax])) {
          setFilterPartial({ gpaRange: nextRange });
        }
      })
      .catch((err: Error) => !cancelled && setSummaryError(err.message))
      .finally(() => !cancelled && setIsSummaryLoading(false));

    return () => {
      cancelled = true;
    };
  }, [
    filters.datasetId,
    filters.campus,
    filters.majorDescription,
    filters.classStanding,
    filters.studentType,
    filters.gpaRange,
    filters.excludeZeroGpa,
    setFilterPartial
  ]);

  useEffect(() => {
    if (!filters.datasetId || datasets.length < 2) {
      setSemesterTrends(null);
      return;
    }
    let cancelled = false;
    setIsSemesterTrendsLoading(true);
    setSemesterTrendsError(null);
    fetch(`/api/analytics/semester-trends?${buildQuery(filters)}`, { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Failed to load semester trends");
        return payload as SemesterTrendsResponse;
      })
      .then((payload) => !cancelled && setSemesterTrends(payload))
      .catch((err: Error) => !cancelled && setSemesterTrendsError(err.message))
      .finally(() => !cancelled && setIsSemesterTrendsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [
    datasets.length,
    filters.datasetId,
    filters.campus,
    filters.majorDescription,
    filters.classStanding,
    filters.studentType,
    filters.gpaRange,
    filters.excludeZeroGpa
  ]);

  useEffect(() => {
    if (!filters.datasetId) return;
    let cancelled = false;
    setIsRecordsLoading(true);
    setRecordsError(null);
    fetch(`/api/analytics/records?${buildQuery(filters, recordsState)}`, { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Failed to load records");
        return payload as RecordsResponse;
      })
      .then((payload) => !cancelled && setRecords(payload))
      .catch((err: Error) => !cancelled && setRecordsError(err.message))
      .finally(() => !cancelled && setIsRecordsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [
    filters.datasetId,
    filters.campus,
    filters.majorDescription,
    filters.classStanding,
    filters.studentType,
    filters.gpaRange,
    filters.excludeZeroGpa,
    recordsState.page,
    recordsState.pageSize,
    recordsState.sortField,
    recordsState.sortDirection,
    recordsState.search
  ]);

  const filterOptions = summary?.filterOptions;
  const majorChartData = useMemo(() => {
    const data = [...(summary?.charts.averageGpaByMajor ?? [])];
    return (showAllMajors ? data : data.slice(0, 10)).sort(
      (a, b) => (b.averageGpa ?? 0) - (a.averageGpa ?? 0)
    );
  }, [summary?.charts.averageGpaByMajor, showAllMajors]);

  const mostSelectedCoursesData = useMemo(() => {
    return [...(summary?.charts.averageGpaByMajor ?? [])]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item) => ({
        label: item.majorDescription,
        count: item.count
      }));
  }, [summary?.charts.averageGpaByMajor]);

  const campusInsights = useMemo(() => {
    if (!summary) return [] as string[];
    const byEnrollment = [...summary.charts.studentsByCampus].sort((a, b) => b.count - a.count);
    const byGpa = [...summary.charts.averageGpaByCampus]
      .filter((item) => item.averageGpa != null)
      .sort((a, b) => (b.averageGpa ?? 0) - (a.averageGpa ?? 0));
    const topCourse = mostSelectedCoursesData[0];

    const insights: string[] = [];
    if (byEnrollment[0]) {
      insights.push(
        `${formatCampusName(byEnrollment[0].campus)} has the highest enrollment (${formatNumber(
          byEnrollment[0].count
        )} students).`
      );
    }
    if (byGpa[0]?.averageGpa != null) {
      insights.push(
        `${formatCampusName(byGpa[0].campus)} has the highest average GPA (${byGpa[0].averageGpa.toFixed(
          2
        )}) in the current view.`
      );
    }
    if (topCourse) {
      insights.push(
        `${topCourse.label} is the most selected course/major (${formatNumber(topCourse.count)} enrollments).`
      );
    }
    return insights;
  }, [summary, mostSelectedCoursesData]);

  const updateFilter = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => {
    setFilterPartial({ [key]: value } as Partial<FiltersState>);
    setRecordsState((prev) => ({ ...prev, page: 1 }));
  };

  const resetFilters = () => {
    clearStoreFilters(
      summary
        ? [
            Number(summary.filterOptions.gpaMin.toFixed(2)),
            Number(summary.filterOptions.gpaMax.toFixed(2))
          ]
        : undefined
    );
    setRecordsState(defaultRecordsState());
  };

  const handleDatasetChange = (datasetId?: string) => {
    const nextId = datasetId?.trim();
    if (!nextId || !datasets.some((d) => d.id === nextId)) return;
    setSummary(null);
    setRecords(null);
    setShowAllMajors(false);
    gpaRangeSeededDatasetRef.current = null;
    setDatasetFilter(nextId);
    setRecordsState(defaultRecordsState());
  };

  const deleteDatasetById = async (datasetId: string) => {
    if (isDeletingDataset) return;
    if (!canManageData) {
      alert("Viewer access is read-only. Contact an administrator for dataset deletion.");
      return;
    }

    try {
      setIsDeletingDataset(true);
      const res = await fetch(`/api/datasets/${datasetId}`, {
        method: "DELETE"
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete semester");
      }

      const datasetsRes = await fetch("/api/datasets", { cache: "no-store" });
      const nextDatasets = (await datasetsRes.json()) as DatasetsResponse;
      setDatasets(nextDatasets);

      const fallbackDataset = nextDatasets.find((d) => d.id !== datasetId) ?? nextDatasets[0];
      if (fallbackDataset) {
        handleDatasetChange(fallbackDataset.id);
      } else {
        setSummary(null);
        setRecords(null);
        setSemesterTrends(null);
        setSummaryError(null);
        setRecordsError(null);
        setSemesterTrendsError(null);
        gpaRangeSeededDatasetRef.current = null;
        setFilterPartial({
          datasetId: "",
          campus: undefined,
          majorDescription: undefined,
          classStanding: undefined,
          studentType: undefined,
          gpaRange: [0, 4],
          excludeZeroGpa: false
        });
        setRecordsState(defaultRecordsState());
      }
      setShowDeleteDatasetModal(false);
      setShowDeleteSemesterRowModal(false);
      setSemesterToDelete(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete semester");
    } finally {
      setIsDeletingDataset(false);
    }
  };

  const handleDeleteSelectedDataset = async () => {
    if (!selectedDataset) return;
    await deleteDatasetById(selectedDataset.id);
  };

  const handleRenameSelectedDataset = async () => {
    if (!selectedDataset || isRenamingDataset) return;
    if (!canManageData) {
      alert("Viewer access is read-only. Contact an administrator for dataset updates.");
      return;
    }
    const trimmed = renameDatasetDraft.trim();
    if (!trimmed || trimmed === selectedDataset.semesterLabel) return;

    try {
      setIsRenamingDataset(true);
      const res = await fetch(`/api/datasets/${selectedDataset.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ semesterLabel: trimmed })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to rename semester");
      }

      setDatasets((prev) =>
        prev.map((d) =>
          d.id === selectedDataset.id ? { ...d, semesterLabel: trimmed } : d
        )
      );
      setSummary((prev) =>
        prev && prev.dataset.id === selectedDataset.id
          ? {
              ...prev,
              dataset: { ...prev.dataset, semesterLabel: trimmed }
            }
          : prev
      );
      setSemesterTrends((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((row) =>
                row.datasetId === selectedDataset.id
                  ? { ...row, semesterLabel: trimmed }
                  : row
              ),
              campusRows: prev.campusRows.map((row) =>
                row.datasetId === selectedDataset.id
                  ? { ...row, semesterLabel: trimmed }
                  : row
              )
            }
          : prev
      );
      setShowRenameDatasetModal(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to rename semester");
    } finally {
      setIsRenamingDataset(false);
    }
  };

  const toggleChartFilter = (
    key: "campus" | "majorDescription" | "classStanding" | "studentType",
    value?: string
  ) => {
    toggleCategorical(key, value);
    setRecordsState((prev) => ({ ...prev, page: 1 }));
  };

  const datasetGpaRange = summary
    ? ([
        Number(summary.filterOptions.gpaMin.toFixed(2)),
        Number(summary.filterOptions.gpaMax.toFixed(2))
      ] as [number, number])
    : undefined;
  const selectedGpaBucket = getSelectedGpaBucket(filters.gpaRange, datasetGpaRange);

  const handleGpaBucketToggle = (bucket: string) => {
    const bucketRange = getBucketRange(bucket);
    if (!bucketRange) return;
    const nextRange =
      selectedGpaBucket === bucket && datasetGpaRange ? datasetGpaRange : bucketRange;
    updateFilter("gpaRange", nextRange);
  };

  const handleStandingCampusSegmentToggle = (campus: string, classStanding: string) => {
    const isSamePair =
      filters.campus === campus && filters.classStanding === classStanding;
    setFilterPartial({
      campus: isSamePair ? undefined : campus,
      classStanding: isSamePair ? undefined : classStanding
    });
    setRecordsState((prev) => ({ ...prev, page: 1 }));
  };

  const activeChips = [
    filters.campus
      ? {
          key: `campus:${filters.campus}`,
          label: `Campus: ${formatCampusName(filters.campus)}`,
          clear: () => toggleChartFilter("campus", filters.campus)
        }
      : null,
    filters.studentType
      ? {
          key: `studentType:${filters.studentType}`,
          label: `Student Type: ${filters.studentType}`,
          clear: () => toggleChartFilter("studentType", filters.studentType)
        }
      : null,
    filters.classStanding
      ? {
          key: `classStanding:${filters.classStanding}`,
          label: `Class: ${formatClassStanding(filters.classStanding)}`,
          clear: () => toggleChartFilter("classStanding", filters.classStanding)
        }
      : null,
    filters.majorDescription
      ? {
          key: `major:${filters.majorDescription}`,
          label: `Major: ${filters.majorDescription}`,
          clear: () => toggleChartFilter("majorDescription", filters.majorDescription)
        }
      : null,
    selectedGpaBucket
      ? {
          key: `gpaBucket:${selectedGpaBucket}`,
          label: `GPA Bucket: ${selectedGpaBucket}`,
          clear: () => datasetGpaRange && updateFilter("gpaRange", datasetGpaRange)
        }
      : null,
    !selectedGpaBucket &&
    datasetGpaRange &&
    !rangesEqual(filters.gpaRange, datasetGpaRange)
      ? {
          key: "gpaRange:custom",
          label: `GPA: ${filters.gpaRange[0].toFixed(2)}-${filters.gpaRange[1].toFixed(2)}`,
          clear: () => updateFilter("gpaRange", datasetGpaRange)
        }
      : null,
    filters.excludeZeroGpa
      ? {
          key: "excludeZero",
          label: "Exclude 0.00 GPA",
          clear: () => updateFilter("excludeZeroGpa", false)
        }
      : null
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const sortedSemesterTrendRows = useMemo(() => {
    return [...(semesterTrends?.rows ?? [])].sort((a, b) => {
      return (
        getSemesterSortKey(a.semesterLabel, a.createdAt) -
        getSemesterSortKey(b.semesterLabel, b.createdAt)
      );
    });
  }, [semesterTrends]);

  const sortedCampusTrendRows = useMemo(() => {
    return [...(semesterTrends?.campusRows ?? [])].sort((a, b) => {
      if (a.campus !== b.campus) return a.campus.localeCompare(b.campus);
      return (
        getSemesterSortKey(a.semesterLabel, a.createdAt) -
        getSemesterSortKey(b.semesterLabel, b.createdAt)
      );
    });
  }, [semesterTrends]);

  const campusTrendOptions = useMemo(
    () => Array.from(new Set(sortedCampusTrendRows.map((row) => row.campus))),
    [sortedCampusTrendRows]
  );

  const selectedCampusTrendRows = useMemo(() => {
    if (!selectedTrendCampus) return [];
    return sortedCampusTrendRows.filter((row) => row.campus === selectedTrendCampus);
  }, [selectedTrendCampus, sortedCampusTrendRows]);

  useEffect(() => {
    if (!campusTrendOptions.length) {
      setSelectedTrendCampus(undefined);
      return;
    }
    if (!selectedTrendCampus || !campusTrendOptions.includes(selectedTrendCampus)) {
      setSelectedTrendCampus(campusTrendOptions[0]);
    }
  }, [campusTrendOptions, selectedTrendCampus]);

  const semesterRangeLabel = useMemo(() => {
    const rows = sortedSemesterTrendRows.filter((row) => row.totalStudents > 0);
    if (rows.length === 0) return null;
    if (rows.length === 1) return formatSemesterLabel(rows[0].semesterLabel);
    return `${formatSemesterLabel(rows[0].semesterLabel)} to ${formatSemesterLabel(rows[rows.length - 1].semesterLabel)}`;
  }, [sortedSemesterTrendRows]);

  const semesterInsights = useMemo(() => {
    const rows = sortedSemesterTrendRows.filter((row) => row.totalStudents > 0);
    if (rows.length < 2) return [] as string[];

    const first = rows[0];
    const latest = rows[rows.length - 1];
    const enrollmentDelta = latest.totalStudents - first.totalStudents;
    const enrollmentDeltaPct =
      first.totalStudents > 0 ? (enrollmentDelta / first.totalStudents) * 100 : 0;
    const peakEnrollment = rows.reduce((best, row) =>
      row.totalStudents > best.totalStudents ? row : best
    );
    const gpaRows = rows.filter((row) => row.averageGpa != null);
    const peakGpa =
      gpaRows.length > 0
        ? gpaRows.reduce((best, row) =>
            (row.averageGpa ?? 0) > (best.averageGpa ?? 0) ? row : best
          )
        : null;

    const insights = [
      `Enrollment ${enrollmentDelta >= 0 ? "increased" : "decreased"} by ${Math.abs(
        enrollmentDelta
      )} students (${Math.abs(enrollmentDeltaPct).toFixed(1)}%) from ${formatSemesterLabel(first.semesterLabel)} to ${formatSemesterLabel(latest.semesterLabel)}.`,
      `Highest enrollment in the current view is ${formatSemesterLabel(peakEnrollment.semesterLabel)} (${formatNumber(
        peakEnrollment.totalStudents
      )} students).`
    ];

    if (peakGpa?.averageGpa != null) {
      insights.push(
        `Highest average GPA in the current view is ${formatSemesterLabel(peakGpa.semesterLabel)} (${peakGpa.averageGpa.toFixed(
          2
        )}).`
      );
    }

    return insights;
  }, [sortedSemesterTrendRows]);

  const strategicForecast = useMemo(() => {
    const rows = sortedSemesterTrendRows.filter((row) => row.totalStudents > 0);
    if (rows.length < 2) return null;

    const latest = rows[rows.length - 1];
    const nextLabel = nextSemesterLabel(latest.semesterLabel);

    const enrollmentValues = rows.map((row) => row.totalStudents);
    const enrollmentModel = linearForecast(enrollmentValues);
    if (!enrollmentModel) return null;

    const gpaRows = rows.filter((row) => row.averageGpa != null);
    const gpaValues = gpaRows.map((row) => row.averageGpa as number);
    const gpaModel = gpaValues.length >= 2 ? linearForecast(gpaValues) : null;

    const projectedEnrollment = Math.max(0, Math.round(enrollmentModel.projected));
    const enrollmentBand = Math.max(15, Math.round(1.28 * enrollmentModel.residualStdDev));
    const enrollmentLower = Math.max(0, projectedEnrollment - enrollmentBand);
    const enrollmentUpper = projectedEnrollment + enrollmentBand;

    const projectedGpa =
      gpaModel == null
        ? null
        : Math.max(0, Math.min(4, Number(gpaModel.projected.toFixed(2))));
    const gpaBand = gpaModel == null ? null : Math.max(0.03, 1.28 * gpaModel.residualStdDev);

    const enrollmentDirection = projectedEnrollment >= latest.totalStudents ? "upward" : "downward";
    const gpaDirection =
      projectedGpa == null || latest.averageGpa == null
        ? null
        : projectedGpa >= latest.averageGpa
          ? "improving"
          : "softening";

    const enrollmentChartData: Array<{
      semesterLabel: string;
      actualEnrollment: number | null;
      forecastEnrollment: number | null;
    }> = rows.map((row, index) => ({
      semesterLabel: row.semesterLabel,
      actualEnrollment: row.totalStudents,
      forecastEnrollment: index === rows.length - 1 ? row.totalStudents : null
    }));
    enrollmentChartData.push({
      semesterLabel: nextLabel,
      actualEnrollment: null,
      forecastEnrollment: projectedEnrollment
    });

    const gpaChartData: Array<{
      semesterLabel: string;
      actualGpa: number | null;
      forecastGpa: number | null;
    }> = gpaRows.map((row, index) => ({
      semesterLabel: row.semesterLabel,
      actualGpa: Number((row.averageGpa ?? 0).toFixed(2)),
      forecastGpa: index === gpaRows.length - 1 ? Number((row.averageGpa ?? 0).toFixed(2)) : null
    }));
    if (projectedGpa != null) {
      gpaChartData.push({
        semesterLabel: nextLabel,
        actualGpa: null,
        forecastGpa: projectedGpa
      });
    }

    const insights = [
      `Next-semester enrollment is forecast at ${formatNumber(projectedEnrollment)} students (range ${formatNumber(
        enrollmentLower
      )}-${formatNumber(enrollmentUpper)}), indicating a ${enrollmentDirection} trajectory.`,
      gpaDirection && projectedGpa != null
        ? `Projected average GPA is ${projectedGpa.toFixed(2)}, which is ${gpaDirection} versus the latest term.`
        : "Not enough GPA history to produce a stable GPA forecast."
    ];

    return {
      nextLabel,
      latestLabel: latest.semesterLabel,
      projectedEnrollment,
      enrollmentLower,
      enrollmentUpper,
      projectedGpa,
      gpaLower: projectedGpa != null && gpaBand != null ? Math.max(0, projectedGpa - gpaBand) : null,
      gpaUpper: projectedGpa != null && gpaBand != null ? Math.min(4, projectedGpa + gpaBand) : null,
      enrollmentSlope: enrollmentModel.slope,
      gpaSlope: gpaModel?.slope ?? null,
      enrollmentChartData,
      gpaChartData,
      insights
    };
  }, [sortedSemesterTrendRows]);

  const handleUploadSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageData) {
      alert("Viewer access is read-only. Contact an administrator to upload datasets.");
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    startUploadTransition(async () => {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const payload = await res.json();
      if (!res.ok) {
        alert(payload.error || "Upload failed");
        return;
      }
      const datasetsRes = await fetch("/api/datasets", { cache: "no-store" });
      const datasetList = (await datasetsRes.json()) as DatasetsResponse;
      setDatasets(datasetList);
      const newId = payload.dataset?.id as string | undefined;
      if (newId) handleDatasetChange(newId);
      form.reset();
      setHasInitFile(false);
      setInitFileName("");
    });
  };

  const handleHeaderUploadFiles = (files: FileList | null) => {
    if (!canManageData) {
      alert("Viewer access is read-only. Contact an administrator to upload datasets.");
      return;
    }
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;

    startUploadTransition(async () => {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const payload = await res.json();
      if (!res.ok) {
        alert(payload.error || "Upload failed");
        return;
      }

      const datasetsRes = await fetch("/api/datasets", { cache: "no-store" });
      const datasetList = (await datasetsRes.json()) as DatasetsResponse;
      setDatasets(datasetList);
      const newId = payload.dataset?.id as string | undefined;
      if (newId) handleDatasetChange(newId);

      if (headerUploadInputRef.current) headerUploadInputRef.current.value = "";
    });
  };

  const downloadFilteredRecordsCsv = async () => {
    if (!filters.datasetId || isExportingRecords) return;
    try {
      setIsExportingRecords(true);
      const params = new URLSearchParams();
      params.set("datasetId", filters.datasetId);
      if (filters.campus) params.set("campus", filters.campus);
      if (filters.majorDescription) params.set("majorDescription", filters.majorDescription);
      if (filters.classStanding) params.set("classStanding", filters.classStanding);
      if (filters.studentType) params.set("studentType", filters.studentType);
      params.set("gpaMin", filters.gpaRange[0].toFixed(2));
      params.set("gpaMax", filters.gpaRange[1].toFixed(2));
      if (filters.excludeZeroGpa) params.set("excludeZeroGpa", "true");
      if (recordsState.search.trim()) params.set("search", recordsState.search.trim());
      params.set("sortField", recordsState.sortField);
      params.set("sortDirection", recordsState.sortDirection);

      const response = await fetch(`/api/analytics/records/export?${params.toString()}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to export CSV");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedDataset?.semesterLabel?.replace(/\s+/g, "-").toLowerCase() || "semester"}-filtered-records.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to export records");
    } finally {
      setIsExportingRecords(false);
    }
  };

  const clearFileInput = (
    ref: React.RefObject<HTMLInputElement>,
    setter: (v: boolean) => void,
    setFileName?: (value: string) => void
  ) => {
    if (ref.current) ref.current.value = "";
    setter(false);
    setFileName?.("");
  };

  const navigateToSection = (nextSection: DashboardSection) => {
    if (nextSection === activeSection) return;
    if (sectionSwitchTimeoutRef.current) {
      clearTimeout(sectionSwitchTimeoutRef.current);
    }

    setPendingSection(nextSection);
    setIsSectionSwitching(true);

    const params = new URLSearchParams(window.location.search);
    if (nextSection === "overview") {
      params.delete("section");
    } else {
      params.set("section", nextSection);
    }
    window.history.replaceState(
      {},
      "",
      params.toString() ? `${pathname}?${params.toString()}` : pathname
    );

    sectionSwitchTimeoutRef.current = setTimeout(() => {
      setActiveSection(nextSection);
      setIsSectionSwitching(false);
      setPendingSection(null);
    }, 650);
  };

  const selectedFiltersSummary = [
    selectedDataset ? `Semester: ${formatSemesterLabel(selectedDataset.semesterLabel)}` : null,
    filters.campus ? `Campus: ${formatCampusName(filters.campus)}` : null,
    filters.majorDescription ? `Major: ${filters.majorDescription}` : null,
    filters.classStanding ? `Class Standing: ${formatClassStanding(filters.classStanding)}` : null,
    filters.studentType ? `Student Type: ${filters.studentType}` : null,
    `GPA Range: ${filters.gpaRange[0].toFixed(2)} - ${filters.gpaRange[1].toFixed(2)}`,
    filters.excludeZeroGpa ? "Exclude 0.00 GPA: Yes" : "Exclude 0.00 GPA: No"
  ].filter(Boolean) as string[];

  const downloadSectionPdf = () => {
    window.print();
  };

  const handleLogout = async () => {
    await authClient.signOut();
    window.location.href = "/sign-in";
  };

  const loadAccessUsers = async () => {
    if (!canManageAccess) return;
    try {
      setIsAccessUsersLoading(true);
      setAccessUsersError(null);
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load user access");
      }
      setAccessUsers(payload as AccessUser[]);
    } catch (error) {
      setAccessUsersError(error instanceof Error ? error.message : "Failed to load user access");
    } finally {
      setIsAccessUsersLoading(false);
    }
  };

  const openAccessSettings = () => {
    if (!canManageAccess) return;
    setShowAccessSettingsModal(true);
    loadAccessUsers();
  };

  const updateAccessRole = async (email: string, role: "admin" | "viewer") => {
    if (!canManageAccess) return;
    try {
      setIsUpdatingAccessRole(email);
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, role })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update user role");
      }
      setAccessUsers((prev) =>
        prev.map((u) => (u.email?.toLowerCase() === email.toLowerCase() ? { ...u, role } : u))
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update user role");
    } finally {
      setIsUpdatingAccessRole(null);
    }
  };

  if (!datasets.length || !initialDatasetId) {
    return (
      <main className="dashboard-grid min-h-screen">
        <div className="container py-10">
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle>Initialize Honors Dataset</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canManageData ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Upload a semester roster CSV/XLSX to create the first dataset.
                  </p>
                  <form onSubmit={handleUploadSubmit} className="grid gap-3">
                    <div>
                      <Label htmlFor="semesterLabel">Semester Label</Label>
                      <Input id="semesterLabel" name="semesterLabel" placeholder="Fall 2025" />
                    </div>
                    <div>
                      <Label htmlFor="file">Roster File</Label>
                      <FilePickerControl
                        inputRef={initFileInputRef}
                        inputId="file"
                        inputName="file"
                        selectedFileName={initFileName}
                        onFileChange={() => {
                          const file = initFileInputRef.current?.files?.[0];
                          setHasInitFile(Boolean(file));
                          setInitFileName(file?.name ?? "");
                        }}
                        buttonLabel="Select File"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={!hasInitFile}
                        onClick={() =>
                          clearFileInput(initFileInputRef, setHasInitFile, setInitFileName)
                        }
                      >
                        Delete File
                      </Button>
                    </div>
                    <Button type="submit" disabled={isUploading}>
                      <Upload className="mr-2 h-4 w-4" />
                      {isUploading ? "Uploading..." : "Upload Semester Dataset"}
                    </Button>
                  </form>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No uploaded semester datasets are available yet. Viewer accounts can only explore
                  existing uploads. Ask an administrator to upload files.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-grid min-h-screen">
      <div className="container space-y-6 py-6">
        <div className="pdf-export-hide">
        <InstitutionalHeader
          canManageAccess={canManageAccess}
          userName={session?.user?.name}
          userEmail={session?.user?.email}
          userImage={session?.user?.image}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
          onOpenAccessSettings={openAccessSettings}
        />
        </div>

        <Card className="pdf-export-only mb-4">
          <CardHeader className="pb-2">
            <CardTitle>{sectionTitle(activeSection)} Dashboard Report</CardTitle>
            <p className="text-sm text-muted-foreground">
              Export snapshot including selected filters and chart context.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="font-medium">Selected Filters</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {selectedFiltersSummary.map((item) => (
                  <Badge key={item}>{item}</Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="font-medium">Chart Descriptions</div>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {chartDescriptionsBySection[activeSection].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <section className={isSemesters ? "space-y-6" : "grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]"}>
          {!isSemesters ? (
          <div className="pdf-export-hide space-y-4 xl:sticky xl:top-4 xl:self-start">
            <Card className="h-fit">
              <CardHeader className="pb-2">
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <input
                  ref={headerUploadInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  multiple
                  className="sr-only"
                  onChange={(e) => handleHeaderUploadFiles(e.target.files)}
                />
                <div className="flex flex-wrap gap-2">
                  {canManageData ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isUploading}
                      className="bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(37,99,235,0.22)] hover:bg-primary/95"
                      onClick={() => headerUploadInputRef.current?.click()}
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      {isUploading ? "Uploading..." : "Upload"}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-blue-200"
                    onClick={() => navigateToSection("semesters")}
                  >
                    Semesters
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Semester</Label>
                  <SelectField
                    value={filters.datasetId}
                    onChange={handleDatasetChange}
                    options={datasets.map((d) => ({
                      value: d.id,
                      label: `${formatSemesterLabel(d.semesterLabel)} (${formatNumber(d.rowCount)})`
                    }))}
                    placeholder="Select semester"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Campus</Label>
                  <SelectField
                    value={filters.campus}
                    onChange={(value) => updateFilter("campus", value)}
                    options={(filterOptions?.campuses ?? []).map((v) => ({
                      value: v,
                      label: formatCampusName(v)
                    }))}
                    disabled={!filterOptions}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Major Description</Label>
                  <SelectField
                    value={filters.majorDescription}
                    onChange={(value) => updateFilter("majorDescription", value)}
                    options={(filterOptions?.majors ?? []).map((v) => ({ value: v, label: v }))}
                    disabled={!filterOptions}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Class Standing</Label>
                <SelectField
                  value={filters.classStanding}
                  onChange={(value) => updateFilter("classStanding", value)}
                  options={(filterOptions?.classStandings ?? []).map((v) => ({
                    value: v,
                    label: formatClassStanding(v)
                  }))}
                  disabled={!filterOptions}
                />
                </div>

                <div className="space-y-1">
                  <Label>Student Type</Label>
                  <SelectField
                    value={filters.studentType}
                    onChange={(value) => updateFilter("studentType", value)}
                    options={(filterOptions?.studentTypes ?? []).map((v) => ({ value: v, label: v }))}
                    disabled={!filterOptions}
                  />
                </div>

                <div className="space-y-2">
                  <Label>GPA Range</Label>
                  <RangeSlider
                    min={filterOptions?.gpaMin ?? 0}
                    max={filterOptions?.gpaMax ?? 4}
                    step={0.01}
                    value={filters.gpaRange}
                    onChange={(value) => updateFilter("gpaRange", value)}
                    disabled={!filterOptions}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-medium">Exclude 0.00 GPA</div>
                    <div className="text-xs text-muted-foreground">
                      Applies to summary metrics and table results
                    </div>
                  </div>
                  <Switch
                    checked={filters.excludeZeroGpa}
                    onCheckedChange={(checked) => updateFilter("excludeZeroGpa", checked)}
                  />
                </div>

                <Button type="button" variant="outline" className="w-full" onClick={resetFilters}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardHeader className="pb-2">
                <CardTitle>Current View</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{selectedDataset ? formatSemesterLabel(selectedDataset.semesterLabel) : "Dataset"}</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!selectedDataset) return;
                      setRenameDatasetDraft(selectedDataset.semesterLabel);
                      setShowRenameDatasetModal(true);
                    }}
                    disabled={!selectedDataset || isRenamingDataset || isDeletingDataset || !canManageData}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    {isRenamingDataset ? "Editing..." : "Edit"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                    onClick={() => setShowDeleteDatasetModal(true)}
                    disabled={!selectedDataset || isDeletingDataset || isRenamingDataset || !canManageData}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {isDeletingDataset ? "Deleting..." : "Delete"}
                  </Button>
                  {summary?.dataset.rowCount != null ? (
                    <Badge>{formatNumber(summary.dataset.rowCount)} imported rows</Badge>
                  ) : null}
                </div>
                {activeChips.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {activeChips.map((chip) => (
                      <FilterChip key={chip.key} label={chip.label} onClear={chip.clear} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Select any chart item to update the dashboard view.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          ) : null}

          <div className="space-y-6">
            <Card>
              <CardContent className="flex flex-wrap items-center gap-2 p-3">
                {sectionNavItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigateToSection(item.key)}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                      item.key === activeSection
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/70 text-foreground hover:bg-secondary"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  {!isSemesters ? (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={downloadSectionPdf}>
                        Download PDF
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigateToSection("overview")}
                    >
                      Back to Dashboard
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {isSectionSwitching ? (
              <div className="flex min-h-[65vh] items-center justify-center">
                <SectionSwitchLoader target={sectionTitle(pendingSection ?? activeSection)} />
              </div>
            ) : (
              <>
            {activeChips.length > 0 && !isSemesters ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Clear Filters
                </Button>
              </div>
            ) : null}

            {summaryError ? (
              <Card>
                <CardContent className="p-5 text-sm text-red-700">{summaryError}</CardContent>
              </Card>
            ) : null}

            {isSemesters ? (
              <Card>
                <CardHeader>
                  <CardTitle>Uploaded Semesters</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    View all uploaded semester files. {canManageData ? "Admins can permanently delete any semester from this page." : "Viewer access is read-only."}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader className="bg-secondary/50">
                        <TableRow>
                          <TableHead>Semester</TableHead>
                          <TableHead>Rows</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {datasets.map((dataset) => (
                          <TableRow key={dataset.id}>
                            <TableCell className="font-medium">
                              {formatSemesterLabel(dataset.semesterLabel)}
                            </TableCell>
                            <TableCell>{formatNumber(dataset.rowCount)}</TableCell>
                            <TableCell>
                              {new Date(dataset.createdAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric"
                              })}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    handleDatasetChange(dataset.id);
                                    navigateToSection("overview");
                                  }}
                                  title="View in table/dashboard"
                                  aria-label="View semester"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {canManageData ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="bg-red-600 text-white hover:bg-red-700"
                                    onClick={() => {
                                      setSemesterToDelete(dataset);
                                      setShowDeleteSemesterRowModal(true);
                                    }}
                                    disabled={isDeletingDataset}
                                    title="Delete semester"
                                    aria-label="Delete semester"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : isSummaryLoading && !summary ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <LoadingCard title="Loading" />
                <LoadingCard title="Loading" />
                <LoadingCard title="Loading" />
                <LoadingCard title="Loading" />
              </div>
            ) : summary ? (
              <>
                {isOverview ? (
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    label="Total Enrolled Honors Students"
                    value={formatNumber(summary.kpis.totalEnrolledHonorsStudents)}
                    tone="blue"
                  />
                  <KpiCard
                    label="Average GPA"
                    value={formatGpa(summary.kpis.averageGpa)}
                    subtext={filters.excludeZeroGpa ? "0.00 GPA excluded" : "Includes all GPA records"}
                    tone="teal"
                  />
                  <KpiCard
                    label="Dual Enrollment Students"
                    value={
                      summary.kpis.dualEnrollment.available
                        ? formatNumber(summary.kpis.dualEnrollment.count)
                        : "N/A"
                    }
                    subtext={
                      summary.kpis.dualEnrollment.available &&
                      summary.kpis.dualEnrollment.percentage != null
                        ? formatPercent(summary.kpis.dualEnrollment.percentage)
                        : "No DE indicator in dataset"
                    }
                    tone="amber"
                  />
                  <KpiCard
                    label="Campuses Represented"
                    value={formatNumber(summary.kpis.campusesRepresented)}
                    tone="violet"
                  />
                </section>
                ) : null}

                {isOverview || isAcademic ? (
                <section className="grid gap-4 lg:grid-cols-2">
                  <ChartCard
                    title="Students by Campus"
                    subtitle="Select a campus bar to update the dashboard"
                  >
                    <CampusBarChart
                      data={summary.charts.studentsByCampus}
                      selectedCampus={filters.campus}
                      onSelectCampus={(campus) => toggleChartFilter("campus", campus)}
                    />
                  </ChartCard>
                  <ChartCard
                    title="Students by Student Type"
                    subtitle="Select a student type to focus the results"
                  >
                    <StudentTypeDonutChart
                      data={summary.charts.studentsByStudentType}
                      selectedStudentType={filters.studentType}
                      onSelectStudentType={(studentType) =>
                        toggleChartFilter("studentType", studentType)
                      }
                    />
                  </ChartCard>
                  <ChartCard
                    title="Class Standing Distribution by Campus"
                    subtitle="Select a segment to focus on a campus and class level"
                    className="lg:col-span-2"
                  >
                    <ClassStandingStackedChart
                      data={summary.charts.classStandingByCampus}
                      selectedCampus={filters.campus}
                      selectedClassStanding={filters.classStanding}
                      onSelectSegment={handleStandingCampusSegmentToggle}
                    />
                  </ChartCard>
                  <ChartCard
                    title="GPA Distribution"
                    subtitle="Select a GPA range to narrow the results"
                  >
                    <GpaDistributionChart
                      data={summary.charts.gpaDistribution}
                      selectedBucket={selectedGpaBucket}
                      onSelectBucket={handleGpaBucketToggle}
                    />
                  </ChartCard>
                  <Card className="tile-glow">
                    <CardHeader className="flex-row items-center justify-between space-y-0">
                      <CardTitle>Average GPA by Major</CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllMajors((v) => !v)}
                      >
                        {showAllMajors ? "Show Top 10" : "Show All"}
                      </Button>
                    </CardHeader>
                    <CardContent className="h-72">
                      <AvgGpaByMajorChart
                        data={majorChartData}
                        selectedMajorDescription={filters.majorDescription}
                        onSelectMajorDescription={(major) =>
                          toggleChartFilter("majorDescription", major)
                        }
                      />
                    </CardContent>
                  </Card>
                </section>
                ) : null}

                {isTrends && datasets.length > 1 ? (
                  <>
                  <section className="space-y-4 rounded-2xl border-2 border-dashed border-blue-200 bg-gradient-to-b from-blue-50/70 to-white p-4 dark:border-blue-500/30 dark:from-blue-950/20 dark:to-slate-900">
                    <div className="flex flex-col gap-3 rounded-xl border bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
                          Across Semesters
                        </Badge>
                        <Badge className="dark:border-slate-600">
                          Comparative Trends
                        </Badge>
                        <Badge className="dark:border-slate-600">
                          Multi-Semester View
                        </Badge>
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold tracking-tight">
                          Semester Trend Comparison
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {semesterRangeLabel
                            ? `Comparative trends from ${semesterRangeLabel}.`
                            : "Comparative trends across uploaded semesters."}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          This section combines semester snapshots to show trend lines and cross-semester comparisons (not a single-semester dashboard view).
                        </p>
                      </div>
                    </div>
                    {semesterTrendsError ? (
                      <Card>
                        <CardContent className="p-4 text-sm text-red-700">
                          {semesterTrendsError}
                        </CardContent>
                      </Card>
                    ) : null}
                    {semesterInsights.length > 0 ? (
                      <Card className="tile-glow border-blue-100 bg-gradient-to-r from-blue-50 to-white">
                        <CardHeader className="pb-2">
                          <CardTitle>Semester Insights</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                          {semesterInsights.map((insight) => (
                            <p key={insight}>{insight}</p>
                          ))}
                        </CardContent>
                      </Card>
                    ) : null}
                    <div className="grid gap-4 lg:grid-cols-2">
                      <ChartCard
                        title="Enrollment Across Semesters"
                        subtitle="Honors roster size by semester"
                      >
                        {semesterTrends ? (
                          <SemesterEnrollmentTrendChart
                            data={sortedSemesterTrendRows}
                            selectedDatasetId={filters.datasetId}
                          />
                        ) : isSemesterTrendsLoading ? (
                          <div className="h-full animate-pulse rounded bg-secondary" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Add another semester to compare trends.
                          </div>
                        )}
                      </ChartCard>
                      <ChartCard
                        title="Average GPA Across Semesters"
                        subtitle="Average GPA by semester"
                      >
                        {semesterTrends ? (
                          <SemesterMetricLineChart
                            data={sortedSemesterTrendRows.map((r) => ({
                              semesterLabel: r.semesterLabel,
                              averageGpa: r.averageGpa
                            }))}
                            metricKey="averageGpa"
                            stroke="#10b981"
                            yFormatter={(v) => v.toFixed(2)}
                          />
                        ) : isSemesterTrendsLoading ? (
                          <div className="h-full animate-pulse rounded bg-secondary" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Add another semester to compare trends.
                          </div>
                        )}
                      </ChartCard>
                      <ChartCard
                        title="Campuses and Dual Enrollment by Semester"
                        subtitle="Campuses represented and dual enrollment share"
                        className="lg:col-span-2"
                      >
                        {semesterTrends ? (
                          <SemesterComparisonBarChart data={sortedSemesterTrendRows} />
                        ) : isSemesterTrendsLoading ? (
                          <div className="h-full animate-pulse rounded bg-secondary" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Add another semester to compare trends.
                          </div>
                        )}
                      </ChartCard>
                    </div>
                  </section>

                  <section className="space-y-4 rounded-2xl border-2 border-dashed border-teal-200 bg-gradient-to-b from-teal-50/70 to-white p-4 dark:border-teal-500/30 dark:from-teal-950/20 dark:to-slate-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-teal-200 bg-teal-100 text-teal-800 dark:border-teal-400/20 dark:bg-teal-500/10 dark:text-teal-200">
                        Campus Focus
                      </Badge>
                      <Badge className="dark:border-slate-600">Across Semesters</Badge>
                    </div>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle>Campus Trends Across Semesters</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Compare enrollment and GPA trends for a selected campus across semesters.
                        </p>
                      </CardHeader>
                      <CardContent>
                        {semesterTrends ? (
                          <div className="space-y-4">
                            {campusInsights.length ? (
                              <Card className="tile-glow border-teal-100 bg-gradient-to-r from-teal-50 to-white">
                                <CardHeader className="pb-2">
                                  <CardTitle>Campus Insights</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm text-muted-foreground">
                                  {campusInsights.map((insight) => (
                                    <p key={insight}>{insight}</p>
                                  ))}
                                </CardContent>
                              </Card>
                            ) : null}
                            <div className="grid gap-4 lg:grid-cols-2">
                              <ChartCard
                                title="Campus Performance Snapshot"
                                subtitle="Enrollment and average GPA by campus"
                              >
                                <CampusPerformanceChart data={summary.charts.averageGpaByCampus} />
                              </ChartCard>
                              <ChartCard
                                title="Campus Enrollment Distribution"
                                subtitle="Which campus has higher enrollment"
                              >
                                <CampusBarChart data={summary.charts.studentsByCampus} />
                              </ChartCard>
                              <ChartCard
                                title="Most Selected Courses (Majors)"
                                subtitle="Top courses/majors by enrollment volume"
                                className="lg:col-span-2"
                              >
                                <HorizontalCategoryBarChart
                                  data={mostSelectedCoursesData}
                                  labelKey="label"
                                  yAxisWidth={220}
                                />
                              </ChartCard>
                            </div>
                            {campusTrendOptions.length ? (
                              <>
                                <div className="max-w-sm">
                                  <SelectField
                                    value={selectedTrendCampus}
                                    onChange={(value) => setSelectedTrendCampus(value)}
                                    options={campusTrendOptions.map((campus) => ({
                                      value: campus,
                                      label: formatCampusName(campus)
                                    }))}
                                    placeholder="Select campus"
                                  />
                                </div>
                                <div className="grid gap-4 lg:grid-cols-2">
                                  <ChartCard
                                    title="Campus Enrollment Across Semesters"
                                    subtitle="Enrollment trend for the selected campus"
                                  >
                                    <SemesterMetricLineChart
                                      data={selectedCampusTrendRows.map((row) => ({
                                        semesterLabel: row.semesterLabel,
                                        totalStudents: row.totalStudents
                                      }))}
                                      metricKey="totalStudents"
                                      stroke="#2563eb"
                                    />
                                  </ChartCard>
                                  <ChartCard
                                    title="Campus Average GPA Across Semesters"
                                    subtitle="GPA trend for the selected campus"
                                  >
                                    <SemesterMetricLineChart
                                      data={selectedCampusTrendRows.map((row) => ({
                                        semesterLabel: row.semesterLabel,
                                        averageGpa: row.averageGpa
                                      }))}
                                      metricKey="averageGpa"
                                      stroke="#10b981"
                                      yFormatter={(v) => v.toFixed(2)}
                                    />
                                  </ChartCard>
                                </div>
                              </>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                            No campus trend data available.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </section>
                  </>
                ) : isTrends ? (
                  <Card>
                    <CardContent className="p-6 text-sm text-muted-foreground">
                      Add at least two uploaded semesters to view trend comparisons.
                    </CardContent>
                  </Card>
                ) : null}

                {isDemographics ? (
                <section className="grid gap-4 lg:grid-cols-2">
                  <ChartCard
                    title="Gender Distribution"
                    subtitle="Best for share-of-population comparison across a small number of categories"
                  >
                    <CategoryDonutChart
                      data={summary.charts.genderDistribution.map((d) => ({
                        label: d.gender,
                        count: d.count
                      }))}
                      labelKey="label"
                    />
                  </ChartCard>
                  <ChartCard
                    title="Ethnicity Distribution"
                    subtitle="Donut highlights proportional mix and shifts under campus/student-type selections"
                  >
                    <CategoryDonutChart
                      data={summary.charts.ethnicityDistribution.map((d) => ({
                        label: d.ethnicity,
                        count: d.count
                      }))}
                      labelKey="label"
                    />
                  </ChartCard>
                  <ChartCard
                    title="Race Distribution (Top 10)"
                    subtitle="Horizontal bars preserve label readability for longer race descriptors"
                    className="lg:col-span-2"
                    contentHeightClassName="h-[32rem]"
                  >
                    <HorizontalCategoryBarChart
                      data={summary.charts.raceDistribution.map((d) => ({
                        label: d.race,
                        count: d.count
                      }))}
                      labelKey="label"
                    />
                  </ChartCard>
                  <ChartCard
                    title="Age Distribution"
                    subtitle="Age bands support quick cohort composition reads for executive review"
                    className="lg:col-span-2"
                  >
                    <AgeDistributionBarChart data={summary.charts.ageDistribution} />
                  </ChartCard>
                </section>
                ) : null}

                {isStrategic ? (
                  <section className="space-y-4 rounded-2xl border-2 border-dashed border-violet-200 bg-gradient-to-b from-indigo-50/70 to-white p-4 dark:border-indigo-500/30 dark:from-indigo-950/20 dark:to-slate-900">
                    <div className="flex flex-col gap-3 rounded-xl border bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-200">
                          Forecasting
                        </Badge>
                        <Badge className="dark:border-slate-600">Strategic Planning</Badge>
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold tracking-tight">
                          Strategic Forecast Outlook
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Project next-semester outcomes from historical semester trends in the current filter view.
                        </p>
                      </div>
                    </div>

                    {!strategicForecast ? (
                      <Card>
                        <CardContent className="p-6 text-sm text-muted-foreground">
                          Add at least two semesters with valid records to generate strategic forecasts.
                        </CardContent>
                      </Card>
                    ) : (
                      <>
                        <div className="grid gap-4 lg:grid-cols-4">
                          <KpiCard
                            label={`Projected Enrollment (${strategicForecast.nextLabel})`}
                            value={formatNumber(strategicForecast.projectedEnrollment)}
                            subtext={`${formatNumber(strategicForecast.enrollmentLower)}-${formatNumber(strategicForecast.enrollmentUpper)} expected range`}
                            tone="violet"
                          />
                          <KpiCard
                            label="Enrollment Momentum"
                            value={strategicForecast.enrollmentSlope >= 0 ? "Increasing" : "Decreasing"}
                            subtext={`${Math.abs(strategicForecast.enrollmentSlope).toFixed(1)} students/semester`}
                            tone="blue"
                          />
                          <KpiCard
                            label={`Projected GPA (${strategicForecast.nextLabel})`}
                            value={
                              strategicForecast.projectedGpa == null
                                ? "N/A"
                                : strategicForecast.projectedGpa.toFixed(2)
                            }
                            subtext={
                              strategicForecast.gpaLower == null || strategicForecast.gpaUpper == null
                                ? "Need more GPA history"
                                : `${strategicForecast.gpaLower.toFixed(2)}-${strategicForecast.gpaUpper.toFixed(2)} expected range`
                            }
                            tone="teal"
                          />
                          <KpiCard
                            label="GPA Momentum"
                            value={
                              strategicForecast.gpaSlope == null
                                ? "N/A"
                                : strategicForecast.gpaSlope >= 0
                                  ? "Improving"
                                  : "Softening"
                            }
                            subtext={
                              strategicForecast.gpaSlope == null
                                ? "Need more GPA history"
                                : `${Math.abs(strategicForecast.gpaSlope).toFixed(3)} GPA/semester`
                            }
                            tone="amber"
                          />
                        </div>

                        <Card className="tile-glow border-indigo-100 bg-gradient-to-r from-indigo-50 to-white">
                          <CardHeader className="pb-2">
                            <CardTitle>Strategic Signals</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm text-muted-foreground">
                            {strategicForecast.insights.map((insight) => (
                              <p key={insight}>{insight}</p>
                            ))}
                            <p>
                              Forecast basis: trends from {semesterRangeLabel ?? strategicForecast.latestLabel} under current filters.
                            </p>
                          </CardContent>
                        </Card>

                        <section className="grid gap-4 lg:grid-cols-2">
                          <ChartCard
                            title="Enrollment Forecast"
                            subtitle="Historical enrollment with next-semester projection"
                          >
                            <ForecastLineChart
                              data={strategicForecast.enrollmentChartData}
                              actualKey="actualEnrollment"
                              forecastKey="forecastEnrollment"
                              actualLabel="Historical"
                              forecastLabel="Projection"
                              actualStroke="#2563eb"
                              forecastStroke="#7c3aed"
                            />
                          </ChartCard>
                          <ChartCard
                            title="GPA Forecast"
                            subtitle="Historical average GPA with projected next-semester value"
                          >
                            <ForecastLineChart
                              data={strategicForecast.gpaChartData}
                              actualKey="actualGpa"
                              forecastKey="forecastGpa"
                              actualLabel="Historical"
                              forecastLabel="Projection"
                              actualStroke="#10b981"
                              forecastStroke="#f59e0b"
                              yFormatter={(v) => v.toFixed(2)}
                            />
                          </ChartCard>
                        </section>
                      </>
                    )}
                  </section>
                ) : null}
              </>
            ) : null}

            {isOverview || isAcademic ? (
            <section className="pdf-export-hide">
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Academic Profile Records</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Browse, search, and sort student records for the selected semester.
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                    <div className="relative w-full sm:w-72">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={recordsState.search}
                        onChange={(e) => {
                          const search = e.target.value;
                          setRecordsState((prev) => ({ ...prev, page: 1, search }));
                        }}
                        placeholder="Search ID, name, major, campus"
                        className="pl-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={downloadFilteredRecordsCsv}
                      disabled={isExportingRecords || !records?.rows?.length}
                    >
                      {isExportingRecords ? "Preparing CSV..." : "Download CSV"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recordsError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {recordsError}
                    </div>
                  ) : null}
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader className="bg-secondary/50">
                        <TableRow>
                          {[
                            ["pantherId", "Panther ID"],
                            ["fullName", "Name"],
                            ["gpa", "GPA"],
                            ["majorDescription", "Major"],
                            ["campus", "Campus"]
                          ].map(([field, label]) => (
                            <TableHead key={field}>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 hover:text-foreground"
                                onClick={() =>
                                  setRecordsState((prev) => ({
                                    ...prev,
                                    page: 1,
                                    sortField: field,
                                    sortDirection:
                                      prev.sortField === field && prev.sortDirection === "asc"
                                        ? "desc"
                                        : "asc"
                                  }))
                                }
                              >
                                {label}
                                {records?.sort.field === field
                                  ? records.sort.direction === "asc"
                                    ? "↑"
                                    : "↓"
                                  : ""}
                              </button>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isRecordsLoading && !records ? (
                          Array.from({ length: 8 }).map((_, idx) => (
                            <TableRow key={idx}>
                              <TableCell colSpan={5}>
                                <div className="h-6 animate-pulse rounded bg-secondary" />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : records?.rows.length ? (
                          records.rows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{formatPantherIdDisplay(row.pantherId)}</TableCell>
                              <TableCell>{row.fullName ?? "—"}</TableCell>
                              <TableCell>{formatGpa(row.gpa)}</TableCell>
                              <TableCell>{row.majorDescription ?? "—"}</TableCell>
                              <TableCell>{row.campus ? formatCampusName(row.campus) : "—"}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                              No records match the current filters.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                      {records
                        ? `Page ${records.pagination.page} of ${records.pagination.pageCount} • ${formatNumber(
                            records.pagination.total
                          )} records`
                        : "Loading records..."}
                    </div>
                    <div className="flex items-center gap-2">
                      <SelectField
                        value={String(recordsState.pageSize)}
                        onChange={(value) =>
                          setRecordsState((prev) => ({
                            ...prev,
                            page: 1,
                            pageSize: Number(value || 25)
                          }))
                        }
                        options={[25, 50, 100].map((v) => ({ value: String(v), label: `${v} / page` }))}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!records || records.pagination.page <= 1}
                        onClick={() =>
                          setRecordsState((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                        }
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!records || records.pagination.page >= records.pagination.pageCount}
                        onClick={() =>
                          setRecordsState((prev) => ({ ...prev, page: prev.page + 1 }))
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
            ) : null}
            </>
            )}
          </div>
        </section>

        <DashboardModal
          open={showDeleteSemesterRowModal}
          title="Delete Semester Permanently?"
          description={`Warning: This will permanently delete "${semesterToDelete ? formatSemesterLabel(semesterToDelete.semesterLabel) : "selected semester"}" and all associated records. This action cannot be undone.`}
          onClose={() => {
            if (isDeletingDataset) return;
            setShowDeleteSemesterRowModal(false);
            setSemesterToDelete(null);
          }}
          footer={
            <>
              <Button
                type="button"
                className="border border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[0_0_0_1px_rgba(16,185,129,0.15)] hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                onClick={() => {
                  setShowDeleteSemesterRowModal(false);
                  setSemesterToDelete(null);
                }}
                disabled={isDeletingDataset}
              >
                No, Keep Semester
              </Button>
              <Button
                type="button"
                className="bg-red-600 text-white shadow-[0_0_0_1px_rgba(220,38,38,0.2)] hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                onClick={() => semesterToDelete && deleteDatasetById(semesterToDelete.id)}
                disabled={!semesterToDelete || isDeletingDataset}
              >
                {isDeletingDataset ? "Deleting..." : "Yes, Delete Permanently"}
              </Button>
            </>
          }
        />

        <DashboardModal
          open={showAccessSettingsModal}
          title="Access Settings"
          description="Manage who can access this dashboard and assign admin privileges."
          onClose={() => {
            if (isUpdatingAccessRole) return;
            setShowAccessSettingsModal(false);
          }}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={loadAccessUsers}
                disabled={isAccessUsersLoading || Boolean(isUpdatingAccessRole)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                type="button"
                onClick={() => setShowAccessSettingsModal(false)}
                disabled={Boolean(isUpdatingAccessRole)}
              >
                Close
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {isAccessUsersLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading users...
              </div>
            ) : accessUsersError ? (
              <p className="text-sm text-red-700">{accessUsersError}</p>
            ) : accessUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : (
              <div className="max-h-[52vh] space-y-2 overflow-auto pr-1">
                {accessUsers.map((u) => {
                  const email = u.email ?? "";
                  const canUpdate = Boolean(email);
                  const isRowUpdating = isUpdatingAccessRole === email;
                  return (
                    <div
                      key={u.id}
                      className="flex flex-col gap-2 rounded-lg border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {u.name?.trim() || "Unnamed User"}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {u.email || "No email"}
                          </div>
                        </div>
                        <Badge className="border-slate-300 bg-transparent text-slate-700 dark:border-slate-600 dark:text-slate-200">
                          {u.roleSource === "explicit" ? "Custom role" : "Default role"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Access role</span>
                        <div className="flex items-center gap-2">
                          <SelectField
                            value={u.role}
                            onChange={(value) => {
                              if (!canUpdate || !value || value === u.role) return;
                              updateAccessRole(email, value as "admin" | "viewer");
                            }}
                            options={[
                              { value: "viewer", label: "Viewer" },
                              { value: "admin", label: "Administrator" }
                            ]}
                            disabled={!canUpdate || Boolean(isUpdatingAccessRole)}
                            placeholder="Select role"
                          />
                          {isRowUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DashboardModal>

        <DashboardModal
          open={showRenameDatasetModal}
          title="Edit Semester Name"
          description="Update how this uploaded semester appears in filters and comparison charts."
          onClose={() => setShowRenameDatasetModal(false)}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRenameDatasetModal(false)}
                disabled={isRenamingDataset}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleRenameSelectedDataset}
                disabled={
                  !selectedDataset ||
                  isRenamingDataset ||
                  !renameDatasetDraft.trim() ||
                  renameDatasetDraft.trim() === selectedDataset?.semesterLabel
                }
              >
                {isRenamingDataset ? "Saving..." : "Save"}
              </Button>
            </>
          }
        >
          <div className="space-y-2">
            <Label htmlFor="rename-semester-input">Semester Name</Label>
            <Input
              id="rename-semester-input"
              value={renameDatasetDraft}
              onChange={(e) => setRenameDatasetDraft(e.target.value)}
              placeholder="Spring 2026"
              autoFocus
            />
          </div>
        </DashboardModal>

        <DashboardModal
          open={showDeleteDatasetModal}
          title={`Delete "${selectedDataset ? formatSemesterLabel(selectedDataset.semesterLabel) : "Semester"}"?`}
          description="This will permanently remove the semester dataset and all associated student records from the database."
          onClose={() => setShowDeleteDatasetModal(false)}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteDatasetModal(false)}
                disabled={isDeletingDataset}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                onClick={handleDeleteSelectedDataset}
                disabled={!selectedDataset || isDeletingDataset}
              >
                {isDeletingDataset ? "Deleting..." : "Delete Semester"}
              </Button>
            </>
          }
        />
      </div>
    </main>
  );
}
