"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Directory, SubmissionStatus, StatusEntry, Project } from "@/lib/types";
import { allDirectories, saasDirectories, launchSites, redditCommunities } from "@/lib/directories";

// ─── CSV Import helpers ───────────────────────────────────────────────────────

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let inQ = false, cur = "";
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { result.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").split("/")[0].split("?")[0]; }
}

function processImportCSV(
  text: string,
  dirs: Directory[]
): { newStatuses: Record<string, StatusEntry>; imported: number; skipped: number } {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return { newStatuses: {}, imported: 0, skipped: 0 };

  const headers = parseCsvRow(lines[0]).map((h) => h.toLowerCase());
  const col = (row: string[], name: string) => row[headers.indexOf(name)] ?? "";
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  let imported = 0, skipped = 0;
  const newStatuses: Record<string, StatusEntry> = {};

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i]);
    const name = col(row, "name");
    const url = col(row, "url");
    const statusRaw = col(row, "status") as SubmissionStatus;
    const appliedDate = col(row, "applied_date");
    const resolvedDate = col(row, "resolved_date");

    if (!["applied", "listed", "rejected"].includes(statusRaw)) { skipped++; continue; }

    // Match by URL domain first, fall back to name
    let dir: Directory | null = null;
    if (url) {
      const d = getDomain(url);
      dir = dirs.find((x) => getDomain(x.url) === d) ?? null;
    }
    if (!dir && name) {
      const n = norm(name);
      dir = dirs.find((x) => {
        const dn = norm(x.name);
        return dn === n || dn.startsWith(n) || n.startsWith(dn) || dn.includes(n);
      }) ?? null;
    }

    if (!dir) { skipped++; continue; }

    const appliedAt = appliedDate ? new Date(appliedDate).toISOString() : new Date().toISOString();
    const updatedAt = resolvedDate?.trim() ? new Date(resolvedDate).toISOString() : appliedAt;
    newStatuses[dir.id] = { status: statusRaw, updatedAt, appliedAt };
    imported++;
  }

  return { newStatuses, imported, skipped };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PROJECT_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#9ca3af"];

const STATUS_OPTIONS: { value: SubmissionStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "applied", label: "Applied" },
  { value: "listed", label: "Listed" },
  { value: "rejected", label: "Rejected" },
];

