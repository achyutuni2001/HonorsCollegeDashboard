"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Upload, RefreshCw, X, Sun, Moon, Trash2, Pencil } from "lucide-react";
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
  formatPercent
} from "@/lib/utils";
import {
  AgeDistributionBarChart,
  AvgGpaByMajorChart,
  CampusBarChart,
  CategoryDonutChart,
  ChartCard,
  ClassStandingStackedChart,
  GpaDistributionChart,
  HorizontalCategoryBarChart,
  SemesterComparisonBarChart,
  SemesterEnrollmentTrendChart,
  SemesterMetricLineChart,
  StudentTypeDonutChart
} from "@/components/dashboard/charts";
import { useDashboardFilterStore } from "@/stores/dashboard-filters";
import { useShallow } from "zustand/react/shallow";

type DatasetItem = DatasetsResponse[number];

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
        required
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
  onUploadSubmit,
  isUploading,
  theme,
  onToggleTheme,
  headerFileInputRef,
  hasHeaderFile,
  headerFileName,
  onClearHeaderFile,
  onHeaderFileChange
}: {
  onUploadSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isUploading: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  headerFileInputRef: React.RefObject<HTMLInputElement>;
  hasHeaderFile: boolean;
  headerFileName: string;
  onClearHeaderFile: () => void;
  onHeaderFileChange: () => void;
}) {
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
          <form
            onSubmit={onUploadSubmit}
            className="grid gap-2 rounded-xl border bg-white p-2 dark:border-slate-700 dark:bg-slate-900 md:col-span-2 md:grid-cols-[1fr_1fr_auto_auto] md:items-center"
          >
            <Input name="semesterLabel" placeholder="Semester (e.g., Spring 2026)" required />
            <FilePickerControl
              inputRef={headerFileInputRef}
              inputName="file"
              selectedFileName={headerFileName}
              onFileChange={onHeaderFileChange}
              buttonLabel="Select File"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!hasHeaderFile}
              onClick={onClearHeaderFile}
              className="md:h-10"
            >
              Delete File
            </Button>
            <Button type="submit" disabled={isUploading} className="md:h-10">
              <Upload className="mr-2 h-4 w-4" />
              {isUploading ? "Uploading..." : "Upload Roster"}
            </Button>
            <div className="flex justify-end md:hidden">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            </div>
          </form>
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
  initialDatasetId
}: {
  initialDatasets: DatasetsResponse;
  initialDatasetId: string | null;
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
  const [isUploading, startUploadTransition] = useTransition();
  const [showAllMajors, setShowAllMajors] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hasHeaderFile, setHasHeaderFile] = useState(false);
  const [hasInitFile, setHasInitFile] = useState(false);
  const [headerFileName, setHeaderFileName] = useState("");
  const [initFileName, setInitFileName] = useState("");
  const [isDeletingDataset, setIsDeletingDataset] = useState(false);
  const [isRenamingDataset, setIsRenamingDataset] = useState(false);
  const [showDeleteDatasetModal, setShowDeleteDatasetModal] = useState(false);
  const [showRenameDatasetModal, setShowRenameDatasetModal] = useState(false);
  const [renameDatasetDraft, setRenameDatasetDraft] = useState("");
  const gpaRangeSeededDatasetRef = useRef<string | null>(null);
  const headerFileInputRef = useRef<HTMLInputElement>(null);
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

  const selectedDataset = datasets.find((d) => d.id === filters.datasetId) ?? null;

  useEffect(() => {
    if (filters.datasetId) return;
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
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
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
    if (!datasetId) return;
    setSummary(null);
    setRecords(null);
    setShowAllMajors(false);
    gpaRangeSeededDatasetRef.current = null;
    setDatasetFilter(datasetId);
    setRecordsState(defaultRecordsState());
  };

  const handleDeleteSelectedDataset = async () => {
    if (!selectedDataset || isDeletingDataset) return;

    try {
      setIsDeletingDataset(true);
      const res = await fetch(`/api/datasets/${selectedDataset.id}`, {
        method: "DELETE"
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete semester");
      }

      const datasetsRes = await fetch("/api/datasets", { cache: "no-store" });
      const nextDatasets = (await datasetsRes.json()) as DatasetsResponse;
      setDatasets(nextDatasets);

      const fallbackDataset = nextDatasets.find((d) => d.id !== selectedDataset.id) ?? nextDatasets[0];
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
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete semester");
    } finally {
      setIsDeletingDataset(false);
    }
  };

  const handleRenameSelectedDataset = async () => {
    if (!selectedDataset || isRenamingDataset) return;
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

  const semesterRangeLabel = useMemo(() => {
    const rows = sortedSemesterTrendRows.filter((row) => row.totalStudents > 0);
    if (rows.length === 0) return null;
    if (rows.length === 1) return rows[0].semesterLabel;
    return `${rows[0].semesterLabel} to ${rows[rows.length - 1].semesterLabel}`;
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
      )} students (${Math.abs(enrollmentDeltaPct).toFixed(1)}%) from ${first.semesterLabel} to ${latest.semesterLabel}.`,
      `Highest enrollment in the current view is ${peakEnrollment.semesterLabel} (${formatNumber(
        peakEnrollment.totalStudents
      )} students).`
    ];

    if (peakGpa?.averageGpa != null) {
      insights.push(
        `Highest average GPA in the current view is ${peakGpa.semesterLabel} (${peakGpa.averageGpa.toFixed(
          2
        )}).`
      );
    }

    return insights;
  }, [sortedSemesterTrendRows]);

  const handleUploadSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      setHasHeaderFile(false);
      setHasInitFile(false);
      setHeaderFileName("");
      setInitFileName("");
    });
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

  if (!datasets.length || !initialDatasetId) {
    return (
      <main className="dashboard-grid min-h-screen">
        <div className="container py-10">
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle>Initialize Honors Dataset</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a semester roster CSV/XLSX to create the first dataset.
              </p>
              <form onSubmit={handleUploadSubmit} className="grid gap-3">
                <div>
                  <Label htmlFor="semesterLabel">Semester Label</Label>
                  <Input id="semesterLabel" name="semesterLabel" placeholder="Fall 2025" required />
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
                    onClick={() => clearFileInput(initFileInputRef, setHasInitFile, setInitFileName)}
                  >
                    Delete File
                  </Button>
                </div>
                <Button type="submit" disabled={isUploading}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploading ? "Uploading..." : "Upload Semester Dataset"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-grid min-h-screen">
      <div className="container space-y-6 py-6">
        <InstitutionalHeader
          onUploadSubmit={handleUploadSubmit}
          isUploading={isUploading}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
          headerFileInputRef={headerFileInputRef}
          hasHeaderFile={hasHeaderFile}
          headerFileName={headerFileName}
          onClearHeaderFile={() => clearFileInput(headerFileInputRef, setHasHeaderFile, setHeaderFileName)}
          onHeaderFileChange={() => {
            const file = headerFileInputRef.current?.files?.[0];
            setHasHeaderFile(Boolean(file));
            setHeaderFileName(file?.name ?? "");
          }}
        />

        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
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
                      label: `${d.semesterLabel} (${formatNumber(d.rowCount)})`
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
                  <Badge>{selectedDataset?.semesterLabel ?? "Dataset"}</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!selectedDataset) return;
                      setRenameDatasetDraft(selectedDataset.semesterLabel);
                      setShowRenameDatasetModal(true);
                    }}
                    disabled={!selectedDataset || isRenamingDataset || isDeletingDataset}
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
                    disabled={!selectedDataset || isDeletingDataset || isRenamingDataset}
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

          <div className="space-y-6">
            {activeChips.length > 0 ? (
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

            {isSummaryLoading && !summary ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <LoadingCard title="Loading" />
                <LoadingCard title="Loading" />
                <LoadingCard title="Loading" />
                <LoadingCard title="Loading" />
              </div>
            ) : summary ? (
              <>
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
                  <Card>
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

                {datasets.length > 1 ? (
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
                ) : null}

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
              </>
            ) : null}

            <section>
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Academic Profile Records</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Browse, search, and sort student records for the selected semester.
                    </p>
                  </div>
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
          </div>
        </section>

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
          title={`Delete "${selectedDataset?.semesterLabel ?? "Semester"}"?`}
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
