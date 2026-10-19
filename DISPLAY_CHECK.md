# Display audit — 2026-10-18 (America/Toronto)

Work is isolated on `scopecheck/frame-adapter`. Original HTML layout and original `styles.css` are preserved. No project migration, model download, domain-rule change, or formal approval was performed during this audit.

## Day / month view follow-up

Day, Week and Month are now functional. This supersedes the earlier week-only limitation below. All three views use current-project date-only records and the same inclusive date projection; no hourly appointments are invented. Arrows move one day, week or calendar month according to the selected view. Month-end navigation clamps to the target month's last valid day. The native date input and Today work in every mode.

Month cells include adjacent-month dates, highlight today, and list tasks on every date in their inclusive range. Click a date to open Day; click a task in either view to open the existing task editor. Undated items remain available in Tasks without an invented calendar position. Saving retains all original Frame domain approval rules.

Verified in the real browser with existing ARC data: October 2026 renders 35 cells from September 28 through November 1; October 22 opens Day and shows the two actual overlapping tasks; a task opens Edit Task without saving; December 31 → next month produces January 31, 2027 and the January month grid; switching to Day on that date shows the empty-state message. EN → ZH → EN updates mode buttons and weekday names. At 390 × 844, the document width remains 375px including scrollbar effects; the 769px month grid scrolls inside a 353px panel. Temporary viewport was reset. Screenshots: `verification/calendar-month.png`, `verification/calendar-day.png`, `verification/calendar-month-mobile.png`.

Typecheck, 34 Node tests and build pass. Unit checks include leap February, month-end clamping, year transitions and daylight-saving dates. No project records were changed during browser verification.

## Fixed

- Both calendars use seven days, Monday through Sunday. Sunday was missing from the compact overview.
- Date-only tasks are clipped to the visible week using inclusive start/end dates. Missing one endpoint displays the known date only; completely undated tasks have no dated timeline bar.
- Calendar events use grid rows, not absolute top offsets in a fixed clipped box. The overview can scroll vertically; wide calendars scroll inside their containers on small screens.
- Replaced the unconnected day/month controls with previous week, today, next week and a native date input. The calendar remains a week view; hourly appointments and day/month views are not implemented.
- Timeline labels and dates are readable independently of bar width. One-day records no longer squeeze text into a narrow bar. Bars retain actual date proportions.
- Removed the static timeline grid that did not match the real date scale.
- Fixed the grid parent's minimum width so the timeline scrolls locally instead of widening the entire mobile page.
- Task-list phase, title and status no longer overlap. Review lists can scroll, long filenames/evidence can wrap, and capture dialogs have a viewport-height limit.
- Restored single-column mobile review/task panels, wrapped project summaries, and contained wide project/change tables.
- Home content is allowed to extend below a short desktop viewport instead of being clipped by the prototype's fixed maximum height.
- Language switching rerenders weekday labels. Task titles in hover/accessibility attributes are protected from dictionary substitutions.
- View navigation resets page scroll position.

## Real browser observations

Used the existing 11-item ARC seed read-only. At the normal desktop viewport, the weekly overview showed Mon 12 through Sun 18, and the full calendar showed the same seven dates. Clicking Next week changed the displayed period to 2026-10-19 through 2026-10-25 and displayed four real overlapping records, including the single-day review on Oct 20.

At 1280 × 800, the page document had no horizontal overflow (scrollWidth 1265, viewport 1280 with a vertical scrollbar). The full-calendar records were positioned in the expected columns. The timeline displayed separate readable titles/dates and proportional bars.

At 390 × 844, the first timeline inspection found an 843px document width. After fixing the parent grid minimum size, document scrollWidth became 375px (viewport 390 with scrollbar); the timeline itself was 296px wide with a 780px scrollable content area. The full calendar had a 317px wrapper around 929px content, with no whole-page horizontal overflow. Task, plan, baseline, change, review and settings views were opened at the narrow width. Project rows and the change table retain internal horizontal scrolling.

## Automated verification

- `npm run typecheck` — passed.
- `npm test` — 33 passed, 0 failed. Includes Sunday, daylight-saving week boundaries, cross-week clipping, one-day records, missing endpoints and undated records.
- `npm run build` — passed (dependency annotation warnings only).
- Original CSS SHA256 remains `359BB23E16472088C1CBBEFC4D1F476E5C477C33019F118A81E4C0D391C22ABC`.
- Local HTTP service returned 200 after the browser connection problem below.

## Verification limits

Browser control subsequently timed out repeatedly, including on inventory and existing-tab access. The final screenshot could not be saved, and the final small follow-up changes (font inheritance, reset-on-navigation, hover/accessibility translation protection and removing the home height cap) could not receive a fresh browser pass. New capture-dialog height behavior, populated review/change dialogs, locale rerendering and more-than-one-screen calendar events still need a fresh live pass when browser access resumes. Earlier screenshots shown in the working session are observations, not exported final evidence. No blanket claim that all possible display issues are eliminated is made.

If Chrome remains in a temporary test viewport, reset the viewport override after browser control is restored. The last successful browser observation was the narrow settings view; restoration was attempted but could not be confirmed.
