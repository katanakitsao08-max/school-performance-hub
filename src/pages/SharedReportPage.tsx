import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Download, Eye } from 'lucide-react';
import { generatePremiumReportCard, type ReportCardData } from '@/lib/report-card-pdf';
import { getGradeForLevel, isKJSEAGradeLevel, getGradePoints, ASSESSMENT_TYPE_LABELS } from '@/lib/cbc-utils';
import performTrackLogo from '@/assets/performtrack-logo.png';

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/view-shared-report`;

export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!token) { setError('No token provided'); setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Could not load report');
        setData(json);
      } catch (e: any) {
        setError(e.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const buildPdfData = (): ReportCardData => {
    const { learner, subjects, scores, schoolSettings, term, year, assessment_type, total_in_class } = data;
    const subjectData = (subjects as any[]).map((sub) => {
      const sc = (scores as any[]).find(s => s.learning_area_id === sub.id);
      return {
        name: sub.name,
        score: sc?.score || 0,
        maxScore: sub.max_score,
        grade: sc ? getGradeForLevel(sc.score, sub.max_score, learner.grade) : '-',
        teacherInitials: '',
        teacherName: '',
        comment: sc?.teacher_comment || '',
      };
    });
    const total = subjectData.reduce((s, d) => s + d.score, 0);
    const maxTotal = subjectData.reduce((s, d) => s + d.maxScore, 0);
    const mean = subjectData.length ? total / subjectData.length : 0;
    const avgMax = subjectData.length ? maxTotal / subjectData.length : 100;
    const overallGrade = subjectData.length ? getGradeForLevel(mean, avgMax, learner.grade) : '-';
    const totalPoints = subjectData.reduce((s, d) => s + getGradePoints(d.grade as any), 0);

    return {
      learner: {
        id: learner.id, full_name: learner.full_name,
        admission_number: learner.admission_number, grade: learner.grade,
        stream: learner.stream, gender: learner.gender || 'Male',
      },
      subjectData,
      total, maxTotal, mean, overallGrade,
      rank: 0, streamRank: 0,
      totalInClass: total_in_class || 0,
      totalInStream: 0,
      totalPoints,
      selectedTerm: term, selectedYear: year,
      assessmentLabel: ASSESSMENT_TYPE_LABELS[assessment_type as keyof typeof ASSESSMENT_TYPE_LABELS] || 'End Term',
      classTeacherComment: '',
      principalComment: '',
      schoolSettings,
      logoBase64: null,
      classAvgPerSubject: {},
      appUrl: window.location.origin,
    };
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const pdf = await generatePremiumReportCard(buildPdfData());
      pdf.save(`${data.learner.full_name.replace(/\s+/g, '_')}_Report.pdf`);
    } catch (e: any) {
      setError(e.message || 'Could not generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleView = async () => {
    setDownloading(true);
    try {
      const pdf = await generatePremiumReportCard(buildPdfData());
      window.open(pdf.output('bloburl'), '_blank');
    } catch (e: any) {
      setError(e.message || 'Could not generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Link unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">
              This link may have expired (links are valid for 48 hours) or been revoked.
              Please contact the school for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isKJSEA = isKJSEAGradeLevel(data.learner.grade);

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <img src={performTrackLogo} alt="PerformTrack" className="h-10 w-10" />
          <div>
            <h1 className="font-display font-bold text-foreground">{data.schoolSettings?.school_name || 'School'}</h1>
            <p className="text-xs text-muted-foreground">Report card portal</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{data.learner.full_name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Adm. {data.learner.admission_number} · Grade {data.learner.grade} {data.learner.stream} ·
              Term {data.term} {data.year} · {ASSESSMENT_TYPE_LABELS[data.assessment_type as keyof typeof ASSESSMENT_TYPE_LABELS]}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-card p-4 text-sm">
              <p className="text-muted-foreground">
                Tap below to view or download the official {isKJSEA ? 'KJSEA' : 'KPSEA'} report card.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleView} disabled={downloading} className="flex-1">
                {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                View Report
              </Button>
              <Button onClick={handleDownload} disabled={downloading} variant="outline" className="flex-1">
                {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Download PDF
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center pt-2">
              Link expires {new Date(data.expires_at).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
