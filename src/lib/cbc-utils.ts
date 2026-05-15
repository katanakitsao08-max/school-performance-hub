// CBC Grading utilities for Kenyan schools

export type CBCGrade = 'EE' | 'ME' | 'AE' | 'BE';
export type KJSEAGrade = 'EE1' | 'EE2' | 'ME1' | 'ME2' | 'AE1' | 'AE2' | 'BE1' | 'BE2';
export type AnyGrade = CBCGrade | KJSEAGrade;

// Grades 7, 8, 9 use KJSEA (8-level) grading; everything else uses KPSEA (4-level)
export function isKJSEAGradeLevel(gradeLevel: string): boolean {
  const num = parseInt(gradeLevel, 10);
  return num >= 7 && num <= 9;
}

// KPSEA grading (Grade 6 and below)
export function getGrade(score: number, maxScore: number): CBCGrade {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 75) return 'EE';
  if (percentage >= 50) return 'ME';
  if (percentage >= 25) return 'AE';
  return 'BE';
}

// KJSEA grading (Grade 7-9)
export function getKJSEAGrade(score: number, maxScore: number): KJSEAGrade {
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

// Grade-aware: returns the correct grade based on the student's grade level
export function getGradeForLevel(score: number, maxScore: number, gradeLevel: string): AnyGrade {
  if (isKJSEAGradeLevel(gradeLevel)) {
    return getKJSEAGrade(score, maxScore);
  }
  return getGrade(score, maxScore);
}

export function getGradeLabel(grade: AnyGrade): string {
  const labels: Record<string, string> = {
    EE: 'Exceeding Expectations',
    ME: 'Meeting Expectations',
    AE: 'Approaching Expectations',
    BE: 'Below Expectations',
    EE1: 'Exceeding Expectations (1)',
    EE2: 'Exceeding Expectations (2)',
    ME1: 'Meeting Expectations (1)',
    ME2: 'Meeting Expectations (2)',
    AE1: 'Approaching Expectations (1)',
    AE2: 'Approaching Expectations (2)',
    BE1: 'Below Expectations (1)',
    BE2: 'Below Expectations (2)',
  };
  return labels[grade] || grade;
}

export function getGradeColor(grade: AnyGrade): string {
  const colors: Record<string, string> = {
    EE: 'text-grade-ee',
    ME: 'text-info',
    AE: 'text-warning',
    BE: 'text-destructive',
    EE1: 'text-grade-ee',
    EE2: 'text-grade-ee',
    ME1: 'text-info',
    ME2: 'text-info',
    AE1: 'text-warning',
    AE2: 'text-warning',
    BE1: 'text-destructive',
    BE2: 'text-destructive',
  };
  return colors[grade] || '';
}

export function getGradeBgColor(grade: AnyGrade): string {
  const colors: Record<string, string> = {
    EE: 'bg-grade-ee',
    ME: 'bg-info',
    AE: 'bg-warning',
    BE: 'bg-destructive',
    EE1: 'bg-grade-ee',
    EE2: 'bg-grade-ee',
    ME1: 'bg-info',
    ME2: 'bg-info',
    AE1: 'bg-warning',
    AE2: 'bg-warning',
    BE1: 'bg-destructive',
    BE2: 'bg-destructive',
  };
  return colors[grade] || '';
}

export function getOverallGrade(totalScore: number, totalMaxScore: number): CBCGrade {
  return getGrade(totalScore, totalMaxScore);
}

// KJSEA points system
const KJSEA_POINTS: Record<KJSEAGrade, number> = {
  EE1: 8, EE2: 7, ME1: 6, ME2: 5, AE1: 4, AE2: 3, BE1: 2, BE2: 1,
};

const KPSEA_POINTS: Record<CBCGrade, number> = {
  EE: 4, ME: 3, AE: 2, BE: 1,
};

export function getGradePoints(grade: AnyGrade): number {
  if (grade in KJSEA_POINTS) return KJSEA_POINTS[grade as KJSEAGrade];
  if (grade in KPSEA_POINTS) return KPSEA_POINTS[grade as CBCGrade];
  return 0;
}

// ----- Performance-level points (CBC unified 8-level scale) -----
// Used so all grades (KPSEA + KJSEA) contribute comparable points
// to learner mean / ranking (per Item 7 + 8).
export type PerfLevel = 'EE1' | 'EE2' | 'ME1' | 'ME2' | 'AE1' | 'AE2' | 'BE1' | 'BE2';

const PERF_LEVEL_POINTS: Record<PerfLevel, number> = {
  EE1: 8, EE2: 7, ME1: 6, ME2: 5, AE1: 4, AE2: 3, BE1: 2, BE2: 1,
};

export function getPerfLevel(score: number, maxScore: number): PerfLevel {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 90) return 'EE1';
  if (pct >= 75) return 'EE2';
  if (pct >= 62) return 'ME1';
  if (pct >= 50) return 'ME2';
  if (pct >= 37) return 'AE1';
  if (pct >= 25) return 'AE2';
  if (pct >= 12) return 'BE1';
  return 'BE2';
}

