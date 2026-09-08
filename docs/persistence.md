# Rehearsal persistence

The M2 slice prefers the local Veltryn workspace API (`npm run api`) and falls back to browser `localStorage` under the versioned key `veltryn.rehearsals.v1` when that API is unavailable.

Each record retains:

- the position inputs and thesis text;
- the selected Bitget symbol and provider state;
- the captured ticker snapshot, including its exchange timestamp, when available;
- the captured candle window;
- creation/update timestamps and a revision number.

Opening a saved record pins its captured snapshot. An in-flight provider request cannot overwrite it. Selecting a different instrument, resetting, or starting a new rehearsal unlocks live retrieval again.

The API uses a random HttpOnly, SameSite session cookie and stores only a SHA-256 session digest. Every read, update, and delete is filtered by that session digest; session identifiers are not returned in public JSON. The current store is a local JSON file for development, not a production database.

The browser fallback is anonymous browser persistence, not an account-backed workspace. It does not provide multi-device recovery, share links, or server durability. Production deployment still needs a managed database, HTTPS cookie mode, origin/CSRF protection for write requests, rate limiting, and operational backups.
