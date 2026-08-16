-- Задача может входить в план разных недель: снимаем глобальный unique с taskId
DROP INDEX IF EXISTS "WeeklyPlanItem_taskId_key";
