import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Users, BarChart3 } from 'lucide-react';
import type { GradeAnalysisReport } from '@/lib/cbc-analysis-utils';

interface Props {
  analysis: GradeAnalysisReport;
}

export function GradeAnalysisInsights({ analysis }: Props) {
  const { insights } = analysis;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-4 flex items-start gap-3">
          <BarChart3 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Highest Performance Band</p>
            <p className="text-lg font-bold">{insights.highestBand}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 flex items-start gap-3">
          <Users className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Gender Comparison</p>
            <p className="text-sm">{insights.genderNote}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Overall Performance</p>
            <p className="text-sm font-medium">{insights.overallComment}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
