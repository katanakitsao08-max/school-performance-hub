import { getGradeForLevel, type AnyGrade } from './cbc-utils';

export interface SubjectAnalysis {
  name: string;
  mean: number;
  maxScore: number;
  grade: AnyGrade;
  top5: { name: string; score: number; grade: AnyGrade }[];
}

export interface AnalysisResult {
  subjectAnalyses: SubjectAnalysis[];
  classMean: number;
  bestSubject: SubjectAnalysis | null;
  leastSubject: SubjectAnalysis | null;
  top5Overall: { rank: number; name: string; total: number; mean: number; grade: string }[];
}

export function computeAnalysis(
  reportData: any[],
  gradeSubjects: any[],
  allScores: any[],
): AnalysisResult {
  const subjectAnalyses: SubjectAnalysis[] = gradeSubjects.map(sub => {
    // Derive mean from the SAME values used in the Class Report table — so
    // combined/merged subjects (id = "id1+id2") match exactly, and we never
    // fall back to 0 when learners genuinely have data for that column.
    const reportCells = reportData
      .map(l => l.subjectData?.find((d: any) => d.id === sub.id))
      .filter((d: any) => d && Number(d.score) > 0) as any[];

    let mean = 0;
    if (reportCells.length > 0) {
      mean = reportCells.reduce((a, d) => a + Number(d.score), 0) / reportCells.length;
    } else {
      // Fallback for school-wide / non-merged contexts: aggregate raw scores.
      const raw = allScores.filter((s: any) => s.learning_area_id === sub.id && Number(s.score) > 0);
      mean = raw.length > 0 ? raw.reduce((a: number, s: any) => a + Number(s.score), 0) / raw.length : 0;
    }
    const grade = getGradeForLevel(mean, sub.max_score, sub.grade || '1');

    // Top 5 learners for this subject (use the same cell values)
    const learnerScores = reportData
      .map(l => {
        const sd = l.subjectData?.find((d: any) => d.id === sub.id);
        return sd ? { name: l.full_name, score: sd.score as number, grade: sd.grade as AnyGrade } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5) as { name: string; score: number; grade: AnyGrade }[];

    return { name: sub.name, mean: Number(mean.toFixed(1)), maxScore: sub.max_score, grade, top5: learnerScores };
  });


  const classMean = reportData.length > 0
    ? reportData.reduce((s, l) => s + l.mean, 0) / reportData.length
    : 0;

  const sorted = [...subjectAnalyses].sort((a, b) => b.mean - a.mean);
  const bestSubject = sorted[0] || null;
  const leastSubject = sorted[sorted.length - 1] || null;

  const top5Overall = reportData.slice(0, 5).map((l, i) => ({
    rank: l.rank ?? i + 1,
    name: l.full_name,
    total: l.total,
    mean: Number(l.mean.toFixed(1)),
    grade: l.overallGrade,
  }));

  return { subjectAnalyses, classMean: Number(classMean.toFixed(1)), bestSubject, leastSubject, top5Overall };
}
