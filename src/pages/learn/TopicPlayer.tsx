// Topic page — Videos / Notes / Practice / Assessments tabs.
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Video, FileText, ListChecks, ClipboardList, Download, PlayCircle } from "lucide-react";
import {
  toEmbedUrl, COMPETENCY_LABEL, COMPETENCY_COLOR,
  type LearningTopic, type LearningVideo, type LearningNote, type LearningQuestion,
  type LearnerTopicMastery,
} from "@/lib/learning-cms";
import { downloadNotesPdf } from "@/lib/certificate-pdf";

export default function TopicPlayer() {
  const { topicId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [topic, setTopic] = useState<LearningTopic | null>(null);
  const [videos, setVideos] = useState<LearningVideo[]>([]);
  const [notes, setNotes] = useState<LearningNote[]>([]);
  const [questions, setQuestions] = useState<LearningQuestion[]>([]);
  const [mastery, setMastery] = useState<LearnerTopicMastery | null>(null);

  useEffect(() => {
    if (!topicId) return;
    (async () => {
      const [t, v, n, q, m] = await Promise.all([
        supabase.from("learning_topics").select("*").eq("id", topicId).maybeSingle(),
        supabase.from("learning_videos").select("*").eq("topic_id", topicId).eq("is_active", true).order("sort_order"),
        supabase.from("learning_notes").select("*").eq("topic_id", topicId).eq("is_active", true).order("sort_order"),
        supabase.from("learning_questions").select("*").eq("topic_id", topicId).eq("is_active", true),
        user ? supabase.from("learner_topic_mastery").select("*").eq("topic_id", topicId).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setTopic((t.data || null) as LearningTopic | null);
      setVideos((v.data || []) as LearningVideo[]);
      setNotes((n.data || []) as LearningNote[]);
      setQuestions((q.data || []) as LearningQuestion[]);
      setMastery((m.data || null) as LearnerTopicMastery | null);
    })();
  }, [topicId, user?.id]);

  if (!topic) {
    return <div className="min-h-screen flex items-center justify-center p-6">
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="font-semibold">Topic not found.</p>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </CardContent></Card>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[hsl(140_30%_97%)] pb-20">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-5xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-tight truncate">{topic.title}</p>
            <p className="text-[11px] text-muted-foreground">{topic.subject_slug} · {topic.grade}{topic.strand ? ` · ${topic.strand}` : ""}</p>
          </div>
          {mastery && (
            <Badge variant="outline" className={`text-[10px] ${COMPETENCY_COLOR[mastery.competency_level]}`}>
              {Math.round(mastery.mastery_percent)}% · {COMPETENCY_LABEL[mastery.competency_level]}
            </Badge>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        {topic.description && (
          <Card><CardContent className="p-4 text-sm text-foreground/80">{topic.description}</CardContent></Card>
        )}

        <Tabs defaultValue="videos">
          <TabsList className="w-full grid grid-cols-4 bg-white border">
            <TabsTrigger value="videos"><Video className="w-4 h-4 mr-1" />Videos ({videos.length})</TabsTrigger>
            <TabsTrigger value="notes"><FileText className="w-4 h-4 mr-1" />Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="practice"><ListChecks className="w-4 h-4 mr-1" />Practice ({questions.length})</TabsTrigger>
            <TabsTrigger value="exams"><ClipboardList className="w-4 h-4 mr-1" />Exams</TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="mt-4 space-y-3">
            {videos.length === 0 && <Empty label="No videos yet for this topic." />}
            {videos.map(v => (
              <Card key={v.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="aspect-video w-full bg-muted rounded overflow-hidden">
                    <iframe
                      src={toEmbedUrl(v.video_url)} title={v.title}
                      className="w-full h-full" frameBorder={0}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
                    />
                  </div>
                  <p className="font-medium text-sm">{v.title}</p>
                  {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="notes" className="mt-4 space-y-3">
            {notes.length === 0 && <Empty label="No revision notes yet." />}
            {notes.map(n => (
              <Card key={n.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{n.title}</h3>
                    <Button size="sm" variant="outline" onClick={() => downloadNotesPdf({
                      title: n.title, subject: topic.subject_slug, grade: topic.grade, contentMd: n.content_md,
                    })}>
                      <Download className="w-3.5 h-3.5 mr-1" />PDF
                    </Button>
                  </div>
                  <article className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">{n.content_md}</article>
                  {n.attachment_url && (
                    <a href={n.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                      Open attached file ↗
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="practice" className="mt-4 space-y-3">
            {questions.length === 0 ? <Empty label="No practice questions yet." /> : (
              <Card><CardContent className="p-4 space-y-3 text-center">
                <p className="text-sm">There are <strong>{questions.length}</strong> practice questions for this topic.</p>
                <Button asChild>
                  <Link to={`/learn/topic/${topic.id}/practice`}>
                    <PlayCircle className="w-4 h-4 mr-2" /> Start Practice
                  </Link>
                </Button>
                <p className="text-[11px] text-muted-foreground">A timer-free practice run that auto-marks every answer and updates your CBC competency.</p>
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="exams" className="mt-4">
            <TopicExams subject={topic.subject_slug} grade={topic.grade} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{label}</CardContent></Card>;
}

function TopicExams({ subject, grade }: { subject: string; grade: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("learning_assessments").select("*")
        .eq("grade", grade).or(`subject_slug.eq.${subject},kind.eq.kpsea_mock,kind.eq.kjsea_mock`)
        .eq("is_active", true).order("created_at", { ascending: false });
      setItems(data || []);
    })();
  }, [subject, grade]);
  if (items.length === 0) return <Empty label="No exams published for this subject/grade yet." />;
  return (
    <div className="space-y-2">
      {items.map(a => (
        <Link key={a.id} to={`/learn/assessment/${a.id}`} className="block">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{a.title}</p>
                <p className="text-[11px] text-muted-foreground">{a.duration_minutes} min · pass {a.pass_percent}% · {(a.question_ids || []).length} questions</p>
              </div>
              <Badge variant="outline">{a.kind.replace("_", " ")}</Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
