# todo-UNI

Gestor de tareas universitarias que se rellena solo: revisa periódicamente tu
correo y el Aulario de la universidad, usa IA para extraer entregas y fechas
límite, y te las organiza en agenda/calendario con recordatorios push — sin
tener que apuntar nada a mano.

## Cómo funciona

- **`api/cron/email`**: lee el buzón por IMAP (`imapflow` + `mailparser`) en
  busca de correos de profesores/plataformas con tareas o exámenes.
- **`api/cron/aulario`**: hace scraping del Aulario para detectar nuevas
  entregas y avisos.
- **Extracción con IA** (`src/lib/extract.ts`, Gemini vía `@google/genai`):
  convierte el texto libre del correo/aulario en tareas estructuradas
  (título, asignatura, fecha límite).
- **Deduplicación y relevancia** (`dedup.ts`, `relevance.ts`): evita crear
  tareas repetidas o irrelevantes (spam, avisos genéricos).
- **`api/cron/reminders`**: manda notificaciones push (`web-push`) antes de
  cada fecha límite.
- **Vistas**: agenda, calendario y listado por asignaturas.

## Stack

- Next.js 16 + React 19
- Drizzle ORM + Postgres
- Google Gemini (`@google/genai`) para extracción de tareas
- Web Push para recordatorios
- Cron jobs (Vercel Cron) para las tareas periódicas

## Desarrollo local

```bash
npm install
npm run dev
```

Necesitas un `.env.local` con las credenciales de IMAP, la API key de
Gemini, la conexión a Postgres y las claves VAPID para las notificaciones
push.

## Estado

Proyecto personal para automatizar mi propia gestión de tareas de la
carrera. Funciona con mi correo y mi universidad concretos — adaptar
`aulario.ts` sería necesario para usarlo con otra plataforma.
