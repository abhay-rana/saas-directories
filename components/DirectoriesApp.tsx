"use client";

import { useEffect, useState, useMemo } from "react";
import { Directory, FilterState, SubmissionStatus, StatusEntry } from "@/lib/types";
import { allDirectories } from "@/lib/directories";

const STATUS_OPTIONS: { value: SubmissionStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "applied", label: "Applied" },
  { value: "listed", label: "Listed" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  todo: "To Do",
  applied: "Applied",
  listed: "Listed",
  rejected: "Rejected",
};

const DA_FILTERS = [
  { label: "All", value: 0 },
  { label: "80+", value: 80 },
  { label: "60+", value: 60 },
  { label: "40+", value: 40 },
  { label: "20+", value: 20 },
];

function useStatuses() {
  const [statuses, setStatuses] = useState<Record<string, StatusEntry>>({});

  useEffect(() => {
    try {
      const saas = JSON.parse(localStorage.getItem("dir-status-saas") || "{}");
      const launch = JSON.parse(localStorage.getItem("dir-status-launch") || "{}");
      const existing = JSON.parse(localStorage.getItem("dir-status") || "{}");
      const raw: Record<string, SubmissionStatus | StatusEntry> = { ...saas, ...launch, ...existing };

      // migrate: old shape stored plain strings, new shape stores { status, updatedAt }
      const now = new Date().toISOString();
      const migrated: Record<string, StatusEntry> = {};
      for (const [id, val] of Object.entries(raw)) {
        if (typeof val === "string") {
          migrated[id] = { status: val as SubmissionStatus, updatedAt: now };
        } else {
          migrated[id] = val as StatusEntry;
        }
      }

      setStatuses(migrated);
      localStorage.setItem("dir-status", JSON.stringify(migrated));
    } catch {}
  }, []);

  function setStatus(id: string, value: SubmissionStatus) {
    setStatuses((prev) => {
      const updated = {
        ...prev,
        [id]: { status: value, updatedAt: new Date().toISOString() },
      };
      try {
        localStorage.setItem("dir-status", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }

  return { statuses, setStatus };
}

function exportCSV(statuses: Record<string, StatusEntry>) {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  };

  const acted = allDirectories.filter((d) => {
    const entry = statuses[d.id];
    return entry && entry.status !== "todo";
  });

  const headers = ["name", "url", "category", "da", "dr", "type", "dofollow", "status", "date_updated"];
  const rows = acted.map((d) => {
    const entry = statuses[d.id];
    return [
      escape(d.name),
      escape(d.url),
      d.category,
      d.da ?? "",
      d.dr ?? "",
      d.type,
      d.dofollow ? "yes" : "no",
      entry.status,
      entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "",
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();
  a.download = `saas-directories-backup-${day}-${month}-${year}.csv`;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
        borderRadius: "5px",
        padding: "2px 8px",
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "capitalize",
      }}
    >
      {type}
    </span>
  );
}

function DirectoriesTable({
  data,
  filterState,
  statuses,
  setStatus,
}: {
  data: Directory[];
  filterState: FilterState;
  statuses: Record<string, StatusEntry>;
  setStatus: (id: string, value: SubmissionStatus) => void;
}) {
  const [daSort, setDaSort] = useState<"desc" | "asc">("desc");

  const filtered = useMemo(() => {
    const rows = data.filter((d) => {
      const daOk =
        filterState.minDa === 0 || (d.da !== null && d.da >= filterState.minDa);
      const nameOk =
        !filterState.search ||
        d.name.toLowerCase().includes(filterState.search.toLowerCase());
      const typeOk =
        filterState.type === "all" || d.type === filterState.type;
      const categoryOk =
        filterState.category === "all" || d.category === filterState.category;
      const currentStatus = statuses[d.id]?.status ?? "todo";
      const statusOk =
        filterState.status === "all" || currentStatus === filterState.status;
      return daOk && nameOk && typeOk && categoryOk && statusOk;
    });

    return [...rows].sort((a, b) => {
      const av = a.da ?? -1;
      const bv = b.da ?? -1;
      return daSort === "desc" ? bv - av : av - bv;
    });
  }, [data, filterState, statuses, daSort]);

  const daColor = (da: number | null) => {
    if (da === null) return "var(--text-dim)";
    if (da >= 70) return "var(--da-high)";
    if (da >= 40) return "var(--da-mid)";
    return "var(--da-low)";
  };

  if (filtered.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px 0",
          color: "var(--text-dim)",
        }}
      >
        No directories match your filters.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr
            style={{
              borderBottom: "1px solid var(--border)",
              textAlign: "left",
            }}
          >
            {["#", "Name"].map((h) => (
              <th key={h} style={{ padding: "8px 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
            <th
              onClick={() => setDaSort((s) => (s === "desc" ? "asc" : "desc"))}
              style={{ padding: "8px 12px", fontSize: "11px", fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}
              title="Click to sort by DA"
            >
              DA / DR {daSort === "desc" ? "↓" : "↑"}
            </th>
            {["Type", "Dofollow", "Your Status"].map((h) => (
              <th key={h} style={{ padding: "8px 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((d, idx) => {
            const status = statuses[d.id]?.status ?? "todo";
            return (
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
                    padding: "10px 12px",
                    color: "var(--text-dim)",
                    fontSize: "12px",
                    width: "40px",
                  }}
                >
                  {idx + 1}
                </td>
                <td style={{ padding: "10px 12px", maxWidth: "280px" }}>
                  <span
                    {...(d.notes
                      ? { "data-tooltip": d.notes }
                      : {})}
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
                          marginLeft: "4px",
                          color: "var(--text-dim)",
                          fontSize: "11px",
                        }}
                      >
                        ℹ
                      </span>
                    )}
                  </span>
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontWeight: d.da !== null && d.da >= 70 ? 700 : 400,
                    color: daColor(d.da),
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {d.da ?? "—"}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <TypeBadge type={d.type} />
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    color: d.dofollow ? "var(--da-high)" : "var(--badge-rejected-text)",
                    fontWeight: 600,
                    fontSize: "13px",
                  }}
                >
                  {d.dofollow ? "✓ Dofollow" : "✗ Nofollow"}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <StatusDropdown
                    status={status}
                    onChange={(v) => setStatus(d.id, v)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p
        style={{
          padding: "12px",
          color: "var(--text-dim)",
          fontSize: "12px",
        }}
      >
        Showing {filtered.length} of {data.length} directories
      </p>
    </div>
  );
}

export default function DirectoriesApp() {
  const { statuses, setStatus } = useStatuses();

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    minDa: 0,
    type: "all",
    status: "all",
    category: "all",
  });

  const trackedCount = useMemo(
    () => Object.values(statuses).filter((e) => e.status !== "todo").length,
    [statuses]
  );

  const appliedCount = useMemo(
    () => Object.values(statuses).filter((e) => e.status === "applied" || e.status === "listed").length,
    [statuses]
  );

  const totalCount = allDirectories.length;
  const progressPct = totalCount > 0 ? (appliedCount / totalCount) * 100 : 0;

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const btn = (active: boolean): React.CSSProperties => ({
    background: active ? "var(--accent)" : "var(--bg-card)",
    color: active ? "#fff" : "var(--text-secondary)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "6px",
    padding: "5px 12px",
    fontSize: "13px",
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    transition: "all 0.1s",
  });

  function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div>
        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
          {label}
        </label>
        {children}
      </div>
    );
  }

  return (
    <div>
      {/* Export bar */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <button
          onClick={() => exportCSV(statuses)}
          disabled={trackedCount === 0}
          title={trackedCount === 0 ? "No entries tracked yet" : `Export ${trackedCount} tracked entries`}
          style={{
            background: trackedCount === 0 ? "var(--bg-card)" : "var(--accent)",
            color: trackedCount === 0 ? "var(--text-dim)" : "#fff",
            border: `1px solid ${trackedCount === 0 ? "var(--border)" : "var(--accent)"}`,
            borderRadius: "6px",
            padding: "6px 14px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: trackedCount === 0 ? "not-allowed" : "pointer",
            opacity: trackedCount === 0 ? 0.5 : 1,
            transition: "all 0.1s",
          }}
        >
          ↓ Export CSV{trackedCount > 0 ? ` (${trackedCount})` : ""}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "20px", alignItems: "flex-end" }}>

        <FilterGroup label="Search">
          <input
            type="text"
            placeholder="Filter by name…"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 10px", color: "var(--text)", fontSize: "13px", width: "200px", outline: "none" }}
          />
        </FilterGroup>

        <FilterGroup label="Min DA">
          <div style={{ display: "flex", gap: "4px" }}>
            {DA_FILTERS.map((f) => (
              <button key={f.value} style={btn(filters.minDa === f.value)} onClick={() => setFilter("minDa", f.value)}>{f.label}</button>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="Type">
          <div style={{ display: "flex", gap: "4px" }}>
            {(["all", "directory", "launch"] as const).map((c) => (
              <button key={c} style={btn(filters.category === c)} onClick={() => setFilter("category", c)}>
                {c === "all" ? "All" : c === "directory" ? "Directories" : "Launch Sites"}
              </button>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="Cost">
          <div style={{ display: "flex", gap: "4px" }}>
            {(["all", "free", "freemium", "paid"] as const).map((t) => (
              <button key={t} style={btn(filters.type === t)} onClick={() => setFilter("type", t)}>
                {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="My Status">
          <div style={{ display: "flex", gap: "4px" }}>
            {(["all", "todo", "applied", "listed", "rejected"] as const).map((s) => (
              <button key={s} style={btn(filters.status === s)} onClick={() => setFilter("status", s)}>
                {s === "all" ? "All" : STATUS_LABELS[s as SubmissionStatus]}
              </button>
            ))}
          </div>
        </FilterGroup>

      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
            You&apos;ve applied to{" "}
            <span style={{ color: "var(--text)", fontWeight: 700 }}>{appliedCount}</span>
            {" "}of{" "}
            <span style={{ color: "var(--text)", fontWeight: 700 }}>{totalCount}</span>
            {" "}directories
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>
            {progressPct.toFixed(1)}%
          </span>
        </div>
        <div style={{ height: "6px", background: "var(--border)", borderRadius: "99px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: progressPct + "%",
              background: "var(--accent)",
              borderRadius: "99px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
        <DirectoriesTable
          data={allDirectories}
          filterState={filters}
          statuses={statuses}
          setStatus={setStatus}
        />
      </div>
    </div>
  );
}
