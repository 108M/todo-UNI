import { sendPushToAll } from "./push";

export async function notifyNewTasks(titles: string[]) {
  if (titles.length === 0) return;
  const body = titles.length === 1 ? titles[0] : titles.map((t) => `• ${t}`).join("\n");
  await sendPushToAll({
    title: titles.length === 1 ? "Nueva tarea" : `${titles.length} tareas nuevas`,
    body,
    url: process.env.APP_URL,
  });
}

export async function notify(title: string, body: string) {
  await sendPushToAll({ title, body, url: process.env.APP_URL });
}
