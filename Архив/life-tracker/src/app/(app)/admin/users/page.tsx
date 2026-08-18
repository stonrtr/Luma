import { redirect } from "next/navigation";

// Управление пользователями переехало в «Оргсхему»
export default function AdminUsersPage() {
  redirect("/org");
}
