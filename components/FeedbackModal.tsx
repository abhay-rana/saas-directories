"use client";

import { useState, useRef, useEffect } from "react";

type Category = "Bug Report" | "Wrong Info" | "Missing Directory" | "Feature Request";

const CATEGORIES: Category[] = ["Bug Report", "Wrong Info", "Missing Directory", "Feature Request"];

const MAX_CHARS = 500;

export default function FeedbackModal({ headerButton = false }: { headerButton?: boolean }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [dirName, setDirName] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // focus textarea when modal opens
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 80);
  }, [open]);

  function handleClose() {
    setOpen(false);
    setCategory(null);
    setDirName("");
    setText("");
    setSubmitted(false);
  }

  async function handleSubmit() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const description = category === "Wrong Info" && dirName.trim()
        ? `[${dirName.trim()}] ${text.trim()}`
        : text.trim();

      await fetch("https://api.resumefreepro.com/api/feedback/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: category ?? "General",
          description,
          source: "saas-directories",
        }),
      });
      setSubmitted(true);
      setTimeout(handleClose, 1800);
    } catch {
      // fail silently — feedback is best-effort
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = text.trim().length > 0;

  return (
    <>
      {/* Header button or FAB */}
      {headerButton ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Send feedback"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            borderRadius: "6px",
            background: "transparent",
            border: "1px solid var(--border)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-secondary)",
            transition: "border-color .15s, color .15s",
          }}
          onMouseOver={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
          }}
          onMouseOut={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
          }}
        >
          <ChatIcon />
          Feedback
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Send feedback"
          style={{
            position: "fixed",
            bottom: "28px",
            right: "28px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "99px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            boxShadow: "0 2px 14px rgba(0,0,0,.18)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text)",
            zIndex: 900,
            transition: "box-shadow .2s, transform .15s",
          }}
          onMouseOver={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 22px rgba(0,0,0,.28)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
          }}
          onMouseOut={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 14px rgba(0,0,0,.18)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
          }}
        >
          <ChatIcon />
          Feedback
        </button>
      )}

      {/* Overlay */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          {/* Card */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "440px",
              padding: "26px",
              boxShadow: "0 24px 60px rgba(0,0,0,.4)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--text)" }}>
                Send Feedback
              </h2>
              <button
                onClick={handleClose}
                aria-label="Close"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  fontSize: "22px",
                  lineHeight: 1,
                  padding: "0 4px",
                }}
              >
                ×
              </button>
            </div>
            <p style={{ margin: "0 0 22px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Help us improve by sharing your thoughts
            </p>

            {/* Category */}
            <div style={{ marginBottom: "18px" }}>
              <div style={labelStyle}>Category</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(prev => prev === cat ? null : cat)}
                    style={{
                      padding: "7px 15px",
                      borderRadius: "99px",
                      border: "1px solid",
                      borderColor: category === cat ? "var(--accent)" : "var(--border)",
                      background: category === cat ? "var(--accent)" : "transparent",
                      color: category === cat ? "#fff" : "var(--text-secondary)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all .15s",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Which directory — shown only for Wrong Info */}
            {category === "Wrong Info" && (
              <div style={{ marginBottom: "16px" }}>
                <div style={labelStyle}>Which directory?</div>
                <input
                  type="text"
                  placeholder="e.g. ProductHunt, BetaList…"
                  value={dirName}
                  onChange={e => setDirName(e.target.value)}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={e => (e.target.style.borderColor = "var(--border)")}
                />
              </div>
            )}

            {/* Textarea */}
            <div style={{ marginBottom: "20px" }}>
              <textarea
                ref={textareaRef}
                placeholder="Your feedback…"
                value={text}
                onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
                style={{ ...inputStyle, height: "120px", resize: "none", lineHeight: 1.5, fontFamily: "inherit" }}
                onFocus={e => (e.target.style.borderColor = "var(--accent)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}
              />
              <div style={{ textAlign: "right", fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                {text.length}/{MAX_CHARS}
              </div>
            </div>

            {/* Success state */}
            {submitted ? (
              <div style={{ textAlign: "center", padding: "8px 0", fontSize: "14px", fontWeight: 600, color: "#4ade80" }}>
                ✓ Thanks for the feedback!
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: canSubmit && !submitting ? "pointer" : "not-allowed",
                  background: canSubmit && !submitting ? "var(--accent)" : "var(--border)",
                  color: canSubmit && !submitting ? "#fff" : "var(--text-secondary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  transition: "background .2s, color .2s",
                }}
              >
                {submitting ? "Sending…" : "Submit Feedback"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ChatIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: ".06em",
  marginBottom: "8px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: "13px",
  outline: "none",
  transition: "border-color .15s",
};
