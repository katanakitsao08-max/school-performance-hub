import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SUB_LEVELS, type GradeAnalysisReport } from '@/lib/cbc-analysis-utils';

interface Props {
  analysis: GradeAnalysisReport;
}

export function GradeAnalysisTable({ analysis }: Props) {
  return (
    <Table>
      <TableHeader>
        {/* Top header row with level groups */}
        <TableRow className="bg-muted/50 border-b-0">
          <TableHead rowSpan={2} className="min-w-[120px] text-xs font-bold border-r">SUBJECT</TableHead>
          <TableHead colSpan={3} className="text-center text-xs font-bold border-r">ENTRY</TableHead>
          {SUB_LEVELS.map(lv => (
            <TableHead key={lv} colSpan={2} className="text-center text-xs font-bold border-r">{lv}</TableHead>
          ))}
          <TableHead rowSpan={2} className="text-center text-xs font-bold min-w-[60px] border-r">T.POINT</TableHead>
          <TableHead rowSpan={2} className="text-center text-xs font-bold min-w-[50px] border-r">AV.PT</TableHead>
          <TableHead rowSpan={2} className="text-center text-xs font-bold min-w-[50px]">MEAN</TableHead>
        </TableRow>
        {/* Sub header row: M F under each level */}
        <TableRow className="bg-muted/30">
          <TableHead className="text-center text-[10px] border-r px-1">M</TableHead>
          <TableHead className="text-center text-[10px] border-r px-1">F</TableHead>
          <TableHead className="text-center text-[10px] border-r px-1 font-bold">T</TableHead>
          {SUB_LEVELS.map(lv => (
            <TableHead key={lv} colSpan={2} className="text-center text-[10px] border-r px-0">
              <span className="inline-flex w-full">
                <span className="flex-1 text-center border-r border-border/50 px-1">M</span>
                <span className="flex-1 text-center px-1">F</span>
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {analysis.subjects.map(sa => (
          <TableRow key={sa.subjectId}>
            <TableCell className="font-medium text-xs border-r">{sa.subjectName}</TableCell>
            <TableCell className="text-center text-xs border-r px-1">{sa.entryM}</TableCell>
            <TableCell className="text-center text-xs border-r px-1">{sa.entryF}</TableCell>
            <TableCell className="text-center text-xs border-r px-1 font-semibold">{sa.entryM + sa.entryF}</TableCell>
            {SUB_LEVELS.map(lv => (
              <TableCell key={lv} colSpan={2} className="text-center text-xs border-r px-0">
                <span className="inline-flex w-full">
                  <span className="flex-1 text-center border-r border-border/30 px-1">{sa.genderDistribution[lv].M}</span>
                  <span className="flex-1 text-center px-1">{sa.genderDistribution[lv].F}</span>
                </span>
              </TableCell>
            ))}
            <TableCell className="text-center text-xs font-semibold border-r">{sa.totalPoints}</TableCell>
            <TableCell className="text-center text-xs border-r">{sa.meanGradePoint}</TableCell>
            <TableCell className="text-center text-xs font-semibold">{sa.meanGradeLabel}</TableCell>
          </TableRow>
        ))}
        {analysis.subjects.length > 0 && (
          <TableRow className="bg-muted/30 font-bold border-t-2">
            <TableCell className="text-xs border-r">OVERALL</TableCell>
            <TableCell className="text-center text-xs border-r px-1">{analysis.totalM}</TableCell>
            <TableCell className="text-center text-xs border-r px-1">{analysis.totalF}</TableCell>
            <TableCell className="text-center text-xs border-r px-1 text-muted-foreground">—</TableCell>
            {SUB_LEVELS.map(lv => (
              <TableCell key={lv} colSpan={2} className="text-center text-xs border-r px-0">
                <span className="inline-flex w-full">
                  <span className="flex-1 text-center border-r border-border/30 px-1">{analysis.overallGenderDistribution[lv].M}</span>
                  <span className="flex-1 text-center px-1">{analysis.overallGenderDistribution[lv].F}</span>
                </span>
              </TableCell>
            ))}
            <TableCell className="text-center text-xs border-r">{analysis.overallTotalPoints}</TableCell>
            <TableCell className="text-center text-xs border-r">{analysis.overallMean}</TableCell>
            <TableCell className="text-center text-xs font-bold">{analysis.overallMeanLabel}</TableCell>
          </TableRow>
        )}
        {analysis.subjects.length === 0 && (
          <TableRow>
            <TableCell colSpan={23} className="text-center py-12 text-muted-foreground">
              No data available. Select a grade and stream with scores entered.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
