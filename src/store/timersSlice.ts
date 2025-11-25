// Minimal stub to avoid depending on @reduxjs/toolkit in this project.
// The app currently manages timers via `useTimers` hook; this module
// exists only so any imports of `../store/timersSlice` resolve during build.

export function updateTimer(_payload: any) {
  // no-op action helper for environments without RTK store
  return { type: "__UPDATE_TIMER_STUB__", payload: _payload };
}

export default function timersReducer(state: any = { items: [] }, _action: any) {
  // No reducer logic here; the real app uses `useTimers` hook.
  return state;
}