export function getPerfLevelPoints(level: PerfLevel): number {
  return PERF_LEVEL_POINTS[level];
}

export function meanPointsToLevel(avgPoints: number): PerfLevel {
  if (avgPoints >= 7.5) return 'EE1';
  if (avgPoints >= 6.5) return 'EE2';
  if (avgPoints >= 5.5) return 'ME1';
  if (avgPoints >= 4.5) return 'ME2';
  if (avgPoints >= 3.5) return 'AE1';
  if (avgPoints >= 2.5) return 'AE2';
  if (avgPoints >= 1.5) return 'BE1';
  return 'BE2';
}

export interface MeanPointsResult {
  totalPoints: number;
  avgPoints: number;
  level: PerfLevel | '-';
  perSubjectPoints: number[];
}

export function computeLearnerMeanPoints(
  subjectData: { score: number; maxScore: number }[],
): MeanPointsResult {
  if (!subjectData.length) return { totalPoints: 0, avgPoints: 0, level: '-', perSubjectPoints: [] };
  const perSubjectPoints = subjectData.map(s => getPerfLevelPoints(getPerfLevel(s.score, s.maxScore)));
  const totalPoints = perSubjectPoints.reduce((a, b) => a + b, 0);
  const avgPoints = totalPoints / subjectData.length;
  return { totalPoints, avgPoints, level: meanPointsToLevel(avgPoints), perSubjectPoints };
}

export function generateTeacherComment(
  learnerName: string,
  meanScore: number,
  totalMaxScore: number,
  subjectPerformances: { name: string; score: number; maxScore: number }[]
): string {
  const grade = getGrade(meanScore, totalMaxScore / (subjectPerformances.length || 1));
  const firstName = learnerName.split(' ')[0];
  
  const bestSubject = subjectPerformances.length > 0
    ? subjectPerformances.reduce((a, b) => (a.score / a.maxScore) > (b.score / b.maxScore) ? a : b)
    : null;
  const weakestSubject = subjectPerformances.length > 0
    ? subjectPerformances.reduce((a, b) => (a.score / a.maxScore) < (b.score / b.maxScore) ? a : b)
    : null;

  const comments: Record<CBCGrade, string[]> = {
    EE: [
      `${firstName} has demonstrated exceptional performance across all learning areas. Outstanding work!`,
      `Excellent performance! ${firstName} consistently exceeds expectations and shows remarkable understanding.`,
      `${firstName} is a stellar learner who shows deep understanding and excellent application of concepts.`,
    ],
    ME: [
      `${firstName} has shown good effort and meets the expected standards. Keep up the good work!`,
      `Good progress! ${firstName} demonstrates consistent understanding of most learning areas.`,
      `${firstName} is performing well and meeting expectations. With continued effort, even greater heights can be achieved.`,
    ],
    AE: [
      `${firstName} is making progress but needs more effort to meet the expected standards.`,
      `${firstName} shows potential but requires additional support and practice in key areas.`,
      `With more dedication and support, ${firstName} can improve significantly. Encourage regular revision.`,
    ],
    BE: [
      `${firstName} needs significant improvement across learning areas. Close monitoring and support is required.`,
      `${firstName} is struggling and requires urgent attention and remedial support.`,
      `Additional support is needed for ${firstName}. Consider extra tutoring and parental involvement.`,
    ],
  };

  let comment = comments[grade][Math.floor(Math.random() * comments[grade].length)];

  if (bestSubject) {
    comment += ` Shows strength in ${bestSubject.name}.`;
  }
  if (weakestSubject && weakestSubject.name !== bestSubject?.name) {
    comment += ` Needs improvement in ${weakestSubject.name}.`;
  }

  return comment;
}

export const GRADES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const STREAMS: string[] = [];
export const TERMS = [1, 2, 3];
export const ASSESSMENT_TYPES = ['opener', 'mid_term', 'end_term'] as const;
export type AssessmentType = typeof ASSESSMENT_TYPES[number];
export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  opener: 'Opener',
  mid_term: 'Mid-Term',
  end_term: 'End-Term',
};
export const GENDERS = ['Male', 'Female'] as const;

export function getNextGrade(currentGrade: string, gradesList: string[] = GRADES): string | null {
  const idx = gradesList.indexOf(currentGrade);
  if (idx === -1 || idx === gradesList.length - 1) return null;
  return gradesList[idx + 1];
}
