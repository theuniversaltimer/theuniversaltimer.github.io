# Copilot / AI Agent Instructions — Alarm Generator

Short: a small single-page React + Vite app that lets users build sequence-based alarms (loops, waits, sounds). Use these notes to move quickly and make safe, focused edits.

- Project entry / dev:
  - Run locally: `npm install` then `npm run dev` (Vite). Build with `npm run build`.
  - Lint: `npm run lint`.

- Big picture architecture:
  - SPA React app (Vite). Entry: `src/main.tsx` → `src/App.tsx`.
  - `App.tsx` toggles two primary views: the Alarm Grid and the Alarm Editor.
  - Persistence: `src/hooks/useAlarms.ts` — keeps alarms in `localStorage` under key `alarm-generator-alarms` and seeds a single example alarm when empty.
  - Runtime execution: `src/hooks/useAlarmRunner.ts` — runs `Alarm.blocks` sequentially (supports nested `loop` blocks), uses `sleep`, `unitToMs`, and `msUntilTime` from `src/utils/time.ts`. Sounds use the browser `Audio` API.

- Core data shapes (see `src/types.ts`):
  - `Alarm`: `{ id, name, blocks: Block[] }`.
  - `Block`: union of `loop | wait | waitUntil | playSound`.
  - `loop` contains `repeat` and `children: Block[]` (nested sequences).

- Editor & DnD behavior (most important — read before editing):
  - `src/components/AlarmEditor.tsx` implements drag-and-drop. Key helpers you may use/modify:
    - `DND_TYPE` constant and drag payloads: `{ kind: 'palette', blockType }` or `{ kind: 'existing', blockId }`.
    - `createDefaultBlock(type)` — creates a new block with a unique id via `createId()`.
    - Tree operations: `updateBlockTree`, `deleteBlockTree`, `insertRelative`, `moveBlock` — these implement immutable updates on nested `loop.children` and should be reused instead of mutating blocks.
  - Drop semantics: dropping on the root appends (palette) or moves after last block (existing). Dropping on a block supports `before`, `after`, and `inside` (inside only for `loop`). There is also a top-insert line (when blocks exist) to insert at the start.

- Where to make common changes:
  - To change execution semantics (timing, audio): edit `src/hooks/useAlarmRunner.ts`.
  - To change persistence or default seed data: edit `src/hooks/useAlarms.ts` (note `STORAGE_KEY`).
  - To adjust DnD or editor UI behavior: edit `src/components/AlarmEditor.tsx` (see `insertRelative` / `moveBlock`).
  - To add new block types: update `src/types.ts`, add UI in `AlarmEditor`, and implement runtime handling in `useAlarmRunner`.

- Project patterns & conventions:
  - Use immutable updates for nested blocks (helper functions in `AlarmEditor`). Avoid direct mutations.
  - IDs: always generate new ids with `src/utils/ids.ts::createId()`.
  - Styling: Tailwind is used. UI relies on custom utility classes like `pastel-card`, `soft-input`, `soft-button` (search `src/index.css` for tokens if you need to change visuals).
  - Browser APIs: localStorage and `Audio` are used directly — changes affect client-only behavior (no backend to update).

- Debugging tips & behavior notes:
  - The example alarm is created automatically if `localStorage` is empty; to reset state, clear `localStorage` key `alarm-generator-alarms`.
  - To test runtime flows, call `useAlarmRunner.start(alarm)` via the UI PlayMenu; the runner sets `activeBlockId` which components use to highlight the active step.
  - For audio troubleshooting, inspect `useAlarmRunner` where `new Audio(url)` is created. Default URL: Google Actions alarm sound; custom sound is supported on `playSound` blocks.

- Files to check first when working on a change:
  - UI / flow: `src/App.tsx`, `src/components/AlarmGrid.tsx`, `src/components/AlarmEditor.tsx`, `src/components/PlayMenu.tsx`.
  - Data + persistence: `src/hooks/useAlarms.ts`, `src/types.ts`.
  - Runtime logic: `src/hooks/useAlarmRunner.ts`, `src/utils/time.ts`.
  - Utilities: `src/utils/ids.ts`.

If anything in these notes is unclear or you want more examples (for instance, a short code snippet showing how to add a new `Block` type end-to-end), tell me which area to expand and I will update this file accordingly.
