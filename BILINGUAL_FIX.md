# Language switch and display fixes

- Restored the top-right Chinese / English switch. English is the default; `scopecheck-language` remembers the selection.
- Reused translation pairs from the teammate's bilingual `v5.js`. Original V2 HTML structure and `styles.css` remain intact.
- Integration forms, review actions, local AI status, progress, and success/error messages follow the language selection.
- Language changes do not rewrite project names, task titles, original evidence, saved suggestions, or input/textarea values. Previously saved Chinese content stays Chinese.
- New capture notes use an English generated filename in English mode. Existing source filenames stay unchanged.
- Local AI requests include the interface language. English feedback in English mode was tested against the real model; generated text is English and quotes remain verbatim. The small model may ignore English instructions on Chinese input; this is not an automatic translation guarantee.
- New-project actions use a semantic selector rather than Chinese button text.
- Restored the missing project-colour dot in task rows. Text had occupied the original CSS's 8px dot column. Task text now uses the remaining width and long lists scroll.
- Calendar headers show two-digit days; hovering reveals full dates. Short timelines use distinct date ticks.

Browser checks: EN → ZH → EN, input values unchanged, preference retained after reload, English project/task creation, real English AI generation. The original two-task reproduction measured 472px-wide text columns, 38px text height, and 24px-high date labels without wrapping.

Typecheck, 32 Node checks, and build pass. English model evidence: `verification/ollama-english.json`.

Prepared synthetic demo: <http://127.0.0.1:5190/#project/frame-project%3Abe6c1a7d-88fd-4247-b0e1-7c0a77445bcf>.
