# Manage Your Tasks

A bilingual, local-first project workspace for independent designers. Manage Your Tasks turns client messages and files into reviewable requirement candidates, with source evidence, formal change review and versioned project baselines.

Built from the original ScopeCheck V2 HTML/CSS prototype and Frame local domain services. The original layout is retained; a small TypeScript adapter binds real data and local HTTP services.

## Team

- [TonySama-BoiledCabbage](https://github.com/TonySama-BoiledCabbage) — project contributor.
- [DD998855](https://github.com/DD998855) — project contributor.

## Run locally

Requires Node.js 22.18+ and Python 3.12+ on PATH for file parsing. The basic text workflow needs no Python packages beyond the standard library.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5190/. Keep the same browser, hostname and port to keep using the same local data. Windows users may run `START_SCOPECHECK.cmd` after installing Node dependencies. Do not open index.html directly or use a static-only host: the parser and local AI endpoints run through Vite plugins.

If Python is not on PATH, copy `.env.example` to `.env.local` and set `FRAME_PYTHON` to your Python executable. Optional `FRAME_PARSER_PATH` and `FRAME_MODELS_PATH` point to existing local parser dependencies and speech models. These paths are machine-specific and are not committed. Advanced PDF/OCR/media support requires the corresponding optional Python packages and local assets; missing dependencies produce an explicit error.

## Local open-weight AI

Install [Ollama](https://ollama.com/) yourself and prepare the model explicitly:

```sh
ollama pull qwen2.5:1.5b
ollama serve
```

If Ollama is already running, do not start a second server. Model download is a user setup step: ScopeCheck does not automatically download models. The optional Windows launcher `START_LOCAL_AI.cmd` uses the existing portable runtime if present, otherwise an installed Ollama.

In **Capture Context**, select **Ollama Local AI**, choose the installed model and save. An existing original can be processed from **Review → Organise Latest Original with Local AI**. English/Chinese interface switching is available in the header.

Qwen classifies source segments locally; a labelled request-wording check and verbatim excerpts constrain the results. Every candidate remains subject to human review. Model mistakes and missed requests remain possible; all original segments can be inspected separately. Rule-based processing is an explicit, separately labelled option, never an invisible fallback. An unavailable Ollama service disables AI processing and shows its status.

## Data and approval boundaries

- Project metadata lives in browser localStorage; original files live in IndexedDB. There is no cloud project database or server-side project CRUD.
- Parsing and AI run through local-only HTTP endpoints. Original files are retained before processing; failures preserve the original for retry.
- Confirming requirement content does not approve a scope or date change. Formal changes use Frame domain validation and written approval records; old baselines remain available.
- `/clear` in the search box resets projects and drafts in the current browser origin, retaining recovery backups. Restore via **Local AI → Restore Previous Samples**. Originals and models are retained.
- Day/week/month calendars display date ranges. They do not invent hourly appointments.

## Known limitations

Creating content directly on the timeline is currently reported as unreliable and is deferred. Use the task form for supported task operations; direct timeline creation is not claimed as complete. Account sync, email/chat integration, cloud persistence and focus/time tracking are not connected. This repository does not bundle Ollama binaries, model weights, Python dependencies, browser data or private originals.

## Verify

```sh
npm run typecheck
npm test
npm run build
```

With the dev server running, `/tests/interactions.html` runs a small interface regression check without saving new project data. `/tests/flow.html` exercises storage and approval flows and creates explicitly marked test projects. See [API.md](API.md) for endpoints and [VERIFICATION.md](VERIFICATION.md) for recorded checks. Older implementation notes describe the original development machine and should not be treated as a portable setup guide.

## 中文说明

本项目保留队友原始 ScopeCheck V2 的 HTML、CSS 和布局，通过薄适配层接入 Frame 的本地项目、任务、原件解析、需求审核、正式变更与基线规则。数据保存在当前浏览器来源中，不是云端数据库。使用 `npm ci`、`npm run dev` 启动，打开 5190 页面；本地 AI 使用 Ollama 与 Qwen，规则整理明确单列。时间轴直接创建内容问题暂时搁置。

## License

Project code is available under the [MIT License](LICENSE). Third-party dependencies and model weights retain their own licenses. Qwen model licensing evidence is retained in [verification/QWEN_MODEL_LICENSE.txt](verification/QWEN_MODEL_LICENSE.txt).

## Submission snapshot and continued development

The current algorithm is experimental; there is no measured representative accuracy claim. See [MAINTENANCE.md](MAINTENANCE.md) for the current selector, known failure modes, provisional evaluation examples and contribution workflow. The `hackathon-week2-candidate-v1` tag is a frozen candidate, not proof of a published submission. Runtime source baseline: `6f3d3f5b96dd10820e54de5ac68dcf3126341893`.

Week 2 cutoff is October 19, 2026 at 06:59 UTC (02:59 in Toronto). Keep later maintenance separate from the recorded entry; note every post-deadline commit below as required by the challenge FAQ. Do not move the candidate tag to incorporate later work.

| Post-deadline commit | Date (UTC) | Change | Included in submitted demo? |
| --- | --- | --- | --- |
| None recorded when this section was prepared | — | Add a row for each future post-deadline commit | — |

## Review-to-timeline follow-up

On `fix/review-to-timeline`, saving an internal work item opens Plan; saving a scope-risk proposal opens its change review. Previously submitted suggestions retain links to the saved change or task. Undated tasks remain listed without an invented date bar. Pending item proposals are shown as explicitly labelled dashed previews in the calendars and project timeline; they do not alter tasks or baselines. `/tests/review-timeline.html` checks this path with a labelled synthetic project. This is a follow-up to the frozen v1 candidate, which remains unchanged. Direct creation by clicking/dragging an empty timeline is still outside this fix.

The materialisation logic now reuses the original Frame `features/Capture.tsx` behaviour: ordinary new entries default to internal tasks, existing placement dates/links are retained, and source references are appended to task descriptions. Formal nodes and registered scope risk still require domain review. Existing proposals are not migrated or automatically approved. This follow-up changes data binding only; it does not change the existing form template, HTML or CSS.

## AI-assisted requirement dates

The local Qwen path now returns an exact `dateQuote` as well as its request classification. A deterministic resolver verifies that phrase against the original unit and resolves ISO dates, full English month dates, Chinese calendar dates, and a limited set of relative calendar-day expressions (such as `within three days` or `三天内`). Relative dates and omitted years require an unambiguous source-message date; upload time is never used as the anchor. Ambiguous numeric dates, unknown years, conflicting dates, business-day arithmetic and vague weekdays remain for manual entry.

Verified dates populate the existing suggestion placement and existing Create Work Item date fields. Review/confirmation and saving remain separate; task creation is not triggered merely by parsing. Manual placements are preserved. Calendar-only dates are supported; meeting hours remain in source evidence. Formal rescheduling still requires the existing approval path. To check the real installed model without project writes: `node scripts/verify-ai-dates.mjs`. Browser end-to-end check: `/tests/review-timeline.html?ai-dates` (creates a labelled test project; prefer `localhost:5190` to isolate it from a `127.0.0.1` demo).
