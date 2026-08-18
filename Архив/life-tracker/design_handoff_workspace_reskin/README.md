# Handoff: рестайл Workspace (worksection-clone)

## Что это

Новое визуальное оформление для существующего приложения `worksection-clone` (Next.js 15 App Router + Tailwind v4 + shadcn/ui). **Разметка и структура экранов не менялись** — переносятся только цвета, шрифт и несколько мелких компонентов (индикатор приоритета, чипы, кнопки).

## О файлах в пакете

HTML-файлы (`*.dc.html`) — это **дизайн-референсы**, а не код для копирования. Они воспроизводят текущие экраны приложения 1:1 по геометрии (отступы, размеры, порядок элементов взяты из исходных `.tsx`) и показывают, как должно выглядеть приложение после рестайла. Задача — применить это оформление к существующим React-компонентам, а не заменять их HTML.

Открывать файлы можно прямо в браузере (нужен рядом `support.js` и `logo.png`).

## Фиделити

**High-fidelity.** Все цвета, размеры и типографика финальные — значения ниже можно переносить дословно.

---

## Шаг 1. Токены (`src/app/globals.css`)

Заменить блок `:root`. Это даёт ~80% результата — вся Tailwind-разметка (`bg-card`, `text-muted-foreground`, `border`) подхватывает автоматически.

```css
:root {
  --radius: 0.6rem;
  --background: #F3F4EF;
  --foreground: #12240F;
  --card: #FFFFFF;
  --card-foreground: #12240F;
  --popover: #FFFFFF;
  --popover-foreground: #12240F;
  --primary: #C6E89B;            /* лайм — заливка активных элементов */
  --primary-foreground: #12240F; /* тёмно-зелёный текст на лайме */
  --secondary: #EEF1E7;
  --secondary-foreground: #12240F;
  --muted: #EEF1E7;
  --muted-foreground: #6B7A66;
  --accent: #EAF4DA;
  --accent-foreground: #3D6B26;
  --destructive: #B24239;
  --destructive-foreground: #FFFFFF;
  --border: #E3E6DD;
  --input: #E3E6DD;
  --ring: #3D6B26;
  --sidebar: #FFFFFF;
  --sidebar-foreground: #12240F;
}
```

Важно: `--primary` теперь светлый, а `--primary-foreground` — тёмный (раньше было наоборот). Проверить места, где текст красится в `text-primary` на белом фоне — там нужен `#3D6B26` (в токенах это `--accent-foreground`), а не `--primary`.

### Тёмная тема (`.dark`)

Реверсивная версия того же стиля — файлы `* Dark.dc.html` в пакете.

```css
.dark {
  --background: #0A130D;
  --foreground: #E8EFE3;
  --card: #131C15;
  --card-foreground: #E8EFE3;
  --popover: #131C15;
  --popover-foreground: #E8EFE3;
  --primary: #C6E89B;
  --primary-foreground: #0A130D;
  --secondary: #16211A;
  --secondary-foreground: #E8EFE3;
  --muted: #16211A;
  --muted-foreground: #8B9C86;
  --accent: #1D2F1B;
  --accent-foreground: #A9D97F;
  --destructive: #E58279;
  --destructive-foreground: #0A130D;
  --border: #232E20;
  --input: #232E20;
  --ring: #A9D97F;
  --sidebar: #131C15;
  --sidebar-foreground: #E8EFE3;
}
```

Два эффекта, которых нет в токенах:

1. **Свечение на фоне.** На корневом контейнере (`src/app/(app)/layout.tsx`, внешний `div`) в тёмной теме:
```
background-color:#0A130D;
background-image:
  radial-gradient(1200px 520px at 15% -60px, rgba(140,215,120,.34), transparent 68%),
  radial-gradient(1000px 460px at 70% -80px, rgba(95,191,160,.26), transparent 70%);
background-repeat:no-repeat;
```
2. **Стеклянная шапка.** `TopNav` в тёмной теме: `bg-[rgba(10,19,13,.55)] backdrop-blur-md border-b border-[rgba(198,232,155,.10)]` вместо `bg-sidebar`.

Статусы и акценты в тёмной теме: точки IDEA `#9B87E8`, TODO `#6E7C6A`, IN_PROGRESS `#5FBFA0`, TO_REVIEW `#D8B25E`, DONE `#C6E89B`; тон приоритета — `#E0844A` / `#A9D97F` / `#6E7C6A`; аватары `#22331F` / `#A9D97F`; просрочка — рамка `#4A2528`, фон `#2A1618`, текст `#E58279`.

## Шаг 2. Шрифт

Manrope 400/500/600/700 через `next/font/google` в `src/app/layout.tsx`, затем в `globals.css`:

```css
--font-sans: var(--font-manrope), ui-sans-serif, system-ui, sans-serif;
```

Капслок и разрядка (`uppercase`, `tracking-wide`) в интерфейсе **не используются** — если встретятся, убрать.

## Шаг 3. Точечные правки компонентов

Токенами не решается:

**`src/lib/domain.ts` — `priorityStyle(p)`**
Вместо квадрата с заливкой — кружок с обводкой. Новая функция возвращает цвет, а форма задаётся в местах использования:

```ts
export function priorityTone(p: number): string {
  if (p >= 7) return "#C25A28";  // оранжевый
  if (p >= 5) return "#3D6B26";  // зелёный
  return "#94A18F";              // серый
}
```

**`src/components/board/task-card.tsx`** — бейдж приоритета:
```
size-[19px] rounded-full border-[1.25px] text-[10px] font-semibold
```
цвет обводки и текста = `priorityTone(task.priority)`, фон прозрачный. Те же правила в `weekly-plan.tsx`, `inline-controls.tsx` (`PriorityPopover`, там `size-6`) и в архиве недельных планов.

