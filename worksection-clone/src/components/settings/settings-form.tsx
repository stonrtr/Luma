"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { updateProfile, updatePreferences, changePassword, uploadAvatar, setTheme as setThemeAction } from "@/server/actions/settings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOCALES, LOCALE_LABEL, t } from "@/lib/i18n";
import { initials } from "@/lib/format";
import { AvatarCropDialog } from "@/components/settings/avatar-crop-dialog";

type Initial = {
  firstName: string; lastName: string; name: string; email: string; title: string | null; phone: string | null;
  avatarUrl: string | null; locale: string; theme: string; timezone: string; weekStartsMon: boolean;
};

export function SettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const tr = (k: string) => t(initial.locale, k);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, start] = useTransition();

  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [cropSrc, setCropSrc] = useState<string | null>(null); // objectURL фото для кадрирования

  const [locale, setLocale] = useState(initial.locale);
  const [theme, setTheme] = useState(initial.theme);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [weekStartsMon, setWeek] = useState(initial.weekStartsMon);

  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");

  function saveProfile() {
    start(async () => {
      await updateProfile({ firstName, lastName, phone, avatarUrl });
      toast.success(tr("settings.saved"));
      router.refresh();
    });
  }
  // iOS-тумблер темы: применяем мгновенно (класс на <html> и .app-shell) и сохраняем в фоне — без «Зберегти».
  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    const isDark = nextTheme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.querySelector(".app-shell")?.classList.toggle("dark", isDark);
    start(async () => { await setThemeAction(nextTheme); });
  }
  function savePrefs() {
    start(async () => {
      await updatePreferences({ locale: locale as "uk" | "ru" | "en", theme: theme as "system" | "light" | "dark", timezone, weekStartsMon });
      toast.success(tr("settings.saved"));
      router.refresh();
    });
  }
  function doUpload(file: File) {
    const fd = new FormData(); fd.set("file", file);
    start(async () => {
      const res = await uploadAvatar(fd);
      if (res?.error) toast.error(res.error);
      else { setAvatarUrl(res.url ?? null); toast.success(tr("settings.saved")); router.refresh(); }
      setCropSrc((old) => { if (old) URL.revokeObjectURL(old); return null; }); // закрыть кадрирование
    });
  }
  function doPassword() {
    start(async () => {
      const res = await changePassword({ current: cur, next });
      if (res?.error) toast.error(res.error);
      else { setCur(""); setNext(""); toast.success(tr("settings.saved")); }
    });
  }

  const card = "rounded-xl border bg-card p-5";

  return (
    <div className="space-y-6">
      {/* Профиль */}
      <section className={card}>
        <h2 className="mb-4 text-sm font-semibold">{tr("settings.profile")}</h2>
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={initial.name} />}
            <AvatarFallback className="text-lg">{initials(initial.name)}</AvatarFallback>
          </Avatar>
          <div>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> {tr("settings.uploadAvatar")}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropSrc(URL.createObjectURL(f)); e.target.value = ""; }} />
            {/* Кадрирование перед загрузкой: зум + перетаскивание нужного участка */}
            <AvatarCropDialog
              src={cropSrc}
              title={tr("settings.uploadAvatar")}
              saving={false}
              onCancel={() => setCropSrc((old) => { if (old) URL.revokeObjectURL(old); return null; })}
              onSave={(file) => doUpload(file)}
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{tr("settings.firstName")}</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tr("settings.lastName")}</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          <div className="space-y-2"><Label>Email</Label><Input value={initial.email} disabled /></div>
          <div className="space-y-2"><Label>{tr("set.phone")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380..." /></div>
          {initial.title && <div className="space-y-2"><Label>{tr("org.title")}</Label><Input value={initial.title} disabled /></div>}
        </div>
        <div className="mt-4"><Button size="sm" onClick={saveProfile}>{tr("settings.save")}</Button></div>
      </section>

      {/* Предпочтения */}
      <section className={card}>
        <h2 className="mb-4 text-sm font-semibold">{tr("settings.preferences")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>{tr("settings.language")}</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LOCALES.map((l) => <SelectItem key={l} value={l}>{LOCALE_LABEL[l]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{tr("settings.theme")}</Label>
            {/* iOS-стайл тумблер: применяется мгновенно, без «Зберегти» */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={theme === "dark"}
                onClick={toggleTheme}
                className={cn(
                  "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  theme === "dark" ? "border-primary bg-primary" : "border-input bg-muted",
                )}
              >
                <span className="pointer-events-none absolute left-1.5 text-[13px] opacity-80">☀️</span>
                <span className="pointer-events-none absolute right-1.5 text-[13px] opacity-80">🌙</span>
                <span
                  className={cn(
                    "pointer-events-none z-10 inline-block size-6 transform rounded-full bg-white shadow transition-transform",
                    theme === "dark" ? "translate-x-[1.75rem]" : "translate-x-1",
                  )}
                />
              </button>
              <span className="text-sm text-muted-foreground">{theme === "dark" ? tr("theme.dark") : tr("theme.light")}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{tr("settings.timezone")}</Label>
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
          <label className="flex items-end gap-2 pb-2">
            <Checkbox checked={weekStartsMon} onCheckedChange={(c) => setWeek(!!c)} />
            <span className="text-sm">{tr("settings.weekStart")}</span>
          </label>
        </div>
        <div className="mt-4"><Button size="sm" onClick={savePrefs}>{tr("settings.save")}</Button></div>
      </section>

      {/* Пароль */}
      <section className={card}>
        <h2 className="mb-4 text-sm font-semibold">{tr("settings.password")}</h2>
        <div className="grid max-w-md grid-cols-1 gap-3">
          <div className="space-y-2"><Label>{tr("settings.currentPassword")}</Label><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tr("settings.newPassword")}</Label><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        </div>
        <div className="mt-4"><Button size="sm" variant="outline" onClick={doPassword} disabled={!cur || !next}>{tr("settings.changePassword")}</Button></div>
      </section>
    </div>
  );
}
