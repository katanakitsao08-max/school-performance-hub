import { getGrade, type CBCGrade } from './cbc-utils';

export interface SubjectAnalysis {
  name: string;
  mean: number;
  maxScore: number;
  grade: CBCGrade;
  top5: { name: string; score: number; grade: CBCGrade }[];
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
    const scores = allScores.filter((s: any) => s.learning_area_id === sub.id);
    const mean = scores.length > 0 ? scores.reduce((a: number, s: any) => a + s.score, 0) / scores.length : 0;
    const grade = getGrade(mean, sub.max_score);

    // Top 5 learners for this subject
    const learnerScores = reportData
      .map(l => {
        const sd = l.subjectData?.find((d: any) => d.id === sub.id);
        return sd ? { name: l.full_name, score: sd.score as number, grade: sd.grade as CBCGrade } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5) as { name: string; score: number; grade: CBCGrade }[];

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
