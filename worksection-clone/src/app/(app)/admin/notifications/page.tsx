import { redirect } from "next/navigation";

// Настройки уведомлений переехали в «Настройки»
export default function AdminNotificationsPage() {
  redirect("/settings");
}
