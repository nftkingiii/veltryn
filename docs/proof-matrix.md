# Veltryn proof matrix

| Claim | Current evidence | Status |
|---|---|---|
| Production app is reachable | Live URL and `/healthz` read-back | Verified |
| Bitget is in the core flow | Public ticker, funding, and candle adapter; live provider badge | Verified for public market reads |
| Path stress testing is visible | Candlestick chart with calm and shock-recovery paths | Verified |
| Assumptions are separated | “What the model used” and methodology drawer | Verified |
| Research can be attached and checked | HTTPS allowlist, excerpt capture, stance labels | Verified |
| Rehearsals persist | SQLite on Railway `/data` volume, session-scoped API | Verified for single replica |
| Reports are shareable and revocable | Public token route plus revoke API/UI | Verified |
| AI explanation | No external model call in current release | Open gap |
| Real trading execution | Intentionally out of scope | Not applicable |