**Статусные цвета — `TASK_STATUS_DOT` / `TASK_STATUS_STYLE`:**

| Статус | Точка | Чип (фон / текст) |
|---|---|---|
| IDEA | `#8E7BD6` | `#EDE7FA` / `#5B47A6` |
| TODO | `#7E8C79` | `#EEF1E7` / `#6B7A66` |
| IN_PROGRESS | `#5AA9C9` | `#DCEAF6` / `#2C5E7A` |
| TO_REVIEW | `#D8B25E` | `#FBE6D6` / `#A0561F` |
| DONE | `#C6E89B` | `#EAF4DA` / `#3D6B26` |

**Зелёные кнопки** — `ExportTasksButton` (`bg-emerald-600`) и `QuickAddFab` (`bg-emerald-500`): заменить на `bg-primary text-primary-foreground hover:bg-primary/90`.

**`src/app/(app)/org/page.tsx`** — должность сотрудника стала чипом:
```
inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground
```

**`src/app/(app)/team/page.tsx`** — счётчик «Активні» остаётся синим (`bg-[#DCEAF6] text-[#2C5E7A]`), «Завершені» — зелёным (`bg-accent text-accent-foreground`).

**Архивные `<details>` в планировании** — добавить `chevron-down`, поворачивающийся на 180° при `open` (в исходнике стрелки нет).

---

## Иерархия кнопок

Салатовый `#B7EE7A` — единый акцент; уровни различаются свечением.

| Уровень | Где | Стиль |
|---|---|---|
| **tier 1** | плавающая «+» | капсула/круг: заливка `--card`, кольцо 1.5px `#B7EE7A`, пульсирующее свечение `btnglow` (6s) |
| **tier 2** | главное действие экрана («Новый проект», «Імпорт задач», «Затвердити», «Додати») | то же кольцо, свечение вдвое компактнее — `btnglow2` |
| **tier 3** | вторичные действия («Завантажити файл», «Змінити пароль», «Відключити», «Друк / PDF») | сплошная салатовая капсула `#B7EE7A`, текст `#1E3A12`, без свечения |
| нейтральная | отмена, сброс | капсула с обводкой `--border`, текст `--foreground` |
| разрушающая | удаление, «Не досягнуто» | фон `#FDEDED` / текст `#B24239` (тёмная тема: `#2A1618` / `#E58279`) |

Активный пункт меню и активная вкладка вида — салатовый овал `#B7EE7A` с текстом `#1E3A12` (radius 9999px, padding 6px 12px / 4px 14px).

```css
@keyframes btnglow {
  0%, 100% { box-shadow: 0 0 18px 2px rgba(183,238,122,.60), 0 10px 46px 8px rgba(183,238,122,.42), 0 22px 80px 16px rgba(160,225,100,.28); }
  50%      { box-shadow: 0 0 26px 4px rgba(195,245,135,.85), 0 14px 60px 12px rgba(183,238,122,.58), 0 28px 100px 22px rgba(160,225,100,.38); }
}
@keyframes btnglow2 {
  0%, 100% { box-shadow: 0 0 8px 1px rgba(183,238,122,.45), 0 4px 16px 2px rgba(183,238,122,.22); }
  50%      { box-shadow: 0 0 12px 2px rgba(195,245,135,.60), 0 6px 22px 4px rgba(183,238,122,.32); }
}
```

Кольцо реализовано обёрткой: `<span>` с `padding:1.5px; background:#B7EE7A; border-radius:9999px` и анимацией, внутри — кнопка с заливкой фона карточки. В React достаточно обёртки-компонента `<GlowButton tier={1|2}>`.

Контейнер навигации в шапке: `overflow-x:auto` + `padding:14px 0; margin:-14px 0` и скрытый скроллбар (`scrollbar-width:none`), иначе свечение активного пункта обрезается.

## Дополнительные значения

- Радиусы: карточки/панели `12px`, кнопки и поля `6px`, чипы `9999px`
- Тени: карточки `0 1px 2px rgba(18,36,15,.05)`, FAB `0 8px 24px rgba(18,36,15,.18)`
- Полосы прогресса: трек `#EEF1E7`, заливка `#C6E89B` (перерасход — `#B24239`)
- Аватары: фон `#DCEFBE`, текст `#3D6B26`, обводка в стопке `2px solid #FFFFFF`
- Просроченная карточка: рамка `#F0C4C4`, фон `#FDEDED`, бейдж `#FADCDC` / `#B24239`
- Гант: бары по статусам (см. таблицу), выходные `#EEF1E7`, линия «сегодня» `rgba(178,66,57,.7)`, вехи `#8E7BD6`

## Экраны в пакете

| Файл | Соответствует |
|---|---|
| `Workspace Board.dc.html` | `/` — канбан |
| `Calendar Week.dc.html` | `/?view=calendar` |
| `Archive.dc.html` | `/?view=archive` |
| `Planning.dc.html` | `/planning` |
| `Projects.dc.html` | `/projects` |
| `Project Board.dc.html` | `/projects/[projectId]` |
| `Project Gantt.dc.html` | `/projects/[projectId]?view=gantt` |
| `Files.dc.html` | `/files` |
| `Org.dc.html` | `/org` |
| `Team.dc.html` | `/team` |
| `Reports.dc.html` | `/reports` |
| `Task Detail.dc.html` | `/tasks/[taskId]` |
| `Settings.dc.html` | `/settings` |
| `Login.dc.html` | `/login` |

Тёмные версии — те же имена с суффиксом ` Dark` (например `Planning Dark.dc.html`).

## Ассеты

`logo.png` — из `public/logo.png` самого проекта, не менялся. Иконки — lucide (те же, что уже используются в коде); в HTML они подключены через CDN только для превью.
