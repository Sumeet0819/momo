# AI Desktop Assistant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a lightweight, always-accessible AI desktop assistant inspired by Hitodama on Windows 11/10 that lives in a compact floating interface at the top of the user's screen with streaming AI assistance, voice dictation, screen capture, desktop tools, and scheduled routines.

**Architecture:** A native Tauri 2 application where a Rust backend core handles window management (frameless, transparent, always-on-top, hover expansion/pinning), global shortcuts, audio recording, screen capture, tool execution, and SQLite persistence. A lightweight React 19 + TypeScript + Zustand + Tailwind CSS frontend provides a sleek, fluid floating UI pill that expands into a rich multi-mode assistant panel.

**Tech Stack:** Tauri 2, Rust (tauri-plugin-opener, tauri-plugin-global-shortcut, rusqlite/sqlx), React 19, TypeScript, Vite, Tailwind CSS, Zustand, Lucide React, Lottie Web, Google Gemini API.

---

### Task 1: Scaffolding and Environment Verification

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `src/index.css`
- Modify: `src/App.css`

**Step 1: Configure Tailwind CSS v4 in Vite**
Configure `@tailwindcss/vite` plugin in `vite.config.ts` and set up modern glassmorphism styling in `src/index.css`.

**Step 2: Verify Frontend Build**
Run: `npm run build`
Expected: PASS with clean bundle output.

---

### Task 2: Floating Pill & Expanded Panel State Management (Zustand)

**Files:**
- Create: `src/types/assistant.ts`
- Create: `src/store/useAssistantStore.ts`

**Step 1: Define types and data models**
Define modes (`idle`, `chat`, `screen_qa`, `dictation`, `tools`, `tasks`, `settings`), messages, streaming states, tool permissions, and scheduled tasks.

**Step 2: Create Zustand store**
Implement state for expansion (`isExpanded`, `isPinned`, `isHovered`), current view/tab, active conversation, message stream, audio recording status, screen selection box, and error alerts.

---

### Task 3: Floating Island UI Components (Hitodama-inspired Floating Shell)

**Files:**
- Create: `src/components/FloatingPill.tsx`
- Create: `src/components/AssistantPanel.tsx`
- Create: `src/components/ChatView.tsx`
- Create: `src/components/VoiceDictationView.tsx`
- Create: `src/components/ScreenCaptureView.tsx`
- Create: `src/components/ToolsView.tsx`
- Create: `src/components/TasksView.tsx`
- Create: `src/components/SettingsView.tsx`
- Modify: `src/App.tsx`

**Step 1: Build the compact pill header**
A sleek floating pill with an ambient glow indicator, quick status badge, and hover-triggered expansion with pin toggle.

**Step 2: Build the modular tabs & views**
Implement the Chat view with streaming responses, code blocks, and markdown; Voice dictation preview; Screen capture region overlay; Desktop tools dashboard; Scheduled routines; and API settings.

---

### Task 4: Tauri 2 Window Configuration & Native Bridge (Rust)

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/window.rs`
- Create: `src-tauri/src/ai.rs`
- Create: `src-tauri/src/tools.rs`
- Create: `src-tauri/src/db.rs`

**Step 1: Configure Tauri window properties**
Set window to `decorations: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, with top-centered initial positioning.

**Step 2: Implement Rust native command handlers**
Expose typed Tauri commands:
- `resize_window(width, height)`: smoothly adjusts window dimensions for collapsed (compact pill) vs expanded state.
- `set_pinned(pinned)`: keeps window expanded when pinned.
- `stream_chat(prompt, context)`: invokes Gemini API with streaming events.
- `capture_screen_region(x, y, w, h)`: captures bounded screen rectangle for vision QA.
- `execute_desktop_tool(tool_id, args)`: executes permitted tools with validation.

---

### Task 5: AI Provider Integration (Gemini Multimodal)

**Files:**
- Create: `src/services/aiService.ts`
- Create: `src-tauri/src/ai.rs`

**Step 1: Implement Gemini API client with streaming**
Handle Gemini 2.0 / 1.5 streaming text generation, multimodal image inputs (screen capture QA), tool calling schemas, cancellation tokens, and local history management.

---

### Task 6: Testing, Performance Benchmarking & Hardening

**Files:**
- Run idle CPU and memory inspection.
- Validate hover collapse delay (prevents flicker).
- Verify Windows boundary constraints and scaling factors.
