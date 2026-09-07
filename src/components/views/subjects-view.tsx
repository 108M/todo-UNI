import type { TaskDTO } from "@/lib/types";
import { COURSES, UNASSIGNED_COLOR } from "@/lib/courses";
import TaskRow from "../task-row";

function sortByDue(tasks: TaskDTO[]) {
  return [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return a.createdAt.localeCompare(b.createdAt);
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export default function SubjectsView({
  tasks,
  onToggle,
  onDelete,
}: {
  tasks: TaskDTO[];
  onToggle: (task: TaskDTO) => void;
  onDelete: (task: TaskDTO) => void;
}) {
  const pending = tasks.filter((t) => !t.done);
  const knownNames = new Set(COURSES.map((c) => c.name));
  const groups = [
    ...COURSES.map((c) => ({ name: c.name, color: c.color })),
    { name: null, color: UNASSIGNED_COLOR },
  ];

  return (
    <div className="flex flex-col gap-8">
      {groups.map(({ name, color }) => {
        const items = sortByDue(
          pending.filter((t) =>
            name === null ? !t.subject || !knownNames.has(t.subject) : t.subject === name,
          ),
        );
        return (
          <section key={name ?? "sin-asignatura"} className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 font-display text-3xl tracking-wide">
              <span
                className="h-4 w-4 shrink-0 border-2 border-ink"
                style={{ background: color }}
                aria-hidden
              />
              {(name ?? "SIN ASIGNATURA").toUpperCase()}
              <span className="text-base font-sans font-normal text-ink-soft">
                ({items.length})
              </span>
            </h3>
            {items.length === 0 ? (
              <p className="panel p-4 text-sm text-ink-soft">Sin tareas pendientes.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
