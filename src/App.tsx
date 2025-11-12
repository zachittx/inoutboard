import React, { useEffect, useMemo, useState, createContext, useContext } from "react";
import { HashRouter, Routes, Route, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, Monitor, TabletSmartphone, Users, Clock, Sun, Moon } from "lucide-react";

/**
 * In/Out Board — React + TypeScript
 * ---------------------------------
 * - TV View (/view): read-only board grouped by team with live "In" counts
 * - Kiosk (/kiosk): iPad-friendly interactive check-in/out
 * - Theme: dark/light with toggle, localStorage persistence, and ?theme= query override
 */

type Status = "in" | "out";
export type Employee = { id: string; name: string; status: Status; updatedAt: number };

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: "zach", name: "Zach", status: "out", updatedAt: Date.now() },
  { id: "maurice", name: "Maurice", status: "out", updatedAt: Date.now() },
  { id: "caleb", name: "Caleb", status: "out", updatedAt: Date.now() },
  { id: "derek", name: "Derek", status: "out", updatedAt: Date.now() },
  { id: "ivan", name: "Ivan", status: "out", updatedAt: Date.now() },
  { id: "jerry", name: "Jerry", status: "out", updatedAt: Date.now() },
  { id: "michael", name: "Michael", status: "out", updatedAt: Date.now() },
  { id: "reginald", name: "Reginald", status: "out", updatedAt: Date.now() },
  { id: "jacob", name: "Jacob", status: "out", updatedAt: Date.now() },
  { id: "dean", name: "Dean", status: "out", updatedAt: Date.now() },
  { id: "david", name: "David", status: "out", updatedAt: Date.now() },
];

const GROUPS = [
  { key: "managers", title: "Managers", members: ["zach", "maurice"] },
  { key: "techleads", title: "Tech Leads", members: ["caleb", "derek", "ivan"] },
  { key: "servicedesk", title: "Service Desk", members: ["jerry", "michael", "reginald", "jacob", "dean", "david"] },
] as const;

type GroupKey = (typeof GROUPS)[number]["key"];

const LS_KEY = "inout_board_v1";

type Theme = "dark" | "light";
const THEME_KEY = "inout_theme";
const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme: "dark", setTheme: () => {} });

function useTheme() { return useContext(ThemeCtx); }

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [params] = useSearchParams();
  const queryTheme = (params.get("theme") as Theme | null);
  const [theme, setThemeState] = useState<Theme>(() => queryTheme ?? (localStorage.getItem(THEME_KEY) as Theme) ?? "dark");
  const setTheme = (t: Theme) => { setThemeState(t); localStorage.setItem(THEME_KEY, t); };
  useEffect(() => { if (queryTheme && (queryTheme === "dark" || queryTheme === "light")) setTheme(queryTheme); }, [queryTheme]);
  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

function useTokens() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return {
    pageBg: isDark ? "bg-neutral-950 text-neutral-100" : "bg-white text-neutral-900",
    cardBg: isDark ? "bg-neutral-900/50" : "bg-neutral-50",
    border: isDark ? "border-neutral-800" : "border-neutral-200",
    subtle: isDark ? "text-neutral-400" : "text-neutral-600",
    heading: isDark ? "text-neutral-200" : "text-neutral-800",
    tabActive: isDark ? "bg-neutral-800 text-white" : "bg-neutral-200 text-neutral-900",
    tabIdle: isDark ? "bg-neutral-900/50 text-neutral-300 hover:bg-neutral-800" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
    pillInBg: isDark ? "bg-emerald-500/15" : "bg-emerald-100",
    pillInText: isDark ? "text-emerald-300" : "text-emerald-700",
    pillInRing: isDark ? "ring-emerald-500/30" : "ring-emerald-300",
    pillOutBg: isDark ? "bg-rose-500/15" : "bg-rose-100",
    pillOutText: isDark ? "text-rose-300" : "text-rose-700",
    pillOutRing: isDark ? "ring-rose-500/30" : "ring-rose-300",
  };
}

class LocalStorageStore {
  private subs = new Set<(list: Employee[]) => void>();
  async init(initial: Employee[]): Promise<Employee[]> {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      localStorage.setItem(LS_KEY, JSON.stringify(initial));
      return initial;
    }
    try {
      const saved = JSON.parse(raw) as Employee[];
      const merged = [...initial];
      for (const s of saved) {
        const idx = merged.findIndex((m) => m.id === s.id);
        if (idx >= 0) merged[idx] = s; else merged.push(s);
      }
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
      return merged;
    } catch {
      localStorage.setItem(LS_KEY, JSON.stringify(initial));
      return initial;
    }
  }
  onChange(sub: (list: Employee[]) => void) {
    this.subs.add(sub);
    const handler = (e: StorageEvent) => {
      if (e.key === LS_KEY && e.newValue) {
        try { sub(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => { this.subs.delete(sub); window.removeEventListener("storage", handler); };
  }
  async setStatus(id: string, status: Status) {
    const list = await this.read();
    const idx = list.findIndex((e) => e.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], status, updatedAt: Date.now() };
      localStorage.setItem(LS_KEY, JSON.stringify(list));
      this.emit(list);
    }
  }
  private async read(): Promise<Employee[]> {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Employee[]) : [];
  }
  private emit(list: Employee[]) { for (const s of this.subs) s(list); }
}

