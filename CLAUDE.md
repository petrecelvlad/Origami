# Claude Companion

You are a Claude agent working on Project Origami. Read this immediately after `AGENT.md`. This is your provider-specific onboarding — it makes you effective in one pass.

## Onboarding Sequence

Read in this order. Each step gives you a specific capability:

1. `AGENT.md` (already read) — Constitution: phases, guardrails, standing rules.
2. `cone/PHILOSOPHY.md` — Framework philosophy: what this system is and why it exists.
3. `cone/agent/onboarding/START_HERE.md` — Framework orientation: what to read next and why.
4. `cone/agent/onboarding/CODING_COMPANION.md` — Coding standards: naming, functions, errors, types.
5. `cone/project/architecture/OVERVIEW.md` — System architecture: what was built and why. Links onward into `docs/01_BLUEPRINTS/` and `docs/02_DOMAIN_LOGIC/` for full technical depth.
6. `cone/agent/personas/COMMUNICATOR.md` — Always-active communication persona. Adopt immediately.

If you are about to write or modify code, also read:
7. `cone/agent/personas/DEVELOPER.md` — Developer persona. Adopt for all coding sessions.
8. `docs/01_BLUEPRINTS/05_GUARDRAILS.md` and `docs/01_BLUEPRINTS/04_MAP.md` — the constraint registry and file-placement heuristics referenced from `AGENT.md` Section 1 and 6.

---

## Two Documentation Systems, One Project

This project has a pre-existing documentation system at `docs/` (the "Knowledge Operating System" — `docs/00_BOOTLOADER/00_START_HERE.md` is its entry point). `cone/` is a newer, more general framework layered on top per its own retrofit guide. They are not redundant:

- `docs/` — deep, Origami-specific technical specs: physics, neural architecture, genetics, per-domain blueprints, full session history back to project inception. This is the source of truth for *how the simulation works*.
- `cone/project/` — structured project-level knowledge: architecture summary, curated memory (anti-patterns/lessons), specs, roadmap. Written to be legible without reading all of `docs/` first.
- `cone/agent/` — how an agent should think and work on *any* project using this framework (personas, skills, session protocol).

When in doubt about implementation details (physics constants, neural wiring, genetics), go to `docs/02_DOMAIN_LOGIC/`. When in doubt about how to behave as an agent, go to `cone/agent/`.

---

## Session Protocol

One conversation = one session file. Sessions serve dual purpose: live tracking during work AND permanent archive after.

**Full protocol:** Read `cone/agent/onboarding/SESSIONS.md` before creating any session file.

**Quick reference:**
- **Location:** `cone/agent/sessions/MM_Month/Week_N/YYYY-MM-DD/`
- **File format:** `NN_SEMANTIC_TITLE.md` — NN is a global counter, title is 2-4 words
- **Template:** Copy `cone/agent/sessions/SESSION_TEMPLATE.md`
- **Before creating:** Check for `IN-PROGRESS` or `HANDOFF` status in recent sessions — continue from them, don't start fresh
- **Statuses:** `PLANNING` → `IN-PROGRESS` → `COMPLETE ✅` or `HANDOFF ✋`
- **Never delete** session files — they are the project's permanent history

Note: `docs/06_ROADMAP/01_SESSIONS/` holds the project's pre-cone session archive (numbered 00-09). `cone/agent/sessions/` starts a fresh, dated archive going forward — it does not renumber or duplicate the old one.

---

## Memory Rules

### What to save (in `cone/project/memory/`)

Save if ALL are true:
- It's a behavioral correction or confirmed practice
- The WHY is non-obvious and not derivable from the code or docs
- It applies across multiple future sessions

### What NOT to save

- Implementation state, version numbers, feature status
- Anything derivable by reading the code or git history
- Session-specific context (that goes in session files)
- Solutions to bugs (the fix is in the code; the commit message has context)

### Where to save

| What | Where |
|---|---|
| A mistake with a non-obvious root cause | `cone/project/memory/ANTI_PATTERNS.md` |
| A practice confirmed to work well | `cone/project/memory/LESSONS.md` |
| A known failure mode with a fix | `cone/project/memory/PLAYBOOK.md` |

---

## OKF (Open Knowledge Format)

The `cone/` directory is an OKF v0.1 conformant knowledge bundle. This means:

- **Every markdown file** in `cone/` (except `index.md` and `log.md`) has YAML frontmatter with at least a `type` field. This replaces the old `@propolis` JSON blocks in markdown.
- **`@propolis` in code files** is unchanged — it still uses JSON in language-appropriate comments. OKF only governs the markdown knowledge bundle.
- **`index.md` files** exist at each directory level for progressive disclosure. They have no frontmatter — they're directory listings, not concept documents.
- **Cross-links** between documents use relative markdown paths (e.g., `[SESSIONS.md](./SESSIONS.md)`) so the OKF graph visualizer can detect edges.
- **Concept IDs** are derived from file paths (no explicit `id` field). `agent/personas/DEVELOPER` is the concept ID for `cone/agent/personas/DEVELOPER.md`.
- **Extension fields** (`constraints`, `agent_instructions`, `always_active`, `scope`) are cone-specific additions that OKF explicitly permits.

**Visualizer:** Run `python -m reference_agent visualize --bundle cone --out cone_viz.html --name "cone-lite"` (requires the `reference-agent` package from `GoogleCloudPlatform/knowledge-catalog`). Opens as a self-contained HTML graph in any browser.

**Design docs:** `cone/evolution/OKF/` contains the spec extract, original concept, and accepted adaptation design.

---

## Non-Obvious Pointers

- This project has no git repository initialized yet (as of the cone-lite migration) — there is no commit history or version control safety net. Be extra cautious with destructive file operations until that changes.
- `.AGENT` (no extension, root of the repo) is the pre-cone-lite constitution. Its content has been merged into `AGENT.md`; it has been left in place rather than deleted since there's no git history to recover it from if that turns out to be wrong. Treat `AGENT.md` as authoritative going forward.
- Directive 4 in the old `.AGENT` file ("Determinism: simulation state must be serializable and reproducible") and C-003 (Immutable State) both bear on save/load — see `docs/01_BLUEPRINTS/SAVE_ARCHITECTURE.md` and `docs/04_INFRASTRUCTURE/03_PERSISTENCE.md` before touching persistence code.

---

## Creating a Companion for Another Provider

To create `GEMINI.md`, `COPILOT.md`, or any other provider companion:

1. Copy this file's structure (Onboarding Sequence, Session Protocol, Memory Rules)
2. Adapt the onboarding sequence to the provider's capabilities
3. Adjust memory rules to match the provider's context management
4. Keep the session protocol identical — it's provider-agnostic
5. Register the new companion in `AGENT.md` under "Agent-Specific Companion Files"
