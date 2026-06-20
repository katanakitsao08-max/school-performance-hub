import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Database, Gauge, RefreshCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Health = {
  status: 'healthy' | 'degraded';
  db: { status: 'ok' | 'error'; error: string | null };
  api_response_ms: number;
  avg_response_ms_24h: number;
  uptime_pct_24h: number;
  samples_24h: number;
  checked_at: string;
};

export function SystemUptimeCard() {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data: res, error } = await supabase.functions.invoke<Health>('system-health');
      if (error) throw error;
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const uptime = data?.uptime_pct_24h ?? 0;
  const uptimeColor = uptime >= 99 ? 'text-success' : uptime >= 95 ? 'text-amber-500' : 'text-destructive';
  const dbOk = data?.db.status === 'ok';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground">System Uptime</p>
          <div className="flex items-center gap-2">
            {data && (
              <Badge variant={data.status === 'healthy' ? 'default' : 'destructive'} className="text-[10px]">
                {data.status}
              </Badge>
            )}
            <RefreshCcw className={`h-3 w-3 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </div>
        </div>

        {error ? (
          <p className="text-xs text-destructive">Failed to fetch health: {error}</p>
        ) : !data ? (
          <p className="text-xs text-muted-foreground">Checking…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-start gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-[11px] text-muted-foreground">Uptime (24h)</p>
                <p className={`text-xl font-bold ${uptimeColor}`}>{data.uptime_pct_24h.toFixed(2)}%</p>
                <p className="text-[10px] text-muted-foreground">{data.samples_24h} checks</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-[11px] text-muted-foreground">API Response</p>
                <p className="text-xl font-bold">{data.api_response_ms} ms</p>
                <p className="text-[10px] text-muted-foreground">avg {data.avg_response_ms_24h} ms</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Database className={`h-4 w-4 mt-0.5 ${dbOk ? 'text-success' : 'text-destructive'}`} />
              <div>
                <p className="text-[11px] text-muted-foreground">Database</p>
                <p className={`text-xl font-bold ${dbOk ? 'text-success' : 'text-destructive'}`}>
                  {dbOk ? 'Operational' : 'Down'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {dbOk ? 'connection healthy' : data.db.error ?? 'error'}
                </p>
              </div>
            </div>
          </div>
        )}
        {data && (
          <p className="text-[10px] text-muted-foreground mt-3">
            Last checked {new Date(data.checked_at).toLocaleTimeString()} · auto-refresh 60s
          </p>
        )}
      </CardContent>
    </Card>
  );
}
