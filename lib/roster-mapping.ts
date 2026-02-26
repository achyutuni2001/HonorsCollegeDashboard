type RawRow = Record<string, unknown>;

type CanonicalRow = {
  pantherId: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  gpa: number | null;
  campus: string | null;
  majorDescription: string | null;
  classStanding: string | null;
  studentType: string | null;
  dualEnrollment: boolean | null;
  raw: Record<string, unknown>;
};

const aliases = {
  pantherId: [
    "panther id",
    "panther_id",
    "student id",
    "student_id",
    "pid",
    "id"
  ],
  firstName: ["first name", "first_name", "fname"],
  lastName: ["last name", "last_name", "lname"],
  fullName: ["name", "student name", "full name", "full_name"],
  gpa: [
    "gpa",
    "overall gpa",
    "cum gpa",
    "cumulative gpa",
    "institutional gpa",
    "institutional_gpa"
  ],
  campus: ["campus", "home campus", "campus description", "campus_desc"],
  majorDescription: ["major description", "major_desc", "major", "major description 1"],
  classStanding: ["class standing", "class_standing", "standing", "class"],
  studentType: ["student type", "student_type", "type"],
  dualEnrollment: [
    "dual enrollment",
    "dual_enrollment",
    "de",
    "dual enrollment indicator",
    "dual enrollment flag"
  ]
} as const;

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\-\/]+/g, " ")
    .replace(/[^\w ]/g, "")
    .replace(/\s+/g, " ");
}

function cleanString(value: unknown): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

function parseGpa(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(4.5, num));
}

function parseDualEnrollment(value: unknown): boolean | null {
  if (value == null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (["y", "yes", "true", "1", "de", "dual"].includes(normalized)) return true;
  if (["n", "no", "false", "0"].includes(normalized)) return false;
  return null;
}

function buildHeaderMap(headers: string[]) {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header)
  }));

  const map = new Map<string, string>();
  for (const [key, aliasList] of Object.entries(aliases)) {
    const match = normalizedHeaders.find((header) => aliasList.includes(header.normalized as never));
    if (match) map.set(key, match.original);
  }

  return map;
}

export function mapRosterRows(rawRows: RawRow[]): CanonicalRow[] {
  if (!rawRows.length) return [];
  const headerMap = buildHeaderMap(Object.keys(rawRows[0] ?? {}));

  return rawRows
    .map((row): CanonicalRow | null => {
      const firstName = cleanString(headerMap.get("firstName") ? row[headerMap.get("firstName")!] : null);
      const lastName = cleanString(headerMap.get("lastName") ? row[headerMap.get("lastName")!] : null);
      const explicitFullName = cleanString(
        headerMap.get("fullName") ? row[headerMap.get("fullName")!] : null
      );
      const fullName =
        explicitFullName ??
        ([firstName, lastName].filter(Boolean).join(" ").trim() || null);
      const pantherId = cleanString(headerMap.get("pantherId") ? row[headerMap.get("pantherId")!] : null);
      const gpa = parseGpa(headerMap.get("gpa") ? row[headerMap.get("gpa")!] : null);
      const campus = cleanString(headerMap.get("campus") ? row[headerMap.get("campus")!] : null);
      const majorDescription = cleanString(
        headerMap.get("majorDescription") ? row[headerMap.get("majorDescription")!] : null
      );
      const classStanding = cleanString(
        headerMap.get("classStanding") ? row[headerMap.get("classStanding")!] : null
      );
      const studentType = cleanString(
        headerMap.get("studentType") ? row[headerMap.get("studentType")!] : null
      );
      const explicitDualEnrollment = parseDualEnrollment(
        headerMap.get("dualEnrollment") ? row[headerMap.get("dualEnrollment")!] : null
      );
      const dualEnrollment =
        explicitDualEnrollment ??
        (studentType && /dual\s*enroll/i.test(studentType) ? true : null);

      if (!pantherId && !fullName && gpa == null && !campus && !majorDescription) {
        return null;
      }

      return {
        pantherId,
        firstName,
        lastName,
        fullName,
        gpa,
        campus,
        majorDescription,
        classStanding,
        studentType,
        dualEnrollment,
        raw: row
      };
    })
    .filter((row): row is CanonicalRow => row !== null);
}
