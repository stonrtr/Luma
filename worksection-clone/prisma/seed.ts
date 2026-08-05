import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "Password1!", 10);

  // --- Пользователи ---
  const admin = await db.user.upsert({
    where: { email: process.env.ADMIN_EMAIL ?? "admin@worksection.local" },
    update: {},
    create: {
      name: process.env.ADMIN_NAME ?? "Admin",
      email: process.env.ADMIN_EMAIL ?? "admin@worksection.local",
      passwordHash: password,
      role: "OWNER",
      title: "Руководитель проекта",
      hourlyRate: 40,
    },
  });

  const anna = await db.user.upsert({
    where: { email: "anna@worksection.local" },
    update: {},
    create: {
      name: "Анна Дизайнер",
      email: "anna@worksection.local",
      passwordHash: password,
      role: "MEMBER",
      title: "UI/UX дизайнер",
      hourlyRate: 30,
    },
  });

  const igor = await db.user.upsert({
    where: { email: "igor@worksection.local" },
    update: {},
    create: {
      name: "Игорь Разработчик",
      email: "igor@worksection.local",
      passwordHash: password,
      role: "MEMBER",
      title: "Full-stack разработчик",
      hourlyRate: 35,
    },
  });

  const client = await db.user.upsert({
    where: { email: "client@worksection.local" },
    update: {},
    create: {
      name: "Клиент Заказчиков",
      email: "client@worksection.local",
      passwordHash: password,
      role: "CLIENT",
      title: "Заказчик",
    },
  });

  // Чистим демо-проект, чтобы seed был идемпотентным
  await db.project.deleteMany({ where: { name: "Редизайн корпоративного сайта" } });

  // --- Проект ---
  const project = await db.project.create({
    data: {
      name: "Редизайн корпоративного сайта",
      description: "Полный редизайн сайта компании: новый брендинг, адаптив, CMS.",
      color: "#4f46e5",
      status: "ACTIVE",
      startDate: new Date("2026-07-01"),
      dueDate: new Date("2026-10-01"),
      budget: 15000,
      createdById: admin.id,
      members: {
        create: [
          { userId: admin.id, role: "MANAGER" },
          { userId: anna.id, role: "MEMBER" },
          { userId: igor.id, role: "MEMBER" },
          { userId: client.id, role: "CLIENT" },
        ],
      },
    },
  });

  // --- Теги ---
  const [tagDesign, tagDev, tagUrgent] = await Promise.all([
    db.tag.create({ data: { name: "Дизайн", color: "#ec4899", projectId: project.id } }),
    db.tag.create({ data: { name: "Разработка", color: "#0ea5e9", projectId: project.id } }),
    db.tag.create({ data: { name: "Срочно", color: "#ef4444", projectId: project.id } }),
  ]);

  // --- Вехи ---
  const m1 = await db.milestone.create({
    data: { title: "Готов дизайн-макет", dueDate: new Date("2026-08-01"), projectId: project.id },
  });
  const m2 = await db.milestone.create({
    data: { title: "Релиз v1", dueDate: new Date("2026-10-01"), projectId: project.id },
  });

  // --- Задачи ---
  const research = await db.task.create({
    data: {
      title: "Исследование и анализ конкурентов",
      description: "Собрать 10 референсов, проанализировать UX конкурентов.",
      status: "DONE",
      priority: "NORMAL",
      projectId: project.id,
      createdById: admin.id,
      completedAt: new Date("2026-07-10"),
      position: 0,
      assignees: { create: [{ userId: anna.id }] },
      tags: { create: [{ tagId: tagDesign.id }] },
    },
  });

  const design = await db.task.create({
    data: {
      title: "Дизайн главной страницы",
      description: "Макет главной в Figma: hero, услуги, кейсы, футер.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      projectId: project.id,
      createdById: admin.id,
      milestoneId: m1.id,
      startDate: new Date("2026-07-11"),
      dueDate: new Date("2026-07-28"),
      estimateHrs: 24,
      position: 0,
      assignees: { create: [{ userId: anna.id }] },
      tags: { create: [{ tagId: tagDesign.id }, { tagId: tagUrgent.id }] },
      checklist: {
        create: [
          { text: "Hero-блок", done: true, position: 0 },
          { text: "Блок услуг", done: true, position: 1 },
          { text: "Блок кейсов", done: false, position: 2 },
          { text: "Футер", done: false, position: 3 },
        ],
      },
    },
  });

  // Подзадачи дизайна
  await db.task.create({
    data: {
      title: "Мобильная версия главной",
      status: "TODO",
      priority: "NORMAL",
      projectId: project.id,
      createdById: anna.id,
      parentId: design.id,
      position: 0,
      assignees: { create: [{ userId: anna.id }] },
    },
  });
  await db.task.create({
    data: {
      title: "Тёмная тема",
      status: "TODO",
      priority: "LOW",
      projectId: project.id,
      createdById: anna.id,
      parentId: design.id,
      position: 1,
      assignees: { create: [{ userId: anna.id }] },
    },
  });

  const frontend = await db.task.create({
    data: {
      title: "Вёрстка главной страницы",
      description: "Свёрстать по макету на Next.js + Tailwind.",
      status: "TODO",
      priority: "HIGH",
      projectId: project.id,
      createdById: admin.id,
      milestoneId: m2.id,
      startDate: new Date("2026-07-29"),
      dueDate: new Date("2026-08-15"),
      estimateHrs: 40,
      position: 1,
      assignees: { create: [{ userId: igor.id }] },
      tags: { create: [{ tagId: tagDev.id }] },
    },
  });

  const cms = await db.task.create({
    data: {
      title: "Интеграция с CMS",
      status: "TODO",
      priority: "NORMAL",
      projectId: project.id,
      createdById: admin.id,
      startDate: new Date("2026-08-16"),
      dueDate: new Date("2026-09-10"),
      estimateHrs: 30,
      position: 2,
      assignees: { create: [{ userId: igor.id }] },
      tags: { create: [{ tagId: tagDev.id }] },
    },
  });

  // --- Зависимости: вёрстка после дизайна, CMS после вёрстки ---
  await db.taskDependency.create({
    data: { predecessorId: design.id, successorId: frontend.id },
  });
  await db.taskDependency.create({
    data: { predecessorId: frontend.id, successorId: cms.id },
  });

  // --- Комментарии ---
  await db.comment.create({
    data: {
      body: "Первый вариант hero-блока готов, посмотрите пожалуйста.",
      taskId: design.id,
      authorId: anna.id,
    },
  });
  await db.comment.create({
    data: {
      body: "Отлично, добавь чуть больше воздуха между секциями.",
      taskId: design.id,
      authorId: admin.id,
    },
  });

  // --- Учёт времени ---
  await db.timeLog.create({
    data: { minutes: 480, note: "Анализ конкурентов", taskId: research.id, userId: anna.id, loggedAt: new Date("2026-07-08") },
  });
  await db.timeLog.create({
    data: { minutes: 360, note: "Hero + услуги", taskId: design.id, userId: anna.id, loggedAt: new Date("2026-07-15") },
  });
  await db.timeLog.create({
    data: { minutes: 240, note: "Кейсы", taskId: design.id, userId: anna.id, loggedAt: new Date("2026-07-18") },
  });

  console.log("Seed завершён.");
  console.log("Вход: admin@worksection.local / Password1!");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
