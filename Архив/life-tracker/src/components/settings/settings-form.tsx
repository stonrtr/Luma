"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { updateProfile, updatePreferences, changePassword, uploadAvatar } from "@/server/actions/settings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOCALES, LOCALE_LABEL, t } from "@/lib/i18n";
import { initials } from "@/lib/format";

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
              onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(f); e.target.value = ""; }} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{tr("settings.firstName")}</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tr("settings.lastName")}</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          <div className="space-y-2"><Label>Email</Label><Input value={initial.email} disabled /></div>
          <div className="space-y-2"><Label>{tr("set.phone")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380..." /></div>
          <div className="space-y-2"><Label>{initial.title ? tr("org.title") : "—"}</Label><Input value={initial.title ?? ""} disabled /></div>
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
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{tr("theme.system")}</SelectItem>
                <SelectItem value="light">{tr("theme.light")}</SelectItem>
                <SelectItem value="dark">{tr("theme.dark")}</SelectItem>
              </SelectContent>
            </Select>
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
