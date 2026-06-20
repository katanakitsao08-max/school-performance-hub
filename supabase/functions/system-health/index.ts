// System health endpoint: pings DB, logs result, returns uptime metrics.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(url, serviceKey);

  // Ping DB and measure latency
  const t0 = Date.now();
  let dbOk = true;
  let dbError: string | null = null;
  try {
    const { error } = await supabase.from('system_health_pings').select('id').limit(1);
    if (error) { dbOk = false; dbError = error.message; }
  } catch (e) {
    dbOk = false;
    dbError = e instanceof Error ? e.message : String(e);
  }
  const latencyMs = Date.now() - t0;

  // Record this ping
  await supabase.from('system_health_pings').insert({ db_ok: dbOk, latency_ms: latencyMs });

  // Compute uptime % and avg latency over last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: pings } = await supabase
    .from('system_health_pings')
    .select('db_ok, latency_ms, created_at')
    .gte('created_at', since);

  const total = pings?.length ?? 0;
  const ok = pings?.filter(p => p.db_ok).length ?? 0;
  const uptimePct = total > 0 ? (ok / total) * 100 : (dbOk ? 100 : 0);
  const avgLatency = total > 0
    ? Math.round((pings!.reduce((s, p) => s + (p.latency_ms || 0), 0)) / total)
    : latencyMs;

  return new Response(
    JSON.stringify({
      status: dbOk ? 'healthy' : 'degraded',
      db: { status: dbOk ? 'ok' : 'error', error: dbError },
      api_response_ms: latencyMs,
      avg_response_ms_24h: avgLatency,
      uptime_pct_24h: Math.round(uptimePct * 100) / 100,
      samples_24h: total,
      checked_at: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
});
