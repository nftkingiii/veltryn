# Bitget integration

The first Veltryn slice uses Bitget's public, read-only market endpoints through a Vite development proxy. No account key or trading permission is required.

Verified calls exercised on 2026-09-08:

- `GET /api/v2/mix/market/contracts?productType=USDT-FUTURES` — filtered to `NVDAUSDT`, `TSLAUSDT`, and `AAPLUSDT`, each returned `isRwa=YES`, perpetual metadata, precision, minimum trade size, fee rates, funding interval and leverage ceiling.
- `GET /api/v2/mix/market/tickers?productType=USDT-FUTURES&symbol=NVDAUSDT` — returned last, bid, ask, index, mark, funding and exchange timestamp.
- `GET /api/v2/mix/market/candles?symbol=NVDAUSDT&productType=USDT-FUTURES&granularity=1H&limit=120` — returned hourly OHLCV observations used for the displayed context window.
- `GET /api/v2/mix/market/history-fund-rate?symbol=NVDAUSDT&productType=USDT-FUTURES&pageSize=10` — returned timestamped funding observations.

An attempted `GET /api/v2/mix/market/books?symbol=NVDAUSDT&productType=USDT-FUTURES&limit=15` returned `40404` from the public API during feasibility work. Veltryn does not show depth or claim slippage from that unverified route. The next adapter milestone should identify the current official order-book endpoint before using liquidity calculations.

Official references: https://www.bitget.com/support/articles/12560603835927 and https://www.bitget.cloud/support/articles/12560603845668.
