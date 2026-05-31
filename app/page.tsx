import DirectoriesApp from "@/components/DirectoriesApp";
import ThemeToggle from "@/components/ThemeToggle";
import { saasDirectories, launchSites } from "@/lib/directories";

export default function Home() {
  const totalCount = saasDirectories.length + launchSites.length;

  return (
    <>
      <header
        style={{
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "52px",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--text)" }}>
            SaaS Directories
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <a
              href="https://github.com/abhay-rana/saas-directories"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              ★ Contribute on GitHub
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Hero — SEO rich, human-written */}
        <section style={{ marginBottom: "40px" }}>
          <h1
            style={{
              fontSize: "clamp(22px, 4vw, 32px)",
              fontWeight: 800,
              color: "var(--text)",
              lineHeight: 1.2,
              marginBottom: "12px",
            }}
          >
            {totalCount}+ Places to Submit Your SaaS — Sorted by DA
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: "var(--text-secondary)",
              maxWidth: "640px",
              lineHeight: 1.7,
              marginBottom: "16px",
            }}
          >
            Every indie hacker and SaaS founder goes through the same grind: finding
            where to submit their product for backlinks, traffic, and early users. This
            list has {saasDirectories.length} SaaS directories and{" "}
            {launchSites.length} launch sites — curated, sorted by Domain Authority, and
            kept up to date by the community.
          </p>
          <p
            style={{
              fontSize: "14px",
              color: "var(--text-secondary)",
              lineHeight: 1.7,
            }}
          >
            Click the status badge on any row to track your own submission progress.
            Your data stays in your browser — no account needed. Want to add a directory
            or update data?{" "}
            <a
              href="https://github.com/abhay-rana/saas-directories"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)" }}
            >
              Open a pull request on GitHub
            </a>
            .
          </p>
        </section>

        {/* Stats bar */}
        <section
          aria-label="Quick stats"
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "32px",
          }}
        >
          {[
            { label: "SaaS Directories", value: saasDirectories.length },
            { label: "Launch Sites", value: launchSites.length },
            { label: "DA 70+ Sites", value: saasDirectories.filter((d) => d.da !== null && d.da >= 70).length },
            { label: "Free Listings", value: saasDirectories.filter((d) => d.type === "free").length + launchSites.filter((d) => d.type === "free").length },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "12px 20px",
                minWidth: "130px",
              }}
            >
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "var(--text)",
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  marginTop: "4px",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </section>

        {/* Interactive table */}
        <DirectoriesApp />

        {/* SEO footer content */}
        <section
          style={{
            marginTop: "64px",
            paddingTop: "32px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: "12px",
            }}
          >
            How to use this list
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "32px",
            }}
          >
            {[
              {
                step: "1",
                title: "Filter by DA",
                body: "Start with DA 70+ directories — they carry the most SEO weight and often have real user bases. Work your way down as you go.",
              },
              {
                step: "2",
                title: "Mark as Applied",
                body: "Click the status badge to cycle from To Do → Applied → Listed → Rejected. Your progress saves in your browser automatically.",
              },
              {
                step: "3",
                title: "Launch sites next",
                body: "Switch to Launch Sites after your main directory submissions. These are community-driven platforms where users upvote and discover new products.",
              },
              {
                step: "4",
                title: "Contribute back",
                body: "Know a directory that's missing? Open a GitHub PR with the name, URL, and DA. The list gets better when founders help each other.",
              },
            ].map((c) => (
              <div
                key={c.step}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--accent)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "6px",
                  }}
                >
                  Step {c.step}
                </div>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: "6px",
                  }}
                >
                  {c.title}
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {c.body}
                </p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.7 }}>
            Built by{" "}
            <a
              href="https://abhayrana.com"
              style={{ color: "var(--accent)" }}
            >
              Abhay Rana
            </a>{" "}
            · Data is community-sourced and may not be 100% accurate · DA/DR figures
            sourced from Moz and Ahrefs · Last updated May 2026
          </p>
        </section>
      </main>
    </>
  );
}
