import {
  boolean,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const taskSource = ["manual", "email", "aulario"] as const;
export type TaskSource = (typeof taskSource)[number];

export const taskType = ["entrega", "examen", "anuncio", "otro"] as const;
export type TaskType = (typeof taskType)[number];

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    subject: text("subject"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    type: text("type").notNull().default("otro"),
    source: text("source").notNull().default("manual"),
    rawContent: text("raw_content"),
    done: boolean("done").notNull().default(false),
    reminded2d: boolean("reminded_2d").notNull().default(false),
    reminded1d: boolean("reminded_1d").notNull().default(false),
    remindedToday: boolean("reminded_today").notNull().default(false),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("tasks_external_id_idx").on(table.externalId)],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
