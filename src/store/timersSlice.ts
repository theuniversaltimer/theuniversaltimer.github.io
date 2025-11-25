import { createSlice } from '@reduxjs/toolkit';

const timersSlice = createSlice({
  name: 'timers',
  initialState: /* ...existing initial state... */,
  reducers: {
    // ...existing reducers...

    updateTimer(state, action) {
      const incoming = action.payload;
      const id = incoming?.id;
      if (id == null) return;
      const idx = state.items.findIndex((t) => t.id === id);
      if (idx === -1) return;

      const prev = state.items[idx];
      // Merge incoming over prev (incoming wins)
      const merged = { ...prev, ...incoming };

      // Determine whether we should apply restart semantics
      const wantsRestart = incoming.restart === true || incoming.edited === true;
      const isStopwatch = merged.duration == null && merged.nextTrigger == null && merged.scheduledAt == null;

      if (wantsRestart && !isStopwatch) {
        merged.paused = false;
        const now = Date.now();

        if (merged.duration != null) {
          merged.startedAt = now;
          merged.remaining = merged.duration;
        } else if (merged.nextTrigger != null || merged.scheduledAt != null || merged.time != null) {
          const candidate = merged.nextTrigger ?? merged.scheduledAt ?? merged.time;
          merged.nextTrigger = Math.max(Number(candidate) || now, now);
          merged.startedAt = now;
        } else {
          merged.startedAt = now;
        }
      }

      // If incoming explicitly sets paused, honor it
      if (typeof incoming.paused === 'boolean') {
        merged.paused = incoming.paused;
      }

      // Clean helper flags before persisting
      delete (merged as any).restart;
      // If the caller explicitly cleared edited=false, persist that removal
      if (incoming.edited === false) {
        delete (merged as any).edited;
      }

      // Immutable replace of the single item so React/Redux picks up the change
      state.items = [
        ...state.items.slice(0, idx),
        merged,
        ...state.items.slice(idx + 1)
      ];
    },

    // ...existing reducers...
  }
});

export const { updateTimer } = timersSlice.actions;
export default timersSlice.reducer;