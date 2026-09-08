# Veltryn methodology

Veltryn separates observed exchange data from modeled scenario assumptions. The current vertical slice models one linear USDT perpetual position with isolated collateral and no added margin.

For direction `d` (`+1` long, `-1` short), quantity `q`, entry `E`, and mark `P`:

`unrealized PnL = d × q × (P − E)`

The slice estimates round-trip taker fees and applies the observed funding rate across the selected number of settlement periods. Positive funding debits a long and credits a short. The price paths are deterministic scenario inputs; they are not forecasts.

The two paths share an endpoint. The shock path first moves against the position and then recovers. Veltryn reports terminal PnL, worst modeled PnL, the first loss-budget breach, and modeled costs. Exact liquidation remains unavailable until authoritative maintenance-margin and tier parameters are verified.

Observed values show their source and capture time. If a provider is unavailable, the interface says `Recorded example` and does not silently present the fallback as live data. Underlying equity data and perpetual mark-price data must not be conflated.
