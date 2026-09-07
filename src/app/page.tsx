import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { asc, sql } from "drizzle-orm";
import TaskBoard from "@/components/task-board";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = getDb();
  const rows = await db
    .select()
    .from(tasks)
    .orderBy(sql`${tasks.dueDate} is null`, asc(tasks.dueDate), asc(tasks.createdAt));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-3 py-6 sm:px-4 sm:py-16">
      <header className="mb-6 text-center sm:mb-10">
        <h1 className="font-display text-4xl tracking-wide sm:text-6xl lg:text-7xl">
          AULARIO TO-DO
        </h1>
        <p className="mt-2 text-sm text-ink-soft sm:text-base">
          Todo lo que te manda la uni, en un sitio. Sin entrar a Aulario.
        </p>
      </header>
      <TaskBoard
        initialTasks={rows.map((row) => ({
          ...row,
          dueDate: row.dueDate ? row.dueDate.toISOString() : null,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
