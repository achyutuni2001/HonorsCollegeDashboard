"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCampusName, formatClassStanding, formatGpa, formatNumber } from "@/lib/utils";

const palette = [
  "#2563eb", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#84cc16", // lime
  "#06b6d4" // cyan
];
const warmCoolPalette = [
  "#1d4ed8",
  "#2563eb",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#ef4444"
];

function dimmedOpacity(hasSelection: boolean, isCurrent: boolean) {
  if (!hasSelection) return 1;
  return isCurrent ? 1 : 0.25;
}

function wrapLabel(text: string, maxLineLength = 26) {
  if (text.length <= maxLineLength) return text;
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function WrappedAxisTick(props: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const x = props.x ?? 0;
  const y = props.y ?? 0;
  const raw = String(props.payload?.value ?? "");
  const lines = wrapLabel(raw, 22).split("\n");

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-6} y={0} textAnchor="end" fill="currentColor" fontSize={10}>
        {lines.map((line, idx) => (
          <tspan
            key={`${line}-${idx}`}
            x={-6}
            dy={idx === 0 ? 3 : 12}
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function piePercentLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}) {
  const p = percent ?? 0;
  // Hide tiny slice labels to prevent collisions and clutter.
  if (p < 0.06) return "";
  const RADIAN = Math.PI / 180;
  const r = ((innerRadius ?? 0) + (outerRadius ?? 0)) / 2;
  const x = (cx ?? 0) + r * Math.cos(-((midAngle ?? 0) * RADIAN));
  const y = (cy ?? 0) + r * Math.sin(-((midAngle ?? 0) * RADIAN));
  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={700}
    >
      {(p * 100).toFixed(0)}%
    </text>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  className,
  contentHeightClassName = "h-72"
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  contentHeightClassName?: string;
}) {
  return (
    <Card className={`tile-glow ${className ?? ""}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className={contentHeightClassName}>{children}</CardContent>
    </Card>
  );
}

export function CampusBarChart({
  data,
  selectedCampus,
  onSelectCampus
}: {
  data: Array<{ campus: string; count: number }>;
  selectedCampus?: string;
  onSelectCampus?: (campus: string) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="campus"
          tick={{ fontSize: 11 }}
          interval={0}
          angle={-18}
          textAnchor="end"
          height={74}
          tickMargin={10}
          tickFormatter={(value) => formatCampusName(String(value))}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => formatNumber(Number(value))}
          labelFormatter={(label) => formatCampusName(String(label))}
        />
        <Bar
          dataKey="count"
          radius={[6, 6, 0, 0]}
          onClick={(entry: { payload?: { campus?: string } }) => {
            const campus = entry?.payload?.campus;
            if (campus && onSelectCampus) onSelectCampus(campus);
          }}
        >
          {data.map((entry, idx) => (
            <Cell
              key={`${entry.campus}-${idx}`}
              fill={palette[idx % palette.length]}
              fillOpacity={dimmedOpacity(Boolean(selectedCampus), selectedCampus === entry.campus)}
              cursor={onSelectCampus ? "pointer" : "default"}
              stroke={selectedCampus === entry.campus ? "#082b47" : undefined}
              strokeWidth={selectedCampus === entry.campus ? 2 : 0}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StudentTypeDonutChart({
  data,
  selectedStudentType,
  onSelectStudentType
}: {
  data: Array<{ studentType: string; count: number }>;
  selectedStudentType?: string;
  onSelectStudentType?: (studentType: string) => void;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="studentType"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={3}
          labelLine={false}
          label={piePercentLabel}
          onClick={(entry: { studentType?: string }) => {
            if (entry?.studentType && onSelectStudentType) onSelectStudentType(entry.studentType);
          }}
        >
          {data.map((entry, index) => (
            <Cell
              key={`${entry.studentType}-${index}`}
              fill={palette[index % palette.length]}
              fillOpacity={dimmedOpacity(
                Boolean(selectedStudentType),
                selectedStudentType === entry.studentType
              )}
              cursor={onSelectStudentType ? "pointer" : "default"}
              stroke={selectedStudentType === entry.studentType ? "#0f172a" : "#fff"}
              strokeWidth={selectedStudentType === entry.studentType ? 2 : 1}
            />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatNumber(Number(value))} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => {
            const item = data.find((d) => d.studentType === String(value));
            const pct = item && total > 0 ? Math.round((item.count / total) * 100) : 0;
            return `${value} (${pct}%)`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryDonutChart({
  data,
  labelKey
}: {
  data: Array<Record<string, string | number>>;
  labelKey: string;
}) {
  const total = data.reduce((sum, item) => sum + Number(item.count ?? 0), 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey={labelKey}
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          labelLine={false}
          label={piePercentLabel}
        >
          {data.map((entry, index) => (
            <Cell
              key={`${String(entry[labelKey])}-${index}`}
              fill={palette[index % palette.length]}
              stroke="#fff"
              strokeWidth={1}
            />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatNumber(Number(value))} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => {
            const item = data.find((d) => String(d[labelKey]) === String(value));
            const count = Number(item?.count ?? 0);
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return `${value} (${pct}%)`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ClassStandingStackedChart({
  data,
  selectedCampus,
  selectedClassStanding,
  onSelectSegment
}: {
  data: Array<{ campus: string; classStanding: string; count: number }>;
  selectedCampus?: string;
  selectedClassStanding?: string;
  onSelectSegment?: (campus: string, classStanding: string) => void;
}) {
  const standings = Array.from(new Set(data.map((d) => d.classStanding)));
  const byCampus = Array.from(new Set(data.map((d) => d.campus))).map((campus) => {
    const row: Record<string, string | number> = { campus };
    for (const standing of standings) row[standing] = 0;
    for (const item of data.filter((x) => x.campus === campus)) {
      row[item.classStanding] = item.count;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={byCampus}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="campus"
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => formatCampusName(String(value))}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value, name) => [value, formatClassStanding(String(name))]} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => formatClassStanding(String(value))}
        />
        {standings.map((standing, idx) => (
          <Bar
            key={standing}
            dataKey={standing}
            stackId="standing"
            fill={palette[idx % palette.length]}
            radius={idx === standings.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            onClick={(entry: { payload?: { campus?: string } }) => {
              const campus = entry?.payload?.campus;
              if (campus && onSelectSegment) onSelectSegment(campus, standing);
            }}
          >
            {byCampus.map((row, rowIdx) => {
              const campus = String(row.campus);
              const isMatch =
                (!selectedCampus || selectedCampus === campus) &&
                (!selectedClassStanding || selectedClassStanding === standing);
              const anySelected = Boolean(selectedCampus || selectedClassStanding);
              return (
                <Cell
                  key={`${campus}-${standing}-${rowIdx}`}
                  cursor={onSelectSegment ? "pointer" : "default"}
                  fillOpacity={dimmedOpacity(anySelected, isMatch)}
                  stroke={
                    selectedCampus === campus && selectedClassStanding === standing
                      ? "#0f172a"
                      : undefined
                  }
                  strokeWidth={selectedCampus === campus && selectedClassStanding === standing ? 1.5 : 0}
                />
              );
            })}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GpaDistributionChart({
  data,
  selectedBucket,
  onSelectBucket
}: {
  data: Array<{ bucket: string; count: number }>;
  selectedBucket?: string;
  onSelectBucket?: (bucket: string) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => formatNumber(Number(value))} />
        <Bar
          dataKey="count"
          radius={[6, 6, 0, 0]}
          onClick={(entry: { payload?: { bucket?: string } }) => {
            const bucket = entry?.payload?.bucket;
            if (bucket && onSelectBucket) onSelectBucket(bucket);
          }}
        >
          {data.map((entry, idx) => (
            <Cell
              key={`${entry.bucket}-${idx}`}
              fill={warmCoolPalette[idx % warmCoolPalette.length]}
              fillOpacity={dimmedOpacity(Boolean(selectedBucket), selectedBucket === entry.bucket)}
              cursor={onSelectBucket ? "pointer" : "default"}
              stroke={selectedBucket === entry.bucket ? "#0f172a" : undefined}
              strokeWidth={selectedBucket === entry.bucket ? 2 : 0}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AvgGpaByMajorChart({
  data,
  selectedMajorDescription,
  onSelectMajorDescription
}: {
  data: Array<{ majorDescription: string; averageGpa: number | null; count: number }>;
  selectedMajorDescription?: string;
  onSelectMajorDescription?: (majorDescription: string) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 18, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={[0, 4]} tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="majorDescription"
          width={140}
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => (String(v).length > 22 ? `${String(v).slice(0, 22)}…` : String(v))}
        />
        <Tooltip
          formatter={(value) => formatGpa(Number(value))}
          labelFormatter={(label) => String(label)}
        />
        <Bar
          dataKey="averageGpa"
          radius={[0, 6, 6, 0]}
          onClick={(entry: { payload?: { majorDescription?: string } }) => {
            const major = entry?.payload?.majorDescription;
            if (major && onSelectMajorDescription) onSelectMajorDescription(major);
          }}
        >
          {data.map((entry, idx) => (
            <Cell
              key={`${entry.majorDescription}-${idx}`}
              fill={palette[idx % palette.length]}
              fillOpacity={dimmedOpacity(
                Boolean(selectedMajorDescription),
                selectedMajorDescription === entry.majorDescription
              )}
              cursor={onSelectMajorDescription ? "pointer" : "default"}
              stroke={selectedMajorDescription === entry.majorDescription ? "#0f172a" : undefined}
              strokeWidth={selectedMajorDescription === entry.majorDescription ? 2 : 0}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HorizontalCategoryBarChart({
  data,
  labelKey,
  yAxisWidth = 190
}: {
  data: Array<Record<string, string | number>>;
  labelKey: string;
  yAxisWidth?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }} barCategoryGap="22%">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey={labelKey}
          width={yAxisWidth}
          tick={<WrappedAxisTick />}
          tickMargin={4}
          interval={0}
        />
        <Tooltip formatter={(value) => formatNumber(Number(value))} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
          {data.map((entry, idx) => (
            <Cell key={`${String(entry[labelKey])}-${idx}`} fill={palette[idx % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AgeDistributionBarChart({
  data
}: {
  data: Array<{ ageBand: string; count: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="ageBand" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => formatNumber(Number(value))} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((entry, idx) => (
            <Cell key={`${entry.ageBand}-${idx}`} fill={warmCoolPalette[idx % warmCoolPalette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SemesterEnrollmentTrendChart({
  data,
  selectedDatasetId
}: {
  data: Array<{ datasetId: string; semesterLabel: string; totalStudents: number }>;
  selectedDatasetId: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 8, right: 12 }}>
        <defs>
          <linearGradient id="enrollmentFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="semesterLabel" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => formatNumber(Number(value))} />
        <Area
          type="monotone"
          dataKey="totalStudents"
          stroke="#2563eb"
          fill="url(#enrollmentFill)"
          strokeWidth={2.5}
        />
        {data
          .filter((d) => d.datasetId === selectedDatasetId)
          .map((d) => (
            <ReferenceDot
              key={d.datasetId}
              x={d.semesterLabel}
              y={d.totalStudents}
              r={6}
              fill="#0f172a"
              stroke="#ffffff"
              strokeWidth={2}
            />
          ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SemesterMetricLineChart({
  data,
  metricKey,
  stroke,
  yFormatter
}: {
  data: Array<Record<string, string | number | null>>;
  metricKey: string;
  stroke: string;
  yFormatter?: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: 8, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="semesterLabel" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={yFormatter}
        />
        <Tooltip
          formatter={(value) =>
            yFormatter ? yFormatter(Number(value)) : formatNumber(Number(value))
          }
        />
        <Line
          type="monotone"
          dataKey={metricKey}
          stroke={stroke}
          strokeWidth={2.5}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SemesterComparisonBarChart({
  data
}: {
  data: Array<{
    semesterLabel: string;
    campusesRepresented: number;
    dualEnrollmentPct: number | null;
  }>;
}) {
  const chartData = data.map((row) => ({
    semesterLabel: row.semesterLabel,
    campusesRepresented: row.campusesRepresented,
    dualEnrollmentPct: row.dualEnrollmentPct == null ? 0 : Number((row.dualEnrollmentPct * 100).toFixed(1))
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ left: 8, right: 12 }} barCategoryGap="24%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="semesterLabel" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          formatter={(value, name) =>
            name === "dualEnrollmentPct"
              ? `${Number(value).toFixed(1)}%`
              : formatNumber(Number(value))
          }
        />
        <Legend
          formatter={(value) =>
            value === "campusesRepresented" ? "Campuses represented" : "Dual enrollment %"
          }
        />
        <Bar yAxisId="left" dataKey="campusesRepresented" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
        <Bar yAxisId="right" dataKey="dualEnrollmentPct" fill="#10b981" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
