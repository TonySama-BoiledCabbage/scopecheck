Manage Your Tasks (ScopeCheck)
A local-first, bilingual (EN/中文) workspace that helps freelance designers catch scope creep before it becomes unpaid work.

Clients ask for "one small change" in a call, send references in chat, and mention deadlines in passing. Manage Your Tasks keeps the original messages and files. Google's open-weight Gemma 3 1B runs on your own machine through Ollama and flags possible requests and explicit dates. Every suggestion is tied to its source text, and nothing becomes a task, a scope change or a new deadline until a person approves it.

🎥 Demo: https://youtu.be/RJOVkdFahs8 📝 DEV post: pending publication — 🏷️ Hacktoberfest 2026 Week 2 snapshot: ../../tree/hackathon-week2-candidate-v1

Features
Source-first review. Messages and files are stored as originals, and every AI suggestion links back to the exact excerpt it came from.
Local AI request detection. Gemma 3 1B classifies source segments as likely requests.
Date suggestions you can trust. Gemma returns the exact date phrase it found. A deterministic resolver then checks that the phrase exists in the source and converts it relative to the message date (full dates, plus limited forms such as "within three days" / "三天内"). Ambiguous dates stay blank.
Approval boundaries. Confirming a request creates a task. Scope and delivery changes go through a separate written-approval flow, and earlier project baselines remain available.
Bilingual UI. Switch between English and Chinese from the header.
Honest fallbacks. Rule-based processing is a separately labelled option. If Ollama is unavailable, the app says so instead of silently pretending to use AI.
Privacy: everything stays on your machine
Data	Where it lives
Project metadata	Browser localStorage
Original files	Browser IndexedDB
Parsing & AI inference	Local-only HTTP endpoints + local Ollama
Cloud database	None
Client feedback often includes unreleased designs and NDA material. With a local open-weight model, none of it is sent to a hosted AI API.

Quick start (Windows)
Requirements: Node.js 22.18+, Python 3.12+ on PATH (used for file parsing), Ollama.

# 1. Install dependencies
npm ci

# 2. Download the local model (one-time setup; the app never downloads models for you)
ollama pull gemma3:1b

# 3. Start the app
npm run dev
Open http://127.0.0.1:5190/.

Windows shortcuts: START_LOCAL_AI.cmd starts Ollama (using a portable runtime if present, otherwise your installed Ollama), and START_SCOPECHECK.cmd starts the app.
If Ollama is already running, don't start a second server.
Keep the same browser, host and port, because your data is stored per browser origin.
Don't open index.html directly or deploy to a static host. The parser and AI endpoints run as Vite plugins.
Using the AI: go to Capture Context → Ollama Local AI, select gemma3:1b and save. To process an existing original, use Review → Organise Latest Original with Local AI.

Python not on PATH? Copy .env.example to .env.local and set FRAME_PYTHON. Optional FRAME_PARSER_PATH / FRAME_MODELS_PATH point to local parser dependencies and speech models. Advanced PDF/OCR/media parsing needs extra optional Python packages, and missing ones produce an explicit error.

How it works
Client message / file
        │
        ▼
 Stored as original (IndexedDB)
        │
        ▼
 Split into segments
        │
        ▼
 Gemma 3 1B (local, Ollama) ── classifies requests, returns exact date phrases
        │
        ▼
 Deterministic checks ── phrase must exist in source · schema validation · date resolution
        │
        ▼
 Human review ── confirm → task   |   scope/date change → separate approval + baseline
Gemma's role is deliberately narrow: a small model can miss or misread things, so it suggests and points at evidence, while rules and a person decide.

Known limitations
Indirect requests can be missed. Date and relative-date support is intentionally limited.
AI precision and recall have not been measured on a representative dataset. Automated tests cover app behavior, not model accuracy.
Creating items by clicking or dragging on an empty timeline is unreliable. Use the task form instead.
Not connected yet: account sync, email/chat integration, cloud persistence, time tracking.
This repo does not include Ollama binaries, model weights, Python dependencies, browser data or any client files.
See MAINTENANCE.md for the current selector, known failure modes and the contribution workflow.

Verify
npm run typecheck
npm test
npm run build
With the dev server running, /tests/interactions.html runs a UI regression check without saving data, and /tests/flow.html exercises storage and approval flows using clearly marked test projects. See API.md for endpoints and VERIFICATION.md for recorded checks.

中文说明
Manage Your Tasks 是一个本地优先、中英双语的项目工作台，帮助独立设计师整理客户反馈，防止范围蔓延。

本地运行 Google 开源权重模型 Gemma 3 1B（通过 Ollama），识别可能的需求和明确日期，每条建议都附带原文出处。
确认需求后才会生成任务；范围或交付日期的变更需要单独审批，并保留历史基线。
数据只保存在当前浏览器（localStorage / IndexedDB），没有云端数据库。
启动：npm ci → ollama pull gemma3:1b → npm run dev，然后打开 http://127.0.0.1:5190/ 。

Team
TonySama-BoiledCabbage (DEV)
DD998855 (DEV)
Built on the original ScopeCheck V2 HTML/CSS prototype and Frame's local domain services. A small TypeScript adapter connects the original layout to real data and local services.

Hacktoberfest 2026 submission
Built for the Hacktoberfest Open-Source AI Challenge, Week 2: Side Hustle. The Week 2 cutoff was 2026-10-19 06:59 UTC. The frozen `hackathon-week2-candidate-v1` verification record uses Qwen 2.5 1.5B. The current local demo and ongoing maintenance prioritize Gemma 3 1B through Ollama. These are distinct versions; the frozen Qwen snapshot is not presented as evidence for a Gemma prize entry. Later work is listed below and is not part of the frozen snapshot.

Post-deadline commit	Date (UTC)	Change
—	—	—
License
Project code is released under the MIT License. Third-party dependencies and model weights keep their own licenses. Gemma is provided under the Gemma Terms of Use.
