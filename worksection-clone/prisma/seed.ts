import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

function mondayOf(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function main() {
  const password = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "Password1!", 10);
  const now = new Date();

  const admin = await db.user.upsert({
    where: { email: process.env.ADMIN_EMAIL ?? "admin@worksection.local" },
    update: {},
    create: {
      name: "Admin", firstName: "Admin", lastName: "",
      email: process.env.ADMIN_EMAIL ?? "admin@worksection.local",
      passwordHash: password, role: "OWNER", title: "Керівник проєкту",
      functions: "Керує командою, ставить цілі та KPI, перевіряє задачі.",
      hourlyRate: 40, weeklyHours: 40, locale: "uk",
    },
  });

  const anna = await db.user.upsert({
    where: { email: "anna@worksection.local" },
    update: {},
    create: {
      name: "Анна Дизайнер", firstName: "Анна", lastName: "Дизайнер",
      email: "anna@worksection.local", passwordHash: password, role: "MEMBER",
      title: "UI/UX дизайнер", functions: "Дизайн інтерфейсів, макети, прототипи.",
      hourlyRate: 30, weeklyHours: 40, locale: "uk", managerId: admin.id,
    },
  });

  const igor = await db.user.upsert({
    where: { email: "igor@worksection.local" },
    update: {},
    create: {
      name: "Игорь Разработчик", firstName: "Ігор", lastName: "Розробник",
      email: "igor@worksection.local", passwordHash: password, role: "MEMBER",
      title: "Full-stack розробник", functions: "Розробка фронтенду й бекенду, інтеграції.",
      hourlyRate: 35, weeklyHours: 20, locale: "uk", managerId: admin.id, // неполный день
    },
  });

  const client = await db.user.upsert({
    where: { email: "client@worksection.local" },
    update: {},
    create: {
      name: "Клиент Заказчиков", firstName: "Клієнт", lastName: "Замовників",
      email: "client@worksection.local", passwordHash: password, role: "CLIENT",
      title: "Замовник", locale: "uk", managerId: admin.id,
    },
  });

  await db.project.deleteMany({ where: { name: "Редизайн корпоративного сайту" } });
  await db.project.deleteMany({ where: { name: "Редизайн корпоративного сайта" } });

  const project = await db.project.create({
    data: {
      name: "Редизайн корпоративного сайту",
      description: "Повний редизайн сайту компанії: новий брендинг, адаптив, CMS.",
      color: "#4f46e5", status: "ACTIVE",
      startDate: new Date("2026-07-01"), dueDate: new Date("2026-10-01"),
      budget: 15000, createdById: admin.id,
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

  const [tagDesign, tagDev, tagUrgent] = await Promise.all([
    db.tag.create({ data: { name: "Дизайн", color: "#ec4899", projectId: project.id } }),
    db.tag.create({ data: { name: "Розробка", color: "#0ea5e9", projectId: project.id } }),
    db.tag.create({ data: { name: "Терміново", color: "#ef4444", projectId: project.id } }),
  ]);

  const m1 = await db.milestone.create({ data: { title: "Готовий дизайн-макет", dueDate: new Date("2026-08-01"), projectId: project.id } });
  const m2 = await db.milestone.create({ data: { title: "Реліз v1", dueDate: new Date("2026-10-01"), projectId: project.id } });

  const research = await db.task.create({
    data: {
      title: "Дослідження та аналіз конкурентів", description: "Зібрати 10 референсів, проаналізувати UX конкурентів.",
      status: "DONE", priority: 5, projectId: project.id, createdById: admin.id,
      completedAt: new Date("2026-07-10"), plannedMinutes: 180, position: 0,
      assignees: { create: [{ userId: anna.id }] }, tags: { create: [{ tagId: tagDesign.id }] },
    },
  });

  const design = await db.task.create({
    data: {
      title: "Дизайн головної сторінки", description: "Макет головної у Figma: hero, послуги, кейси, футер.",
      status: "IN_PROGRESS", priority: 8, projectId: project.id, createdById: admin.id, milestoneId: m1.id,
      assignedByManager: true, startDate: new Date("2026-07-11"), dueDate: new Date("2026-07-28"),
      scheduledAt: new Date("2026-08-06T10:00:00"), plannedMinutes: 120, position: 0,
      assignees: { create: [{ userId: anna.id }] }, tags: { create: [{ tagId: tagDesign.id }, { tagId: tagUrgent.id }] },
      checklist: { create: [
        { text: "Hero-блок", done: true, position: 0 },
        { text: "Блок послуг", done: true, position: 1 },
        { text: "Блок кейсів", done: false, position: 2 },
        { text: "Футер", done: false, position: 3 },
      ] },
    },
  });

  await db.task.create({ data: { title: "Мобільна версія головної", status: "TODO", priority: 6, projectId: project.id, createdById: anna.id, parentId: design.id, position: 0, assignees: { create: [{ userId: anna.id }] } } });
  await db.task.create({ data: { title: "Темна тема", status: "TODO", priority: 3, projectId: project.id, createdById: anna.id, parentId: design.id, position: 1, assignees: { create: [{ userId: anna.id }] } } });

  const frontend = await db.task.create({
    data: {
      title: "Верстка головної сторінки", description: "Зверстати за макетом на Next.js + Tailwind.",
      status: "TODO", priority: 8, projectId: project.id, createdById: admin.id, milestoneId: m2.id,
      assignedByManager: true, startDate: new Date("2026-07-29"), dueDate: new Date("2026-08-15"),
      plannedMinutes: 180, position: 1, assignees: { create: [{ userId: igor.id }] }, tags: { create: [{ tagId: tagDev.id }] },
    },
  });

  const cms = await db.task.create({
    data: {
      title: "Інтеграція з CMS", status: "TODO", priority: 5, projectId: project.id, createdById: admin.id,
      startDate: new Date("2026-08-16"), dueDate: new Date("2026-09-10"), plannedMinutes: 180, position: 2,
      assignees: { create: [{ userId: igor.id }] }, tags: { create: [{ tagId: tagDev.id }] },
    },
  });

  // Просроченная задача-идея
  await db.task.create({
    data: { title: "Ідея: інтерактивний онбординг", status: "IDEA", priority: 4, projectId: project.id, createdById: anna.id, plannedMinutes: 60, position: 0, assignees: { create: [{ userId: anna.id }] } },
  });

  await db.taskDependency.create({ data: { predecessorId: design.id, successorId: frontend.id } });
  await db.taskDependency.create({ data: { predecessorId: frontend.id, successorId: cms.id } });

  await db.comment.create({ data: { body: "Перший варіант hero-блоку готовий, подивіться будь ласка.", taskId: design.id, authorId: anna.id } });
  await db.comment.create({ data: { body: "Чудово, додай трохи більше повітря між секціями.", taskId: design.id, authorId: admin.id } });

  await db.timeLog.create({ data: { minutes: 480, note: "Аналіз конкурентів", taskId: research.id, userId: anna.id, loggedAt: new Date("2026-07-08") } });
  await db.timeLog.create({ data: { minutes: 360, note: "Hero + послуги", taskId: design.id, userId: anna.id, loggedAt: new Date("2026-07-15") } });
  await db.timeLog.create({ data: { minutes: 240, note: "Кейси", taskId: design.id, userId: anna.id, loggedAt: new Date("2026-07-18") } });

  // Уведомление о задаче от руководителя
  await db.notification.create({ data: { type: "assignment", message: `${admin.name} поставив вам задачу «Дизайн головної сторінки»`, link: `/tasks/${design.id}`, recipientId: anna.id, actorId: admin.id } });

  // Цели и KPI месяца для Анны
  const y = now.getFullYear(); const mo = now.getMonth();
  await db.monthlyGoal.createMany({ data: [
    { userId: anna.id, year: y, month: mo, text: "Завершити редизайн головної та 3 внутрішніх сторінок" },
    { userId: anna.id, year: y, month: mo, text: "Оновити дизайн-систему компонентів" },
  ] });
  await db.kpi.createMany({ data: [
    { userId: anna.id, year: y, month: mo, title: "Готових макетів", target: "8", actualValue: "5", achieved: false },
    { userId: anna.id, year: y, month: mo, title: "Оцінка задоволеності замовника", target: "4.5", actualValue: null, achieved: null },
  ] });

  // Недельный план Анны
  const wk = mondayOf(now);
  await db.weeklyPlanItem.createMany({ data: [
    { userId: anna.id, weekStart: wk, title: "Домалювати блок кейсів", priority: 9, order: 0, projectId: project.id },
    { userId: anna.id, weekStart: wk, title: "Футер головної", priority: 7, order: 1, projectId: project.id },
    { userId: anna.id, weekStart: wk, title: "Мобільна версія", priority: 6, order: 2, projectId: project.id },
    { userId: anna.id, weekStart: wk, title: "Дизайн-система: кнопки", priority: 4, order: 3 },
  ] });

  // Звонки
  await db.call.createMany({ data: [
    { title: "Синк з командою", scheduledAt: new Date(new Date(now).setHours(11, 0, 0, 0)), durationMin: 30, userId: admin.id },
    { title: "Демо замовнику", scheduledAt: new Date(new Date(now).setHours(15, 30, 0, 0)), durationMin: 45, userId: anna.id },
  ] });

  // Регулярная задача
  await db.recurringTask.create({ data: { title: "Щоденний стендап", priority: 5, plannedMinutes: 15, frequency: "WEEKLY", weekdays: "1,2,3,4,5", assigneeId: anna.id, createdById: admin.id } });

  // Файлы
  const f1 = await db.fileLink.create({ data: { name: "Бренд-бук.pdf", url: "https://example.com/brandbook.pdf", kind: "LINK", ownerId: anna.id, note: "Гайдлайни бренду" } });
  await db.fileLink.create({ data: { name: "Договір.pdf", url: "https://example.com/contract.pdf", kind: "LINK", ownerId: admin.id } });
  // важный чужой файл, расшарен Анне
  await db.fileShare.create({ data: { fileId: f1.id, userId: igor.id } });

  console.log("Seed завершено. Вхід: admin@worksection.local / Password1!");
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
