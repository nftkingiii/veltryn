# Security boundary

Veltryn is read-only with respect to Bitget. It does not accept exchange keys, place orders, custody funds, or make trading decisions.

The workspace API is an anonymous prototype boundary:

- a random `HttpOnly; SameSite=Lax` cookie identifies a browser session;
- only a SHA-256 digest of that cookie is stored server-side;
- every rehearsal read, update, and delete is scoped to the current session;
- request bodies are capped at 64 KiB and thesis text is capped at 2,000 characters;
- records and candle arrays are bounded, and symbols are restricted to the expected USDT form;
- user text is rendered through React text nodes, never as HTML;
- the browser fallback is explicit and does not claim server durability.

Before production deployment, add HTTPS-only cookies, origin/CSRF checks for writes, rate limiting, structured validation shared with the client, a managed database, security headers, audit logging, and automated dependency/install-policy review. AI and research retrieval are not connected yet; when added, model output and fetched source text must remain untrusted data.
