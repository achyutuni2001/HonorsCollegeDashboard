import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { datasets, studentRecords } from "@/db/schema";
import { mapRosterRows } from "@/lib/roster-mapping";

type UploadInput = {
  fileName: string;
  mimeType?: string;
  semesterLabel: string;
  fileBuffer: Buffer;
};

export async function ingestRosterDataset(input: UploadInput) {
  const workbook = XLSX.read(input.fileBuffer, { type: "buffer", cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("No worksheet found in uploaded file.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    raw: true
  });
  const rows = mapRosterRows(rawRows);

  const datasetId = crypto.randomUUID().replace(/-/g, "");
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(datasets).values({
      id: datasetId,
      semesterLabel: input.semesterLabel,
      sourceFileName: input.fileName,
      sourceMimeType: input.mimeType,
      rowCount: rows.length,
      createdAt: now,
      updatedAt: now
    });

    const chunkSize = 1000;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      if (!chunk.length) continue;
      await tx.insert(studentRecords).values(
        chunk.map((row) => ({
          datasetId,
          pantherId: row.pantherId,
          firstName: row.firstName,
          lastName: row.lastName,
          fullName: row.fullName,
          gpa: row.gpa,
          campus: row.campus,
          majorDescription: row.majorDescription,
          classStanding: row.classStanding,
          studentType: row.studentType,
          dualEnrollment: row.dualEnrollment,
          raw: row.raw
        }))
      );
    }
  });

  return {
    id: datasetId,
    semesterLabel: input.semesterLabel,
    rowCount: rows.length
  };
}
