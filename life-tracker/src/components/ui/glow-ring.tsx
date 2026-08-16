import { cn } from "@/lib/utils";

// Салатовое пульсирующее кольцо вокруг кнопки (иерархия CTA из рестайла).
// tier 1 — плавающая «+» (яркое свечение), tier 2 — главное действие экрана (компактное).
// Внутри должна лежать кнопка/триггер с заливкой фона карточки (bg-card), тогда кольцо
// видно как рамку 1.5px. Это простая обёртка — оборачивайте ею триггер, а не наоборот
// (не используйте как asChild-цель Radix).
export function GlowRing({
  tier = 2,
  className,
  children,
}: {
  tier?: 1 | 2;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn("inline-flex rounded-full p-[1.5px]", tier === 1 ? "glow-ring-1" : "glow-ring-2", className)}
      style={{ background: "#B7EE7A" }}
    >
      {children}
    </span>
  );
}
