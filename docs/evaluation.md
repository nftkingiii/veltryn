# Veltryn evaluation snapshot

Evaluation target: the anonymous workspace and research trust boundary.

The held-out script is `scripts/evaluate-workspace.mjs`. It starts an isolated server with a temporary store and checks:

| Case | Expected result |
| --- | --- |
| `/healthz` reports the evaluation revision | 200 with `status: ok` |
| An anonymous session can create a rehearsal | 200 and a record is returned |
| A non-allowlisted HTTPS source is submitted | 422; no arbitrary fetch is attempted |
| An owner-created public report is opened before revocation | 200 |
| The owner revokes the public token | 200 with `revoked: true` |
| The same public token is opened after revocation | 404 |

This is a deterministic boundary evaluation, not a measure of trading performance, source truth, or future survival. It does not claim production database durability or calibrated AI behavior.
