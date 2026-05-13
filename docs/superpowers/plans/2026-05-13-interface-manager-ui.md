# Interface Manager UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the RPA tool as an interface asset manager where saved crawler interfaces can be reused, edited in a modal, and stored to Excel, SQLite, or both.

**Architecture:** Keep Vue + Vite + Electron. Split UI responsibilities into a dashboard shell, interface configuration modal, and result panel. Keep raw JSON as trace evidence, and route Excel/SQLite writes through Electron main process with Python stdlib SQLite for zero intranet installs.

**Tech Stack:** Vue 3, TypeScript, Vite, Electron IPC, ExcelJS, Python sqlite3.

---

### Task 1: Interface Configuration Model

**Files:**
- Create: `src/types.ts`
- Modify: `electron/index.ts`
- Modify: `electron/preload/main/index.ts`

- [ ] Define `CrawlerConfig` with request, parse, and storage fields.
- [ ] Add optional `storageTarget`, `outputDir`, `databasePath`, `tableName`, `primaryKey`, and `writeMode`.
- [ ] Add an IPC method for choosing a directory in Electron.

### Task 2: Modal-Based UI

**Files:**
- Replace: `src/App.vue`
- Create: `src/components/InterfaceConfigModal.vue`
- Create: `src/components/RunResultPanel.vue`
- Replace: `src/style.css`

- [ ] Make the landing screen an interface list.
- [ ] Move configuration into a modal opened by New/Edit.
- [ ] Keep browser preview mode saving to `localStorage`.
- [ ] Show storage target and paths in the interface list.

### Task 3: Storage Execution

**Files:**
- Create: `python/crawler_store.py`
- Modify: `electron/index.ts`

- [ ] Always write `raw.json`, `rows.json`, and `meta.json`.
- [ ] Write Excel only when `storageTarget` is `excel` or `both`.
- [ ] Write SQLite only when `storageTarget` is `database` or `both`.
- [ ] Support append, overwrite, and upsert.

### Task 4: Verification

**Files:**
- Build artifacts only.

- [ ] Run `node scripts\build-offline.mjs`.
- [ ] Run pure UI preview at `http://127.0.0.1:5178/`.
- [ ] Confirm interface list, modal editing, local preview save, and build output.