const DA_FILTERS = [
  { label: "All", value: 0 },
  { label: "80+", value: 80 },
  { label: "60+", value: 60 },
  { label: "40+", value: 40 },
  { label: "20+", value: 20 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

// launch-1..11 were duplicates of saas entries; remap any saved IDs to the canonical saas ID
const LAUNCH_TO_SAAS: Record<string, string> = {
  "launch-1": "saas-5",  "launch-2": "saas-7",  "launch-3": "saas-12",
  "launch-4": "saas-10", "launch-5": "saas-13", "launch-6": "saas-16",
  "launch-7": "saas-19", "launch-8": "saas-18", "launch-9": "saas-21",
  "launch-10": "saas-29","launch-11": "saas-27",
};

function dedupeStatuses(statuses: Record<string, StatusEntry>): Record<string, StatusEntry> {
  const result = { ...statuses };
  for (const [oldId, newId] of Object.entries(LAUNCH_TO_SAAS)) {
    if (!result[oldId]) continue;
    const incoming = result[oldId];
    const existing = result[newId];
    // keep whichever has the higher-priority status (listed > applied > rejected > todo)
    const priority = (s: SubmissionStatus) => ({ listed: 3, applied: 2, rejected: 1, todo: 0 }[s] ?? 0);
    if (!existing || priority(incoming.status) > priority(existing.status)) {
      result[newId] = incoming;
    }
    delete result[oldId];
  }
  return result;
}

function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dir-projects");
      const activeStored = localStorage.getItem("dir-active-project");
      if (stored) {
        const parsed: Project[] = JSON.parse(stored);
        // Migrate any saved launch-1..11 IDs to their canonical saas-X equivalents
        const needsMigration = parsed.some(p =>
          Object.keys(p.statuses).some(id => id in LAUNCH_TO_SAAS)
        );
        const migrated = needsMigration
          ? parsed.map(p => ({ ...p, statuses: dedupeStatuses(p.statuses) }))
          : parsed;
        if (needsMigration) localStorage.setItem("dir-projects", JSON.stringify(migrated));
        setProjects(migrated);
        const valid = migrated.find((p) => p.id === activeStored);
        setActiveId(valid ? activeStored! : (migrated[0]?.id ?? ""));
      } else {
        // Migrate legacy statuses into a default project
        const saas = JSON.parse(localStorage.getItem("dir-status-saas") || "{}");
        const launch = JSON.parse(localStorage.getItem("dir-status-launch") || "{}");
        const existing = JSON.parse(localStorage.getItem("dir-status") || "{}");
        const raw: Record<string, SubmissionStatus | StatusEntry> = { ...saas, ...launch, ...existing };
        const now = new Date().toISOString();
        const rawMigrated: Record<string, StatusEntry> = {};
        for (const [id, val] of Object.entries(raw)) {
          rawMigrated[id] =
            typeof val === "string"
              ? { status: val as SubmissionStatus, updatedAt: now }
              : (val as StatusEntry);
        }
        const defaultProject: Project = {
          id: makeId(),
          name: "Submission Tracker",
          color: "#3b82f6",
          statuses: dedupeStatuses(rawMigrated),
          notes: {},
          createdAt: now,
        };
        setProjects([defaultProject]);
        setActiveId(defaultProject.id);
        localStorage.setItem("dir-projects", JSON.stringify([defaultProject]));
        localStorage.setItem("dir-active-project", defaultProject.id);
      }
    } catch {}
  }, []);

  const activeProject = projects.find((p) => p.id === activeId) ?? projects[0] ?? null;

  function saveProjects(updated: Project[]) {
    setProjects(updated);
    try {
      localStorage.setItem("dir-projects", JSON.stringify(updated));
    } catch {}
  }

  function createProject(name: string, color: string) {
    const newProject: Project = {
      id: makeId(),
      name,
      color,
      statuses: {},
      notes: {},
      createdAt: new Date().toISOString(),
    };
    const updated = [...projects, newProject];
    saveProjects(updated);
    setActiveId(newProject.id);
    try {
      localStorage.setItem("dir-active-project", newProject.id);
    } catch {}
  }

  function switchProject(id: string) {
    setActiveId(id);
    try {
      localStorage.setItem("dir-active-project", id);
    } catch {}
  }

  function setStatus(id: string, value: SubmissionStatus) {
    if (!activeProject) return;
    const existing = activeProject.statuses[id];
    const now = new Date().toISOString();

    // appliedAt is set the first time status becomes "applied" and never overwritten.
    // Cleared only when the user resets back to "todo".
    let appliedAt: string | undefined = existing?.appliedAt;
    if (value === "applied" && !appliedAt) appliedAt = now;
    if (value === "todo") appliedAt = undefined;

    const updated: Project = {
      ...activeProject,
      statuses: {
        ...activeProject.statuses,
        [id]: { status: value, updatedAt: now, ...(appliedAt ? { appliedAt } : {}) },
      },
    };
    saveProjects(projects.map((p) => (p.id === activeId ? updated : p)));
  }

  function setNote(directoryId: string, note: string) {
    if (!activeProject) return;
    const updated: Project = {
      ...activeProject,
      notes: { ...activeProject.notes, [directoryId]: note },
    };
    saveProjects(projects.map((p) => (p.id === activeId ? updated : p)));
  }

  function mergeStatuses(incoming: Record<string, StatusEntry>) {
    if (!activeProject) return;
    const updated: Project = {
      ...activeProject,
      statuses: { ...activeProject.statuses, ...incoming },
    };
    saveProjects(projects.map((p) => (p.id === activeId ? updated : p)));
  }

  return { projects, activeProject, createProject, switchProject, setStatus, setNote, mergeStatuses };
}

// ─── CreateProjectModal ───────────────────────────────────────────────────────

function CreateProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
}) {
  const [name, setName] = useState("My New SaaS Project");
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  function submit() {
    if (name.trim()) {
      onCreate(name.trim(), color);
      onClose();
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 12,
          padding: 24,
          width: 432,
          maxWidth: "calc(100vw - 32px)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
            New Project
          </span>
          <button
            onClick={onClose}
            style={{
              background: "var(--bg-hover)",
              border: "none",
              borderRadius: 6,
              padding: "6px 8px",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Name field */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-secondary)",
              marginBottom: 6,
            }}
          >
            Project name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 6,
              border: "1.5px solid var(--accent)",
              background: "var(--bg-card)",
              color: "var(--text)",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
            autoFocus
          />
        </div>

        {/* Color field */}
        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-secondary)",
              marginBottom: 8,
            }}
          >
            Color
          </label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: c,
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                  outline: color === c ? `3px solid var(--bg-card)` : "none",
                  boxShadow: color === c ? `0 0 0 4px ${c}` : "none",
                  transition: "box-shadow 0.12s",
                }}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button
            onClick={onClose}
            style={{
              background: "var(--bg-hover)",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            style={{
              background: name.trim() ? "var(--accent)" : "var(--border)",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: name.trim() ? "pointer" : "not-allowed",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Create Project →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NotesPopover ─────────────────────────────────────────────────────────────

function NotesPopover({
  directory,
  note,
  onSave,
  onClose,
}: {
  directory: Directory;
  note: string;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(note);

  function save() {
    onSave(text);
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        background: "rgba(0,0,0,0.2)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) save();
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 24,
          top: "50%",
          transform: "translateY(-50%)",
          width: 280,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
            {directory.name}
          </span>
          <button
            onClick={save}
            style={{
              background: "var(--bg-hover)",
              border: "none",
              borderRadius: 5,
              padding: "4px 7px",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 12,
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add notes about this submission…"
            style={{
              width: "100%",
              minHeight: 88,
              padding: 8,
              background: "var(--bg-hover)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text)",
              fontSize: 12,
              lineHeight: 1.55,
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
            autoFocus
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "10px 14px",
          }}
        >
          <button
            onClick={save}
            style={{
              background: "var(--accent)",
              border: "none",
              borderRadius: 5,
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              color: "#fff",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Small reusable pieces ────────────────────────────────────────────────────

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-dim)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {children}
    </span>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#fff" : "var(--text-secondary)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 5,
        padding: "3px 8px",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.1s",
      }}
    >
      {children}
    </button>
  );
}

function StatusDropdown({
  status,
  onChange,
}: {
  status: SubmissionStatus;
  onChange: (v: SubmissionStatus) => void;
}) {
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as SubmissionStatus)}
      style={{
        background: `var(--badge-${status}-bg)`,
        color: `var(--badge-${status}-text)`,
        border: `1px solid var(--badge-${status}-text)`,
        borderRadius: "5px",
        padding: "3px 6px",
        fontSize: "11px",
        fontWeight: 600,
        cursor: "pointer",
        outline: "none",
        appearance: "none",
        WebkitAppearance: "none",
        paddingRight: "20px",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='currentColor' opacity='.5'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 5px center",
        backgroundSize: "8px",
        transition: "background 0.1s",
      }}
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function TypeBadge({ type }: { type: "free" | "freemium" | "paid" }) {
  return (
    <span
      style={{
        background: `var(--badge-${type}-bg)`,
        color: `var(--badge-${type}-text)`,
        borderRadius: 5,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "capitalize",
      }}
    >
      {type}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DirectoriesApp() {
  const { projects, activeProject, createProject, switchProject, setStatus, setNote, mergeStatuses } =
    useProjects();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "directory" | "launch" | "reddit">(
    "all"
  );
  const [notesFor, setNotesFor] = useState<Directory | null>(null);
  const [daFilter, setDaFilter] = useState(0);
  const [typeFilter, setTypeFilter] = useState<"all" | "free" | "freemium" | "paid">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<"all" | SubmissionStatus>("all");
  const [search, setSearch] = useState("");
  const [daSort, setDaSort] = useState<"desc" | "asc">("desc");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importNote, setImportNote] = useState<string | null>(null);

  useEffect(() => {
    if (!showProjectDropdown) return;
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProjectDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProjectDropdown]);

  const statuses = activeProject?.statuses ?? {};
  const notes = activeProject?.notes ?? {};

  const tabData =
    activeTab === "reddit" ? redditCommunities
    : activeTab === "directory" ? saasDirectories
    : activeTab === "launch" ? launchSites
    : allDirectories;

  // Status breakdown for current tab
  const statusCounts = useMemo(() => {
    const counts = { todo: 0, applied: 0, listed: 0, rejected: 0 };
    const items = activeTab === "reddit" ? [] : tabData as typeof allDirectories;
    for (const d of items) {
      const s = statuses[d.id]?.status ?? "todo";
      counts[s]++;
    }
    return counts;
  }, [statuses, tabData, activeTab]);

  // Overall progress (all directories, both tabs)
  const allApplied = useMemo(
    () =>
      Object.values(statuses).filter(
        (e) => e.status === "applied" || e.status === "listed"
      ).length,
    [statuses]
  );
  const allTotal = allDirectories.length;
  const progressPct = allTotal > 0 ? (allApplied / allTotal) * 100 : 0;

  // Filtered table rows
  const filteredData = useMemo(() => {
    if (activeTab === "reddit") {
      return redditCommunities.filter(
        (d) => !search || d.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    const rows = tabData.filter((d) => {
      const daOk = daFilter === 0 || (d.da !== null && d.da >= daFilter);
      const nameOk =
        !search || d.name.toLowerCase().includes(search.toLowerCase());
      const typeOk = typeFilter === "all" || d.type === typeFilter;
      const st = statuses[d.id]?.status ?? "todo";
      const statusOk = statusFilter === "all" || st === statusFilter;
      return daOk && nameOk && typeOk && statusOk;
    });
    return [...rows].sort((a, b) => {
      const av = a.da ?? -1,
        bv = b.da ?? -1;
      return daSort === "desc" ? bv - av : av - bv;
    });
  }, [tabData, activeTab, daFilter, search, typeFilter, statusFilter, statuses, daSort]);

  const trackedCount = Object.values(statuses).filter(
    (e) => e.status !== "todo"
  ).length;

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeProject) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { newStatuses, imported, skipped } = processImportCSV(text, allDirectories);
      mergeStatuses(newStatuses);
      const msg = skipped > 0
        ? `Imported ${imported} entries. ${skipped} rows not found in database.`
        : `Imported ${imported} entries successfully.`;
      setImportNote(msg);
      setTimeout(() => setImportNote(null), 5000);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleExport() {
    if (trackedCount === 0) return;
    const acted = allDirectories.filter(
      (d) => statuses[d.id] && statuses[d.id].status !== "todo"
    );
    const escape = (v: string) =>
      v.includes(",") || v.includes('"') || v.includes("\n")
        ? '"' + v.replace(/"/g, '""') + '"'
        : v;
    const headers = ["name", "url", "category", "da", "type", "status", "date_updated"];
    const rows = acted.map((d) => {
      const entry = statuses[d.id];
      return [
        escape(d.name),
        escape(d.url),
        d.category,
        d.da ?? "",
        d.type,
        entry.status,
        entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "",
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    a.download = `saas-directories-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.csv`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const daColor = (da: number | null) => {
    if (da === null) return "var(--text-dim)";
    if (da >= 70) return "var(--da-high)";
    if (da >= 40) return "var(--da-mid)";
    return "var(--da-low)";
  };

  function switchTab(tab: "all" | "directory" | "launch" | "reddit") {
    setActiveTab(tab);
    setStatusFilter("all");
    setDaFilter(0);
    setTypeFilter("all");
  }

  return (
    <>
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createProject}
        />
      )}
      {notesFor && (
        <NotesPopover
          directory={notesFor}
          note={notes[notesFor.id] ?? ""}
          onSave={(text) => setNote(notesFor.id, text)}
          onClose={() => setNotesFor(null)}
        />
      )}

      <div
        style={{
          display: "flex",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
          background: "var(--bg-card)",
          minHeight: 560,
        }}
      >
        {/* ── Sidebar ── */}
        <div
          style={{
            width: 220,
            minWidth: 220,
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            padding: 16,
            gap: 20,
          }}
        >
          {/* Project switcher */}
          <div style={{ position: "relative" }} ref={dropdownRef}>
            <button
              onClick={() => setShowProjectDropdown((v) => !v)}
              style={{
                width: "100%",
                background: activeProject
                  ? activeProject.color + "18"
                  : "var(--bg-hover)",
                border: `1px solid ${
                  activeProject ? activeProject.color + "40" : "var(--border)"
                }`,
                borderRadius: 8,
                padding: "8px 10px",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: activeProject?.color ?? "var(--text-dim)",
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {activeProject?.name ?? "No Project"}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                  {allApplied} of {allTotal} done
                </div>
              </div>
              <span style={{ fontSize: 10, color: "var(--text-dim)", flexShrink: 0 }}>
                ▼
              </span>
            </button>

            {showProjectDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                  zIndex: 100,
                  padding: 6,
                }}
              >
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      switchProject(p.id);
                      setShowProjectDropdown(false);
                    }}
                    style={{
                      width: "100%",
                      background:
                        p.id === activeProject?.id
                          ? p.color + "15"
                          : "transparent",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 8px",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: p.color,
                        flexShrink: 0,
                        display: "inline-block",
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        fontWeight: p.id === activeProject?.id ? 600 : 400,
                        color: "var(--text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.name}
                    </span>
                    {p.id === activeProject?.id && (
                      <span style={{ fontSize: 11, color: p.color }}>✓</span>
                    )}
                  </button>
                ))}

                <div
                  style={{
                    height: 1,
                    background: "var(--border)",
                    margin: "4px 0",
                  }}
                />
                <button
                  onClick={() => {
                    setShowProjectDropdown(false);
                    setShowCreateModal(true);
                  }}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 8px",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--accent)",
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1, fontWeight: 600 }}>
                    +
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>Add Project</span>
                </button>
              </div>
            )}
          </div>

          {/* Progress */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SidebarLabel>Progress</SidebarLabel>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Applied to{" "}
              <strong style={{ color: "var(--text)" }}>{allApplied}</strong> of{" "}
              <strong style={{ color: "var(--text)" }}>{allTotal}</strong>
            </div>
            <div
              style={{
                height: 5,
                background: "var(--border)",
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: activeProject?.color ?? "var(--accent)",
                  borderRadius: 99,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>

          {/* Status filter */}
          {activeTab !== "reddit" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SidebarLabel>Status</SidebarLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FilterBtn
                  active={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </FilterBtn>
                {(["todo", "applied", "listed", "rejected"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      setStatusFilter(statusFilter === s ? "all" : s)
                    }
                    style={{
                      background:
                        statusFilter === s
                          ? `var(--badge-${s}-bg)`
                          : "transparent",
                      color: `var(--badge-${s}-text)`,
                      border: `1px solid ${
                        statusFilter === s
                          ? `var(--badge-${s}-text)`
                          : "var(--border)"
                      }`,
                      borderRadius: 5,
                      padding: "4px 8px",
                      fontSize: 12,
                      fontWeight: statusFilter === s ? 600 : 400,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.1s",
                    }}
                  >
                    <span>
                      {s === "todo"
                        ? "To Do"
                        : s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        background:
                          statusFilter === s
                            ? "rgba(0,0,0,0.1)"
                            : "var(--bg-hover)",
                        borderRadius: 99,
                        padding: "1px 6px",
                        fontVariantNumeric: "tabular-nums",
                        color:
                          statusFilter === s
                            ? "inherit"
                            : "var(--text-secondary)",
                      }}
                    >
                      {statusCounts[s]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DA filter */}
          {activeTab !== "reddit" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SidebarLabel>Min DA</SidebarLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {DA_FILTERS.map((f) => (
                  <FilterBtn
                    key={f.value}
                    active={daFilter === f.value}
                    onClick={() => setDaFilter(f.value)}
                  >
                    {f.label}
                  </FilterBtn>
                ))}
              </div>
            </div>
          )}

          {/* Type filter */}
          {activeTab !== "reddit" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SidebarLabel>Cost</SidebarLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(["all", "free", "freemium", "paid"] as const).map((t) => (
                  <FilterBtn
                    key={t}
                    active={typeFilter === t}
                    onClick={() => setTypeFilter(t)}
                  >
                    {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </FilterBtn>
                ))}
              </div>
            </div>
          )}

          {/* Import / Export */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            style={{ display: "none" }}
          />

          {importNote && (
            <div
              style={{
                background: "var(--bg-hover)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 11,
                color: "var(--text-secondary)",
                lineHeight: 1.4,
              }}
            >
              {importNote}
            </div>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: "transparent",
              color: "var(--accent)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              width: "100%",
              textAlign: "center",
              transition: "all 0.1s",
            }}
          >
            ↑ Import CSV
          </button>

          <button
            onClick={handleExport}
            disabled={trackedCount === 0}
            title={
              trackedCount === 0
                ? "No entries tracked yet"
                : `Export ${trackedCount} tracked entries`
            }
            style={{
              background: trackedCount > 0 ? "var(--accent)" : "var(--bg-hover)",
              color: trackedCount > 0 ? "#fff" : "var(--text-dim)",
              border: "none",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: trackedCount > 0 ? "pointer" : "not-allowed",
              opacity: trackedCount === 0 ? 0.5 : 1,
              width: "100%",
              textAlign: "center",
              transition: "all 0.1s",
            }}
          >
            ↓ Export CSV{trackedCount > 0 ? ` (${trackedCount})` : ""}
          </button>
        </div>

        {/* ── Main content ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 24px",
              height: 48,
              flexShrink: 0,
            }}
          >
            {/* Tabs */}
            <div
              style={{ display: "flex", height: "100%", alignItems: "stretch" }}
            >
              {(
                [
                  { key: "all", label: "All Directories" },
                  { key: "directory", label: "SaaS Only" },
                  { key: "launch", label: "Launch Sites" },
                  { key: "reddit", label: "Reddit Targets" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => switchTab(tab.key)}
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom:
                      activeTab === tab.key
                        ? "2px solid var(--accent)"
                        : "2px solid transparent",
                    color:
                      activeTab === tab.key
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                    fontSize: 13,
                    fontWeight: activeTab === tab.key ? 600 : 400,
                    padding: "0 16px",
                    cursor: "pointer",
                    height: "100%",
                    whiteSpace: "nowrap",
                    transition: "all 0.1s",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "5px 10px",
                color: "var(--text)",
                fontSize: 13,
                outline: "none",
                width: 180,
              }}
            />
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
            {activeTab === "reddit" ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: "var(--bg)",
                    }}
                  >
                    {["#", "Subreddit", "Category"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 24px",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          whiteSpace: "nowrap",
                          textAlign: "left",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((d, idx) => (
                    <tr
                      key={d.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--bg-hover)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td
                        style={{
                          padding: "10px 24px",
                          color: "var(--text-dim)",
                          fontSize: 12,
                          width: 40,
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td style={{ padding: "10px 24px" }}>
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "var(--accent)",
                            textDecoration: "none",
                            fontWeight: 500,
                          }}
                        >
                          {d.name}
                        </a>
                      </td>
                      <td
                        style={{
                          padding: "10px 24px",
                          color: "var(--text-secondary)",
                          fontSize: 13,
                        }}
                      >
                        {d.subcategory ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: "var(--bg)",
                    }}
                  >
                    <th
                      style={{
                        padding: "8px 24px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      #
                    </th>
                    <th
                      style={{
                        padding: "8px 24px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        textAlign: "left",
                      }}
                    >
                      Name
                    </th>
                    <th
                      onClick={() =>
                        setDaSort((s) => (s === "desc" ? "asc" : "desc"))
                      }
                      style={{
                        padding: "8px 24px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--accent)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        textAlign: "left",
                        cursor: "pointer",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                      }}
                      title="Click to sort"
                    >
                      DA / DR {daSort === "desc" ? "↓" : "↑"}
                    </th>
                    <th
                      style={{
                        padding: "8px 24px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        textAlign: "left",
                      }}
                    >
                      Type
                    </th>
                    <th
                      style={{
                        padding: "8px 24px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        textAlign: "left",
                      }}
                    >
                      Dofollow
                    </th>
                    <th
                      style={{
                        padding: "8px 24px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        textAlign: "left",
                      }}
                    >
                      Status / Dates
                    </th>
                    <th style={{ padding: "8px 24px", width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          padding: "48px 0",
                          color: "var(--text-dim)",
                        }}
                      >
                        No directories match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((d, idx) => {
                      const entry = statuses[d.id];
                      const status = entry?.status ?? "todo";
                      const hasNote = !!(notes[d.id]?.trim());
                      return (
                        <tr
                          key={d.id}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "var(--bg-hover)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <td
                            style={{
                              padding: "10px 24px",
                              color: "var(--text-dim)",
                              fontSize: 12,
                              width: 40,
                            }}
                          >
                            {idx + 1}
                          </td>
                          <td
                            style={{ padding: "10px 24px", maxWidth: 260 }}
                          >
                            <span
                              {...(d.notes ? { "data-tooltip": d.notes } : {})}
                            >
                              <a
                                href={d.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: "var(--accent)",
                                  textDecoration: "none",
                                  fontWeight: 500,
                                }}
                              >
                                {d.name}
                              </a>
                              {d.notes && (
                                <span
                                  style={{
                                    marginLeft: 4,
                                    color: "var(--text-dim)",
                                    fontSize: 11,
                                  }}
                                >
                                  ℹ
                                </span>
                              )}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "10px 24px",
                              fontWeight:
                                d.da !== null && d.da >= 70 ? 700 : 400,
                              color: daColor(d.da),
                              fontVariantNumeric: "tabular-nums",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {d.da ?? "—"}
                          </td>
                          <td style={{ padding: "10px 24px" }}>
                            <TypeBadge type={d.type} />
                          </td>
                          <td
                            style={{
                              padding: "10px 24px",
                              color: d.dofollow
                                ? "var(--da-high)"
                                : "var(--badge-rejected-text)",
                              fontWeight: 600,
                              fontSize: 13,
                            }}
                          >
                            {d.dofollow ? "✓ Dofollow" : "✗ Nofollow"}
                          </td>
                          <td
                            style={{
                              padding: "10px 24px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <StatusDropdown
                                status={status}
                                onChange={(v) => setStatus(d.id, v)}
                              />
                              {/* Date stamps — hidden when todo */}
                              {status === "todo" ? (
                                <span style={{ fontSize: 13, color: "var(--text-dim)" }}>—</span>
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  {/* Amber stamp: applied date, frozen */}
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block", flexShrink: 0 }} />
                                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                    {fmtDate(entry?.appliedAt ?? entry?.updatedAt ?? "")}
                                  </span>
                                  {/* Second stamp for listed or rejected */}
                                  {(status === "listed" || status === "rejected") && (
                                    <>
                                      <span style={{ fontSize: 11, color: "var(--text-dim)", margin: "0 2px" }}>→</span>
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: status === "listed" ? "#22c55e" : "#ef4444", display: "inline-block", flexShrink: 0 }} />
                                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                        {fmtDate(entry?.updatedAt ?? "")}
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "10px 24px", width: 40 }}>
                            <button
                              onClick={() => setNotesFor(d as Directory)}
                              title={hasNote ? "Edit note" : "Add note"}
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                color: hasNote
                                  ? "var(--accent)"
                                  : "var(--text-dim)",
                                fontSize: 14,
                                padding: "2px 4px",
                                borderRadius: 4,
                                opacity: 0.7,
                                transition: "opacity 0.1s",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.opacity = "1")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.opacity = "0.7")
                              }
                            >
                              ✎
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            <div
              style={{
                padding: "12px 24px",
                color: "var(--text-dim)",
                fontSize: 12,
              }}
            >
              Showing {filteredData.length} of{" "}
              {activeTab === "reddit" ? redditCommunities.length : tabData.length}{" "}
              {activeTab === "reddit" ? "subreddits" : activeTab === "all" ? "directories (all unique)" : "directories"}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
