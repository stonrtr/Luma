/** Русская форма слова по числу: plural(2, "прыжок","прыжка","прыжков") → "прыжка" */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return few;
  return many;
}

export function jumpsText(n: number): string {
  return `${n} ${plural(n, "прыжок", "прыжка", "прыжков")}`;
}

export function stepsText(n: number): string {
  return `${n} ${plural(n, "шаг", "шага", "шагов")}`;
}
