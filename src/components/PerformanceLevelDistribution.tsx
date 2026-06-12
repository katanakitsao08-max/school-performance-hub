import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle } from 'lucide-react';
import { SUB_LEVELS, type GradeAnalysisReport } from '@/lib/cbc-analysis-utils';

interface Props {
  analysis: GradeAnalysisReport;
  classRoll: number; // total learners on the class roll (for validation)
}

export function PerformanceLevelDistribution({ analysis, classRoll }: Props) {
  const dist = analysis.performanceLevelDistribution;
  const tally = analysis.performanceLevelTotal;
  const match = tally === classRoll;
  const pct = (n: number) => (classRoll > 0 ? `${((n / classRoll) * 100).toFixed(1)}%` : '0%');
  const g = analysis.performanceLevelGroups;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2 bg-primary/5">
        <CardTitle className="text-sm font-display uppercase tracking-wide text-primary">
          Performance Level Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="px-2 py-2 text-left">Metric</th>
                <th className="px-2 py-2 text-center">Total Roll</th>
                {SUB_LEVELS.map(lv => <th key={lv} className="px-2 py-2 text-center">{lv}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="px-2 py-2 font-semibold">Count</td>
                <td className="px-2 py-2 text-center font-bold">{classRoll}</td>
                {SUB_LEVELS.map(lv => <td key={lv} className="px-2 py-2 text-center">{dist[lv]}</td>)}
              </tr>
              <tr className="bg-muted/40">
                <td className="px-2 py-2 font-semibold">%</td>
                <td className="px-2 py-2 text-center font-bold">100%</td>
                {SUB_LEVELS.map(lv => <td key={lv} className="px-2 py-2 text-center">{pct(dist[lv])}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 flex items-center gap-2 text-xs font-semibold border-t">
          {match ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
          <span className={match ? 'text-green-700' : 'text-destructive'}>
            Performance Level Tally: {tally} / {classRoll} {match ? '✓' : '✗'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-3 border-t bg-muted/20 text-xs">
          <div><span className="font-semibold">Below Expectation (BE1+BE2):</span> {g.belowExpectation} learners</div>
          <div><span className="font-semibold">Approaching Expectation (AE1+AE2):</span> {g.approachingExpectation} learners</div>
          <div><span className="font-semibold">Meeting Expectation (ME1+ME2):</span> {g.meetingExpectation} learners</div>
          <div><span className="font-semibold">Exceeding Expectation (EE1+EE2):</span> {g.exceedingExpectation} learners</div>
        </div>
      </CardContent>
    </Card>
  );
}
