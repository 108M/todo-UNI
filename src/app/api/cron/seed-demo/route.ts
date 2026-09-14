import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { COURSES } from "@/lib/courses";

export const maxDuration = 30;

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function daysFromNow(days: number, hour = 23, minute = 59) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function demoTasks() {
  const [grc, infra, dev, auditoria] = COURSES;
  return [
    {
      title: "Entregar informe de análisis de riesgos",
      subject: grc.name,
      dueDate: daysFromNow(2),
      type: "entrega" as const,
      rawContent: "Informe individual sobre la matriz de riesgos del caso práctico visto en clase.",
    },
    {
      title: "Examen parcial: controles ISO 27001",
      subject: grc.name,
      dueDate: daysFromNow(9),
      type: "examen" as const,
      rawContent: null,
    },
    {
      title: "Práctica de segmentación de red",
      subject: infra.name,
      dueDate: daysFromNow(4),
      type: "entrega" as const,
      rawContent: "Subir capturas del firewall configurado y la memoria en PDF.",
    },
    {
      title: "Aviso: cambio de aula para el laboratorio",
      subject: infra.name,
      dueDate: null,
      type: "anuncio" as const,
      rawContent: "El laboratorio de esta semana se traslada al aula 2.3.",
    },
    {
      title: "Entrega del análisis SAST/DAST",
      subject: dev.name,
      dueDate: daysFromNow(6),
      type: "entrega" as const,
      rawContent: "Comparativa de hallazgos entre Semgrep y OWASP ZAP sobre la app de ejemplo.",
    },
    {
      title: "Revisar código de la práctica anterior",
      subject: dev.name,
      dueDate: daysFromNow(1),
      type: "otro" as const,
      rawContent: null,
    },
    {
      title: "Examen final de auditoría",
      subject: auditoria.name,
      dueDate: daysFromNow(14),
      type: "examen" as const,
      rawContent: null,
    },
    {
      title: "Entregar plan de auditoría del caso de estudio",
      subject: auditoria.name,
      dueDate: daysFromNow(-1),
      type: "entrega" as const,
      rawContent: "Entrega ya vencida en la demo, para mostrar cómo se marcan las tareas atrasadas.",
    },
  ];
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json(
      { error: "Este endpoint solo funciona con DEMO_MODE=true" },
      { status: 400 },
    );
  }

  const db = getDb();

  await db.delete(tasks);

  const rows = demoTasks().map((t, i) => ({
    title: t.title,
    subject: t.subject,
    dueDate: t.dueDate,
    type: t.type,
    source: "manual" as const,
    externalId: `demo-seed-${i}`,
    rawContent: t.rawContent,
  }));

  const inserted = await db.insert(tasks).values(rows).returning();

  return NextResponse.json({ demo: true, reset: true, inserted: inserted.length });
}
