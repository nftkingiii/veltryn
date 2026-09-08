# Rehearsal persistence

The M2 slice prefers the local Veltryn workspace API (`npm run api`) and falls back to browser `localStorage` under the versioned key `veltryn.rehearsals.v1` when that API is unavailable.

Each record retains:

- the position inputs and thesis text;
- the selected Bitget symbol and provider state;
- the captured ticker snapshot, including its exchange timestamp, when available;
- the captured candle window;
- creation/update timestamps and a revision number.
- up to six HTTPS research references labeled supporting, counter, or context;
- immutable revision history used by JSON and CSV exports.

Opening a saved record pins its captured snapshot. An in-flight provider request cannot overwrite it. Selecting a different instrument, resetting, or starting a new rehearsal unlocks live retrieval again.

The API uses a random HttpOnly, SameSite session cookie and stores only a SHA-256 session digest. Every read, update, and delete is filtered by that session digest; session identifiers are not returned in public JSON. The current store is a local JSON file for development, not a production database.

The browser fallback is anonymous browser persistence, not an account-backed workspace. It does not provide multi-device recovery, share links, or server durability. Production deployment still needs a managed database, HTTPS cookie mode, origin/CSRF protection for write requests, rate limiting, and operational backups.

The Rehearse view also offers a print-ready PDF path through the browser's native print dialog. The printed view includes the selected scenario, chart, evidence labels, and attached sources; it does not claim server-side PDF generation.

Source verification currently allows only official Bitget hostnames, rejects redirects, and stores a bounded retrieved excerpt with its capture timestamp. A shared report is created only after an owner action and is served at `/report/<token>`; the owner can revoke the token through the API.

Public source cards label the trader's note as a claim and the retrieved text as a verified excerpt. This is provenance binding, not a claim that the source supports the thesis.
