alter table public.trades
add column chart_data jsonb
check (chart_data is null or jsonb_typeof(chart_data) = 'array');
