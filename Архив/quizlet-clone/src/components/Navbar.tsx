"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  IcHome,
  IcFolder,
  IcPlus,
  IcSearch,
  IcStar,
  IcMenu,
  IcX,
} from "./icons";

export default function Navbar() {
  const { data, setDark } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-40 bg-nav-c border-b border-line-c">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-4">
        <button
          className="lg:hidden text-heading-c"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
        >
          {menuOpen ? <IcX /> : <IcMenu />}
        </button>

        <Link href="/" className="flex items-center gap-1 shrink-0">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-assembly text-white font-black">
            Q
          </span>
          <span className="hidden sm:block text-[20px] font-black tracking-tight text-heading-c">
            Quizlet
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 ml-2">
          <NavLink href="/" icon={<IcHome size={18} />}>
            Home
          </NavLink>
          <NavLink href="/folders" icon={<IcFolder size={18} />}>
            Your library
          </NavLink>
        </nav>

        <form onSubmit={submit} className="flex-1 max-w-[520px] mx-auto">
          <div className="flex items-center gap-2 rounded-full bg-canvas-c border border-line-c px-4 h-10 focus-within:border-assembly">
            <IcSearch size={18} className="text-muted-c" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for study sets, textbooks, questions"
              className="w-full bg-transparent outline-none text-sm text-body-c placeholder:text-muted-c"
            />
          </div>
        </form>

        <Link href="/create" className="qbtn qbtn-primary !px-3 !py-2 shrink-0" aria-label="Create">
          <IcPlus size={18} />
          <span className="hidden md:inline">Create</span>
        </Link>

        <button
          onClick={() => setDark(!data.settings.dark)}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-canvas-c text-heading-c"
          aria-label="Toggle theme"
          title="Toggle dark mode"
        >
          {data.settings.dark ? "☀️" : "🌙"}
        </button>

        <Link
          href="/profile"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white font-bold"
          style={{ background: data.user.avatarColor }}
        >
          {data.user.name[0]?.toUpperCase()}
        </Link>
      </div>

      {menuOpen && (
        <div className="lg:hidden border-t border-line-c px-4 py-2 bg-nav-c">
          <MobileLink href="/" onClick={() => setMenuOpen(false)}>
            <IcHome size={18} /> Home
          </MobileLink>
          <MobileLink href="/folders" onClick={() => setMenuOpen(false)}>
            <IcFolder size={18} /> Your library
          </MobileLink>
          <MobileLink href="/create" onClick={() => setMenuOpen(false)}>
            <IcPlus size={18} /> Create
          </MobileLink>
          <MobileLink href="/settings" onClick={() => setMenuOpen(false)}>
            <IcStar size={18} /> Settings
          </MobileLink>
        </div>
      )}
    </header>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-heading-c hover:bg-canvas-c"
    >
      {icon}
      {children}
    </Link>
  );
}

function MobileLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-heading-c hover:bg-canvas-c"
    >
      {children}
    </Link>
  );
}
