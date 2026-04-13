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

export function getMeanGradeLabel(avgPoints: number): string {
  if (avgPoints >= 7.5) return 'EE1';
  if (avgPoints >= 6.5) return 'EE2';
  if (avgPoints >= 5.5) return 'ME1';
  if (avgPoints >= 4.5) return 'ME2';
  if (avgPoints >= 3.5) return 'AE1';
  if (avgPoints >= 2.5) return 'AE2';
  if (avgPoints >= 1.5) return 'BE1';
  return 'BE2';
}

export interface GenderDist { M: number; F: number; }

export interface SubjectLevelAnalysis {
  subjectName: string;
  subjectId: string;
  maxScore: number;
  distribution: Record<CBCSubLevel, number>;
  genderDistribution: Record<CBCSubLevel, GenderDist>;
  totalPoints: number;
  averageScore: number;
  meanGradePoint: number;
  meanGradeLabel: string;
  entryCount: number;
  entryM: number;
  entryF: number;
}

export interface GradeAnalysisReport {
  subjects: SubjectLevelAnalysis[];
  overallDistribution: Record<CBCSubLevel, number>;
  overallGenderDistribution: Record<CBCSubLevel, GenderDist>;
  overallTotalPoints: number;
  overallAverage: number;
  overallMean: number;
  overallMeanLabel: string;
  totalEntries: number;
  totalM: number;
  totalF: number;
  insights: { highestBand: string; genderNote: string; overallComment: string };
}

function emptyGenderDist(): Record<CBCSubLevel, GenderDist> {
  return { EE1: { M: 0, F: 0 }, EE2: { M: 0, F: 0 }, ME1: { M: 0, F: 0 }, ME2: { M: 0, F: 0 }, AE1: { M: 0, F: 0 }, AE2: { M: 0, F: 0 }, BE1: { M: 0, F: 0 }, BE2: { M: 0, F: 0 } };
}

function emptyDist(): Record<CBCSubLevel, number> {
  return { EE1: 0, EE2: 0, ME1: 0, ME2: 0, AE1: 0, AE2: 0, BE1: 0, BE2: 0 };
}

export function computeGradeAnalysis(
  learners: any[],
  subjects: any[],
  scores: any[],
): GradeAnalysisReport {
  const learnerGender: Record<string, 'M' | 'F'> = {};
  learners.forEach(l => { learnerGender[l.id] = l.gender === 'Female' ? 'F' : 'M'; });

  const subjectAnalyses: SubjectLevelAnalysis[] = subjects.map(sub => {
    const dist = emptyDist();
    const gDist = emptyGenderDist();
    let totalPoints = 0, totalScore = 0, count = 0, mCount = 0, fCount = 0;

    learners.forEach(l => {
      const sc = scores.find((s: any) => s.learner_id === l.id && s.learning_area_id === sub.id);
      if (sc) {
        const level = getSubLevel(sc.score, sub.max_score);
        const g = learnerGender[l.id];
        dist[level]++;
        gDist[level][g]++;
        totalPoints += getSubLevelPoints(level);
        totalScore += sc.score;
        count++;
        if (g === 'M') mCount++; else fCount++;
      }
    });

    const meanGP = count > 0 ? Number((totalPoints / count).toFixed(2)) : 0;
    return {
      subjectName: sub.name,
      subjectId: sub.id,
      maxScore: sub.max_score,
      distribution: dist,
      genderDistribution: gDist,
      totalPoints,
      averageScore: count > 0 ? Number((totalScore / count).toFixed(2)) : 0,
      meanGradePoint: meanGP,
      meanGradeLabel: count > 0 ? getMeanGradeLabel(meanGP) : '-',
      entryCount: count,
      entryM: mCount,
      entryF: fCount,
    };
  });

  const overallDist = emptyDist();
  const overallGDist = emptyGenderDist();
  let overallTotalPoints = 0, overallTotalScore = 0, overallCount = 0;
  let totalM = 0, totalF = 0;

  subjectAnalyses.forEach(sa => {
    SUB_LEVELS.forEach(lv => {
      overallDist[lv] += sa.distribution[lv];
      overallGDist[lv].M += sa.genderDistribution[lv].M;
      overallGDist[lv].F += sa.genderDistribution[lv].F;
    });
    overallTotalPoints += sa.totalPoints;
    overallTotalScore += sa.averageScore * sa.entryCount;
    overallCount += sa.entryCount;
    totalM += sa.entryM;
    totalF += sa.entryF;
  });

  const overallMean = overallCount > 0 ? Number((overallTotalPoints / overallCount).toFixed(1)) : 0;

  // Insights
  const highestBand = SUB_LEVELS.find(lv => overallDist[lv] > 0) || '-';
  const mTotal = SUB_LEVELS.reduce((s, lv) => s + overallGDist[lv].M, 0);
  const fTotal = SUB_LEVELS.reduce((s, lv) => s + overallGDist[lv].F, 0);
  const genderNote = mTotal > fTotal ? `Male entries (${mTotal}) exceed Female (${fTotal})` : fTotal > mTotal ? `Female entries (${fTotal}) exceed Male (${mTotal})` : 'Equal gender participation';
  const overallComment = overallMean >= 6 ? 'Strong performance' : overallMean >= 4 ? 'Average performance' : overallMean >= 2 ? 'Below average – needs improvement' : 'Poor performance – urgent intervention needed';

  return {
    subjects: subjectAnalyses,
    overallDistribution: overallDist,
    overallGenderDistribution: overallGDist,
    overallTotalPoints,
    overallAverage: overallCount > 0 ? Number((overallTotalScore / overallCount).toFixed(2)) : 0,
    overallMean,
    overallMeanLabel: overallCount > 0 ? getMeanGradeLabel(overallMean) : '-',
    totalEntries: learners.length,
    totalM: learners.filter(l => learnerGender[l.id] === 'M').length,
    totalF: learners.filter(l => learnerGender[l.id] === 'F').length,
    insights: { highestBand, genderNote, overallComment },
  };
}
