import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, RefreshCw, Search, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

type SmsLog = {
  id: string;
  recipient: string;
  message: string;
  status: string;
  provider: string | null;
  sender_id: string | null;
  provider_message_id: string | null;
  error: string | null;
  segments: number;
  sent_at: string;
  used_global_fallback: boolean;
};

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  sent: { label: 'Sent', variant: 'default', icon: CheckCircle2 },
  delivered: { label: 'Delivered', variant: 'default', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'destructive', icon: XCircle },
  pending: { label: 'Pending', variant: 'secondary', icon: Clock },
};

export default function SmsLogsPage() {
  const { schoolId, role } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sms-logs', schoolId, role],
    queryFn: async () => {
      let q = supabase
        .from('sms_logs' as any)
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(500);
      if (role !== 'super_admin' && schoolId) q = q.eq('school_id', schoolId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as SmsLog[];
    },
    enabled: !!schoolId || role === 'super_admin',
  });

  const filtered = logs.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        l.recipient.toLowerCase().includes(s) ||
        l.message.toLowerCase().includes(s) ||
        (l.sender_id || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const stats = {
    total: logs.length,
    sent: logs.filter((l) => l.status === 'sent' || l.status === 'delivered').length,
    failed: logs.filter((l) => l.status === 'failed').length,
    segments: logs.reduce((s, l) => s + (l.segments || 1), 0),
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 p-3 sm:p-6 max-w-7xl mx-auto pb-24">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">SMS Logs</h1>
              <p className="text-xs text-muted-foreground">Every outgoing message with delivery status</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Delivered" value={stats.sent} tone="success" />
          <StatCard label="Failed" value={stats.failed} tone="destructive" />
          <StatCard label="Segments" value={stats.segments} />
        </div>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Messages</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search recipient or message…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No SMS logs found.
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-2 sm:hidden">
                  {filtered.map((l) => <LogCard key={l.id} log={l} />)}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Segments</TableHead>
                        <TableHead>Sent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((l) => {
                        const meta = STATUS_META[l.status] || STATUS_META.pending;
                        const Icon = meta.icon;
                        return (
                          <TableRow key={l.id}>
                            <TableCell className="font-mono text-xs">{l.recipient}</TableCell>
                            <TableCell className="max-w-md">
                              <p className="text-xs truncate" title={l.message}>{l.message}</p>
                              {l.error && <p className="text-[10px] text-destructive truncate" title={l.error}>{l.error}</p>}
                            </TableCell>
                            <TableCell>
                              <Badge variant={meta.variant} className="gap-1">
                                <Icon className="h-3 w-3" /> {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {l.sender_id || '—'}
                              {l.used_global_fallback && <Badge variant="outline" className="ml-1 text-[10px]">fallback</Badge>}
                            </TableCell>
                            <TableCell className="text-xs">{l.segments}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap" title={format(new Date(l.sent_at), 'PPpp')}>
                              {formatDistanceToNow(new Date(l.sent_at), { addSuffix: true })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'destructive' }) {
  const color = tone === 'success' ? 'text-green-600' : tone === 'destructive' ? 'text-destructive' : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function LogCard({ log }: { log: SmsLog }) {
  const meta = STATUS_META[log.status] || STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <div className="border rounded-lg p-3 space-y-1.5 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-medium">{log.recipient}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(log.sent_at), { addSuffix: true })}
            {log.sender_id && ` · ${log.sender_id}`}
            {` · ${log.segments} seg`}
          </p>
        </div>
        <Badge variant={meta.variant} className="gap-1 shrink-0">
          <Icon className="h-3 w-3" /> {meta.label}
        </Badge>
      </div>
      <p className="text-xs text-foreground/80 line-clamp-2">{log.message}</p>
      {log.error && <p className="text-[10px] text-destructive line-clamp-2">{log.error}</p>}
    </div>
  );
}
