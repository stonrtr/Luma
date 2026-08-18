export function Tick() {
  return (
    <svg viewBox="0 0 12 12" fill="none">
      <path d="M2 6.3 4.6 9 10 3.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Задача — галочка */
export function TaskIcon() {
  return (
    <svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 7.5 6 11l5.5-7.5" />
    </svg>
  );
}

/** Привычка — циклическая стрелка (повтор) */
export function HabitIcon() {
  return (
    <svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.6 7a4.6 4.6 0 1 1-1.5-3.4" />
      <path d="M11.8 2.4v2.4H9.4" />
    </svg>
  );
}
