// CBC Grading utilities for Kenyan schools

export type CBCGrade = 'EE' | 'ME' | 'AE' | 'BE';

export function getGrade(score: number, maxScore: number): CBCGrade {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 75) return 'EE';
  if (percentage >= 50) return 'ME';
  if (percentage >= 25) return 'AE';
  return 'BE';
}

export function getGradeLabel(grade: CBCGrade): string {
  const labels: Record<CBCGrade, string> = {
    EE: 'Exceeding Expectations',
    ME: 'Meeting Expectations',
    AE: 'Approaching Expectations',
    BE: 'Below Expectations',
  };
  return labels[grade];
}

export function getGradeColor(grade: CBCGrade): string {
  const colors: Record<CBCGrade, string> = {
    EE: 'text-grade-ee',
    ME: 'text-info',
    AE: 'text-warning',
    BE: 'text-destructive',
  };
  return colors[grade];
}

export function getGradeBgColor(grade: CBCGrade): string {
  const colors: Record<CBCGrade, string> = {
    EE: 'bg-grade-ee',
    ME: 'bg-info',
    AE: 'bg-warning',
    BE: 'bg-destructive',
  };
  return colors[grade];
}

export function getOverallGrade(totalScore: number, totalMaxScore: number): CBCGrade {
  return getGrade(totalScore, totalMaxScore);
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
export const STREAMS = ['A', 'B', 'C', 'D'];
export const TERMS = [1, 2, 3];

export function getNextGrade(currentGrade: string): string | null {
  const idx = GRADES.indexOf(currentGrade);
  if (idx === -1 || idx === GRADES.length - 1) return null;
  return GRADES[idx + 1];
}
