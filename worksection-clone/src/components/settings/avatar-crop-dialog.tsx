"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";

// Кадрирование аватара перед загрузкой: перетаскивание (мышь/палец) + зум.
// Результат — квадрат 512×512 (JPEG), режется на клиенте через canvas.
const VIEW = 288; // размер окна кадрирования, px
const OUT = 512; // размер итоговой картинки, px

export function AvatarCropDialog({
  src, onCancel, onSave, saving, title,
}: {
  src: string | null; // objectURL выбранного файла
  onCancel: () => void;
  onSave: (file: File) => void;
  saving?: boolean;
  title: string;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1); // 1..4 поверх cover-масштаба
  const [off, setOff] = useState({ x: 0, y: 0 }); // смещение центра картинки от центра окна
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Сброс при новом файле
  useEffect(() => { setZoom(1); setOff({ x: 0, y: 0 }); setNatural(null); }, [src]);

  if (!src) return null;

  // cover-масштаб: картинка всегда закрывает окно целиком
  const s0 = natural ? Math.max(VIEW / natural.w, VIEW / natural.h) : 1;
  const s = s0 * zoom;
  const dw = natural ? natural.w * s : VIEW;
  const dh = natural ? natural.h * s : VIEW;
  const maxX = Math.max(0, (dw - VIEW) / 2);
  const maxY = Math.max(0, (dh - VIEW) / 2);
  const clamp = (v: number, m: number) => Math.min(m, Math.max(-m, v));
  const ox = clamp(off.x, maxX);
  const oy = clamp(off.y, maxY);

  function setZoomClamped(z: number) {
    setZoom(Math.min(4, Math.max(1, z)));
    // после смены зума офсет пере-ограничится на рендере
  }

  async function confirm() {
    const img = imgRef.current;
    if (!img || !natural) return;
    // Обратное преобразование: какой участок исходника виден в окне
    const srcSize = VIEW / s;
    const sx = natural.w / 2 - ox / s - srcSize / 2;
    const sy = natural.h / 2 - oy / s - srcSize / 2;
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, OUT, OUT);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (blob) onSave(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

        <div className="flex flex-col items-center gap-3">
          {/* Окно кадрирования: тянем картинку, круг — что попадёт на аву */}
          <div
            className="relative touch-none overflow-hidden rounded-lg border bg-muted select-none"
            style={{ width: VIEW, height: VIEW, cursor: drag.current ? "grabbing" : "grab" }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, ox, oy };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setOff({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
            }}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
            onWheel={(e) => setZoomClamped(zoom - Math.sign(e.deltaY) * 0.15)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className="pointer-events-none absolute max-w-none"
              style={{ width: dw, height: dh, left: VIEW / 2 - dw / 2 + ox, top: VIEW / 2 - dh / 2 + oy }}
            />
            {/* затемнение вне круга */}
            <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,.45)", borderRadius: "9999px", margin: 8 }} />
          </div>

          {/* Зум: слайдер + кнопки */}
          <div className="flex w-full items-center gap-2 px-1">
            <ZoomOut className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="range" min={100} max={400} value={zoom * 100}
              onChange={(e) => setZoomClamped(Number(e.target.value) / 100)}
              className="w-full accent-primary"
              aria-label="Zoom"
            />
            <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>✕</Button>
          <Button onClick={confirm} disabled={saving || !natural}>{saving ? "…" : "OK"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
