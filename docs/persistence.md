# Rehearsal persistence

The M2 slice stores saved rehearsals in browser `localStorage` under the versioned key `veltryn.rehearsals.v1`.

Each record retains:

- the position inputs and thesis text;
- the selected Bitget symbol and provider state;
- the captured ticker snapshot, including its exchange timestamp, when available;
- the captured candle window;
- creation/update timestamps and a revision number.

Opening a saved record pins its captured snapshot. An in-flight provider request cannot overwrite it. Selecting a different instrument, resetting, or starting a new rehearsal unlocks live retrieval again.

This is anonymous browser persistence, not an account-backed workspace. It does not provide multi-device recovery, share links, server durability, or access control. Those remain server milestone work.
