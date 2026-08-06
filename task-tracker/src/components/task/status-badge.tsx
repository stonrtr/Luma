import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/generated/prisma/client";

const labels: Record<TaskStatus, string> = {
  IDEA: "Ідея",
  TODO: "Зробити",
  IN_PROGRESS: "В роботі",
  TO_APPROVE: "Погодити",
  DONE: "Зроблено",
  PAUSED: "На паузі",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant="outline">{labels[status]}</Badge>;
}

export const statusLabels = labels;