const store = new LocalStorageStore();

function useEmployees() {
  const [list, setList] = useState<Employee[] | null>(null);
  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      const init = await store.init(DEFAULT_EMPLOYEES);
      setList(init);
      unsub = store.onChange((l) => setList([...l]));
    })();
    return () => unsub?.();
  }, []);
  const setStatus = async (id: string, status: Status) => store.setStatus(id, status);
  return { list: list ?? [], ready: !!list, setStatus };
}

function Shell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const t = useTokens();
  return (
    <div className={`min-h-screen ${t.pageBg}`}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6" />
            <h1 className="text-xl font-semibold tracking-tight">In/Out Board</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-xl border border-neutral-500/30 px-2 py-1 text-sm"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <LiveClock />
          </div>
        </header>
        <nav className="mt-4 flex gap-2">
          <Tab to="/view" icon={<Monitor className="h-4 w-4" />} label="TV View" />
          <Tab to="/kiosk" icon={<TabletSmartphone className="h-4 w-4" />} label="Kiosk" />
        </nav>
        <main className="mt-6">{children}</main>
      </div>
    </div>
  );
}

function Tab({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  const tt = useTokens();
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
          isActive ? tt.tabActive : tt.tabIdle
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-400">
      <Clock className="h-4 w-4" />
      {now.toLocaleDateString()} · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const t = useTokens();
  const isIn = status === "in";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${isIn ? `${t.pillInBg} ${t.pillInText} ring-1 ${t.pillInRing}` : `${t.pillOutBg} ${t.pillOutText} ring-1 ${t.pillOutRing}`}`}>
      {isIn ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {isIn ? "In" : "Out"}
    </span>
  );
}

function EmployeeCard({ e }: { e: Employee }) {
  const t = useTokens();
  return (
    <div className={`flex items-center justify-between rounded-2xl border ${t.border} ${t.cardBg} p-4`}>
      <div>
        <div className="text-base font-medium">{e.name}</div>
        <div className={`mt-1 text-xs ${t.subtle}`}>Updated {Math.round((Date.now() - e.updatedAt) / 60000)}m ago</div>
      </div>
      <StatusPill status={e.status} />
    </div>
  );
}

function KioskRow({ e, onSet }: { e: Employee; onSet: (s: Status) => void }) {
  const t = useTokens();
  return (
    <div className={`grid grid-cols-2 items-center gap-3 rounded-2xl border ${t.border} ${t.cardBg} p-3`}>
      <div>
        <div className="text-base font-medium">{e.name}</div>
        <div className={`text-xs ${t.subtle}`}>Currently {e.status}</div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onSet("in")}
          className={`rounded-xl px-3 py-2 ${e.status === "in" ? "bg-emerald-600 text-white" : "bg-emerald-600/30 text-emerald-700 hover:bg-emerald-600/40"}`}
        >
          In
        </button>
        <button
          onClick={() => onSet("out")}
          className={`rounded-xl px-3 py-2 ${e.status === "out" ? "bg-rose-600 text-white" : "bg-rose-600/30 text-rose-700 hover:bg-rose-600/40"}`}
        >
          Out
        </button>
      </div>
    </div>
  );
}

function ViewPage() {
  const { list, ready } = useEmployees();
  const t = useTokens();
  const grouped = useMemo(
    () => Object.fromEntries(GROUPS.map((g) => [g.key, list.filter((e) => g.members.includes(e.id))])) as Record<GroupKey, Employee[]>,
    [list]
  );
  return (
    <div className="space-y-8 text-center">
      {!ready ? (
        <div>Loading…</div>
      ) : (
        GROUPS.map((g) => {
          const group = grouped[g.key];
          const count = group.filter((e) => e.status === "in").length;
          return (
            <section key={g.key}>
              <div className="text-3xl font-bold text-emerald-500 tabular-nums">{count}</div>
              <h2 className={`text-lg mb-2 ${t.heading}`}>{g.title}</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {group.map((e) => (
                  <EmployeeCard key={e.id} e={e} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function KioskPage() {
  const { list, ready, setStatus } = useEmployees();
  const grouped = useMemo(
    () => Object.fromEntries(GROUPS.map((g) => [g.key, list.filter((e) => g.members.includes(e.id))])) as Record<GroupKey, Employee[]>,
    [list]
  );
  return (
    <div className="space-y-8 text-center">
      {!ready ? (
        <div>Loading…</div>
      ) : (
        GROUPS.map((g) => (
          <section key={g.key}>
            <h2 className="text-lg mb-2">{g.title}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {grouped[g.key].map((e) => (
                <KioskRow key={e.id} e={e} onSet={(s) => setStatus(e.id, s)} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <Shell>
          <Routes>
            <Route path="/" element={<AutoRedirect />} />
            <Route path="/view" element={<ViewPage />} />
            <Route path="/kiosk" element={<KioskPage />} />
          </Routes>
        </Shell>
      </ThemeProvider>
    </HashRouter>
  );
}

function AutoRedirect() {
  const navigate = useNavigate();
  useEffect(() => { navigate(window.innerWidth < 1024 ? "/kiosk" : "/view", { replace: true }); }, [navigate]);
  return null;
}
