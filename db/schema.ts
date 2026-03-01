import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  real
} from "drizzle-orm/pg-core";
export {
  user,
  session,
  account,
  verification,
  userRelations,
  sessionRelations,
  accountRelations
} from "../auth-schema";

export const datasets = pgTable(
  "datasets",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    semesterLabel: text("semester_label").notNull(),
    sourceFileName: text("source_file_name").notNull(),
    sourceMimeType: text("source_mime_type"),
    rowCount: integer("row_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    createdAtIdx: index("datasets_created_at_idx").on(table.createdAt),
    semesterLabelIdx: index("datasets_semester_label_idx").on(table.semesterLabel)
  })
);

export const auditActionEnum = pgEnum("audit_action", ["UPLOAD", "RENAME", "DELETE"]);
export const roleEnum = pgEnum("user_role", ["admin", "viewer"]);

export const studentRecords = pgTable(
  "student_records",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    datasetId: varchar("dataset_id", { length: 32 })
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    pantherId: text("panther_id"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    fullName: text("full_name"),
    gpa: real("gpa"),
    campus: text("campus"),
    majorDescription: text("major_description"),
    classStanding: text("class_standing"),
    studentType: text("student_type"),
    dualEnrollment: boolean("dual_enrollment"),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    datasetIdx: index("student_records_dataset_id_idx").on(table.datasetId),
    datasetCampusIdx: index("student_records_dataset_campus_idx").on(table.datasetId, table.campus),
    datasetMajorIdx: index("student_records_dataset_major_idx").on(
      table.datasetId,
      table.majorDescription
    ),
    datasetStandingIdx: index("student_records_dataset_standing_idx").on(
      table.datasetId,
      table.classStanding
    ),
    datasetStudentTypeIdx: index("student_records_dataset_student_type_idx").on(
      table.datasetId,
      table.studentType
    ),
    datasetDualIdx: index("student_records_dataset_dual_idx").on(table.datasetId, table.dualEnrollment),
    datasetGpaIdx: index("student_records_dataset_gpa_idx").on(table.datasetId, table.gpa),
    datasetPantherIdx: index("student_records_dataset_panther_idx").on(table.datasetId, table.pantherId),
    datasetFullNameIdx: index("student_records_dataset_full_name_idx").on(table.datasetId, table.fullName)
  })
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    datasetId: varchar("dataset_id", { length: 32 }).references(() => datasets.id, {
      onDelete: "set null"
    }),
    action: auditActionEnum("action").notNull(),
    actorName: text("actor_name").notNull(),
    actorRole: roleEnum("actor_role").notNull().default("admin"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    createdAtIdx: index("audit_events_created_at_idx").on(table.createdAt),
    datasetIdx: index("audit_events_dataset_id_idx").on(table.datasetId),
    actionIdx: index("audit_events_action_idx").on(table.action)
  })
);

export const platformUserRoles = pgTable(
  "platform_user_roles",
  {
    email: text("email").primaryKey(),
    role: roleEnum("role").notNull().default("viewer"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    roleIdx: index("platform_user_roles_role_idx").on(table.role)
  })
);
