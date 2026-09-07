export type Course = {
  slug: string;
  name: string;
  color: string;
  // Código numérico del site de Aulario (ej. "721103" en "2026_0_721103_1_G").
  siteCode: string;
};

// Asignaturas reales del máster, en el orden en que aparecen en Aulario.
// Los colores son la paleta categórica validada (orden fijo, no ciclar).
export const COURSES: Course[] = [
  {
    slug: "grc",
    name: "Gobernanza, riesgo y cumplimiento normativo",
    color: "#2a78d6",
    siteCode: "721101",
  },
  {
    slug: "seg-infraestructuras",
    name: "Seguridad en infraestructuras",
    color: "#eb6834",
    siteCode: "721102",
  },
  {
    slug: "seg-desarrollo",
    name: "Seguridad en el desarrollo de aplicaciones",
    color: "#1baf7a",
    siteCode: "721103",
  },
  {
    slug: "auditoria",
    name: "Auditoría de seguridad",
    color: "#eda100",
    siteCode: "721104",
  },
];

// El siteId de Aulario (ej. "2026_0_721103_1_G") siempre contiene el código
// de la asignatura — es una fuente 100% fiable, sin depender de la IA.
export function courseForSiteId(siteId: string): Course | null {
  return COURSES.find((c) => siteId.includes(c.siteCode)) ?? null;
}

export const UNASSIGNED_COLOR = "#898781";

export function colorForSubject(subject: string | null): string {
  if (!subject) return UNASSIGNED_COLOR;
  const course = COURSES.find((c) => c.name === subject);
  return course ? course.color : UNASSIGNED_COLOR;
}

// Los avisos automáticos de Aulario siempre nombran el curso como
// `<codigo_de_sitio> <Nombre de la asignatura>` (ej. "26_0_721103_1_G
// Seguridad en el desarrollo de aplicaciones"). Detectarlo por regex es más
// fiable que depender de que la IA lo capte en un texto largo.
const SITE_NAME_RE = /\b[\w.]+_\d+_\d+_\d+_[A-Za-z]\s+([^"“”\n]+)/;

export function detectCourseInText(text: string): string | null {
  const match = text.match(SITE_NAME_RE);
  const candidate = match?.[1]?.trim();
  if (candidate) {
    const bySite = COURSES.find((c) => candidate.startsWith(c.name));
    if (bySite) return bySite.name;
  }
  const byMention = COURSES.find((c) => text.includes(c.name));
  return byMention ? byMention.name : null;
}
