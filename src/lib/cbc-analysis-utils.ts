import { type CBCGrade } from './cbc-utils';

export type CBCSubLevel = 'EE1' | 'EE2' | 'ME1' | 'ME2' | 'AE1' | 'AE2' | 'BE1' | 'BE2';

export const SUB_LEVELS: CBCSubLevel[] = ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2'];

const SUB_LEVEL_POINTS: Record<CBCSubLevel, number> = {
  EE1: 8, EE2: 7, ME1: 6, ME2: 5, AE1: 4, AE2: 3, BE1: 2, BE2: 1,
};

export function getSubLevel(score: number, maxScore: number): CBCSubLevel {
  const pct = (score / maxScore) * 100;
  if (pct >= 90) return 'EE1';
  if (pct >= 75) return 'EE2';
  if (pct >= 62) return 'ME1';
  if (pct >= 50) return 'ME2';
  if (pct >= 37) return 'AE1';
  if (pct >= 25) return 'AE2';
  if (pct >= 12) return 'BE1';
  return 'BE2';
}

export function getSubLevelPoints(level: CBCSubLevel): number {
  return SUB_LEVEL_POINTS[level];
}

export interface SubjectLevelAnalysis {
  subjectName: string;
  subjectId: string;
  maxScore: number;
  distribution: Record<CBCSubLevel, number>;
  totalPoints: number;
  averageScore: number;
  meanGradePoint: number;
  entryCount: number;
}

export interface GradeAnalysisReport {
  subjects: SubjectLevelAnalysis[];
  overallDistribution: Record<CBCSubLevel, number>;
  overallTotalPoints: number;
  overallAverage: number;
  overallMean: number;
  totalEntries: number;
}

export function computeGradeAnalysis(
  learners: any[],
  subjects: any[],
  scores: any[],
): GradeAnalysisReport {
  const subjectAnalyses: SubjectLevelAnalysis[] = subjects.map(sub => {
    const dist: Record<CBCSubLevel, number> = { EE1: 0, EE2: 0, ME1: 0, ME2: 0, AE1: 0, AE2: 0, BE1: 0, BE2: 0 };
    let totalPoints = 0;
    let totalScore = 0;
    let count = 0;

    learners.forEach(l => {
      const sc = scores.find(s => s.learner_id === l.id && s.learning_area_id === sub.id);
      if (sc) {
        const level = getSubLevel(sc.score, sub.max_score);
        dist[level]++;
        totalPoints += getSubLevelPoints(level);
        totalScore += sc.score;
        count++;
      }
    });

    return {
      subjectName: sub.name,
      subjectId: sub.id,
      maxScore: sub.max_score,
      distribution: dist,
      totalPoints,
      averageScore: count > 0 ? Number((totalScore / count).toFixed(2)) : 0,
      meanGradePoint: count > 0 ? Number((totalPoints / count).toFixed(2)) : 0,
      entryCount: count,
    };
  });

  // Overall (across all subjects)
  const overallDist: Record<CBCSubLevel, number> = { EE1: 0, EE2: 0, ME1: 0, ME2: 0, AE1: 0, AE2: 0, BE1: 0, BE2: 0 };
  let overallTotalPoints = 0;
  let overallTotalScore = 0;
  let overallCount = 0;

  subjectAnalyses.forEach(sa => {
    SUB_LEVELS.forEach(lv => { overallDist[lv] += sa.distribution[lv]; });
    overallTotalPoints += sa.totalPoints;
    overallTotalScore += sa.averageScore * sa.entryCount;
    overallCount += sa.entryCount;
  });

  return {
    subjects: subjectAnalyses,
    overallDistribution: overallDist,
    overallTotalPoints,
    overallAverage: overallCount > 0 ? Number((overallTotalScore / overallCount).toFixed(2)) : 0,
    overallMean: overallCount > 0 ? Number((overallTotalPoints / overallCount).toFixed(2)) : 0,
    totalEntries: learners.length,
  };
}
