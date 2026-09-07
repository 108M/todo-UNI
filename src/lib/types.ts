export type TaskDTO = {
  id: number;
  title: string;
  subject: string | null;
  dueDate: string | null;
  type: string;
  source: string;
  rawContent: string | null;
  done: boolean;
  externalId: string | null;
  createdAt: string;
};
