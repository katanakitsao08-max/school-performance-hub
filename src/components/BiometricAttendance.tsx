import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, CameraOff, ScanFace, UserPlus, CheckCircle2, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  loadFaceModels,
  computeDescriptor,
  computeAllDescriptors,
  descriptorDistance,
  FACE_MATCH_THRESHOLD,
  faceapi,
} from '@/lib/face-api-loader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Learner {
  id: string;
  full_name: string;
  admission_number: string;
  grade: string;
  stream: string;
}

interface Props {
  schoolId: string;
  userId: string;
  learners: Learner[];
  selectedDate: string;
  onAttendanceMarked: (learnerId: string) => void;
}

interface RecognizedEntry {
  learnerId: string;
  name: string;
  admNo: string;
  distance: number;
  at: number;
}

export default function BiometricAttendance({ schoolId, userId, learners, selectedDate, onAttendanceMarked }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [cameraOn, setCameraOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [enrollmentTarget, setEnrollmentTarget] = useState<Learner | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [recognized, setRecognized] = useState<RecognizedEntry[]>([]);
  const recentlyMarkedRef = useRef<Set<string>>(new Set());

  const learnerIds = learners.map(l => l.id);

  // Fetch existing descriptors for these learners
  const { data: descriptors = [] } = useQuery({
    queryKey: ['face-descriptors', schoolId, learnerIds.join(',')],
    queryFn: async () => {
      if (learnerIds.length === 0) return [];
      const { data, error } = await supabase
        .from('learner_face_descriptors')
        .select('learner_id, descriptor')
        .in('learner_id', learnerIds);
      if (error) throw error;
      return (data || []).map((d: any) => ({
        learnerId: d.learner_id,
        descriptor: new Float32Array(d.descriptor as number[]),
      }));
    },
    enabled: learnerIds.length > 0,
  });

  // Load models
  useEffect(() => {
    let cancel = false;
    setModelStatus('loading');
    loadFaceModels()
      .then(() => { if (!cancel) setModelStatus('ready'); })
      .catch((e) => {
        console.error('Face model load failed', e);
        if (!cancel) setModelStatus('error');
      });
    return () => { cancel = true; };
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (e: any) {
      toast({ title: 'Camera error', description: e.message || 'Unable to access camera', variant: 'destructive' });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  // Mark attendance mutation
  const markPresent = useMutation({
    mutationFn: async (learnerId: string) => {
      const { error } = await supabase.from('attendance').upsert({
        learner_id: learnerId,
        date: selectedDate,
        status: 'present',
        marked_by: userId,
        school_id: schoolId,
        marked_via: 'face',
      } as any, { onConflict: 'learner_id,date' });
      if (error) throw error;
    },
    onSuccess: (_, learnerId) => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      onAttendanceMarked(learnerId);
    },
  });

  // Enroll a learner's face
  const enrollFace = useMutation({
    mutationFn: async (learnerId: string) => {
      if (!videoRef.current) throw new Error('Camera not active');
      const desc = await computeDescriptor(videoRef.current);
      if (!desc) throw new Error('No clear face detected. Center the face in the camera.');
      const payload = {
        learner_id: learnerId,
        school_id: schoolId,
        descriptor: Array.from(desc),
        enrolled_by: userId,
      };
      const { error } = await supabase
        .from('learner_face_descriptors')
        .upsert(payload as any, { onConflict: 'learner_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['face-descriptors'] });
      toast({ title: 'Face enrolled', description: `${enrollmentTarget?.full_name} registered successfully.` });
      setEnrollmentTarget(null);
    },
    onError: (e: any) => toast({ title: 'Enrollment failed', description: e.message, variant: 'destructive' }),
  });

  // Recognition loop
  const startScan = useCallback(() => {
    if (!cameraOn || descriptors.length === 0) {
      toast({
        title: 'Cannot scan',
        description: descriptors.length === 0 ? 'Enroll learners first.' : 'Turn on the camera first.',
        variant: 'destructive',
      });
      return;
    }
    setScanning(true);
    recentlyMarkedRef.current = new Set();

    scanIntervalRef.current = window.setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const detections = await computeAllDescriptors(videoRef.current);

        // Draw boxes
        if (canvasRef.current && videoRef.current) {
          const v = videoRef.current;
          const c = canvasRef.current;
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.lineWidth = 3;
            ctx.font = '16px sans-serif';
          }

          for (const det of detections) {
            // Find best match
            let best = { learnerId: '', distance: Infinity };
            for (const d of descriptors) {
              const dist = descriptorDistance(det.descriptor, d.descriptor);
              if (dist < best.distance) best = { learnerId: d.learnerId, distance: dist };
            }
            const isMatch = best.distance < FACE_MATCH_THRESHOLD;
            const learner = isMatch ? learners.find(l => l.id === best.learnerId) : null;
            const box = det.detection.box;

            if (ctx) {
              ctx.strokeStyle = isMatch ? '#10b981' : '#ef4444';
              ctx.strokeRect(box.x, box.y, box.width, box.height);
              const label = learner ? `${learner.full_name} (${best.distance.toFixed(2)})` : 'Unknown';
              ctx.fillStyle = isMatch ? '#10b981' : '#ef4444';
              ctx.fillRect(box.x, box.y - 22, ctx.measureText(label).width + 10, 22);
              ctx.fillStyle = '#fff';
              ctx.fillText(label, box.x + 5, box.y - 6);
            }

            if (isMatch && learner && !recentlyMarkedRef.current.has(learner.id)) {
              recentlyMarkedRef.current.add(learner.id);
              await markPresent.mutateAsync(learner.id);
              setRecognized(prev => [
                { learnerId: learner.id, name: learner.full_name, admNo: learner.admission_number, distance: best.distance, at: Date.now() },
                ...prev.filter(r => r.learnerId !== learner.id),
              ].slice(0, 30));
            }
          }
        }
      } catch (e) {
        // ignore transient frame errors
      }
    }, 800);
  }, [cameraOn, descriptors, learners, markPresent, toast]);

  const stopScan = useCallback(() => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanning(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  const enrolledIds = new Set(descriptors.map(d => d.learnerId));
  const enrolledCount = learners.filter(l => enrolledIds.has(l.id)).length;
  const notEnrolled = learners.filter(l => !enrolledIds.has(l.id));

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Biometric (Face) Attendance</AlertTitle>
        <AlertDescription className="text-xs">
          Faces are converted to a numeric template (no photos saved). Ensure parental consent before enrolling minors.
          Models load once from CDN (~6 MB).
        </AlertDescription>
      </Alert>

      {modelStatus === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading face recognition models…
        </div>
      )}
      {modelStatus === 'error' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load models</AlertTitle>
          <AlertDescription>Check your internet connection and reload.</AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Camera panel */}
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="relative bg-black rounded-md overflow-hidden aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
              {!cameraOn && (
                <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
                  Camera off
                </div>
              )}
              {scanning && (
                <div className="absolute top-2 right-2">
                  <Badge className="bg-emerald-600 text-white animate-pulse">
                    <ScanFace className="h-3 w-3 mr-1" /> Scanning
                  </Badge>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {!cameraOn ? (
                <Button onClick={startCamera} disabled={modelStatus !== 'ready'} size="sm">
                  <Camera className="mr-1 h-4 w-4" /> Start Camera
                </Button>
              ) : (
                <Button onClick={stopCamera} variant="outline" size="sm">
                  <CameraOff className="mr-1 h-4 w-4" /> Stop Camera
                </Button>
              )}

              {enrollmentTarget ? (
                <Button
                  onClick={() => { setEnrolling(true); enrollFace.mutate(enrollmentTarget.id, { onSettled: () => setEnrolling(false) }); }}
                  disabled={!cameraOn || enrolling || enrollFace.isPending}
                  size="sm"
                  variant="default"
                >
                  {enrolling || enrollFace.isPending ? (
                    <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Capturing…</>
                  ) : (
                    <><UserPlus className="mr-1 h-4 w-4" /> Capture {enrollmentTarget.full_name.split(' ')[0]}</>
                  )}
                </Button>
              ) : !scanning ? (
                <Button onClick={startScan} disabled={!cameraOn || descriptors.length === 0} size="sm" variant="default">
                  <ScanFace className="mr-1 h-4 w-4" /> Start Scan
                </Button>
              ) : (
                <Button onClick={stopScan} size="sm" variant="outline">
                  <CameraOff className="mr-1 h-4 w-4" /> Stop Scan
                </Button>
              )}

              {enrollmentTarget && (
                <Button onClick={() => setEnrollmentTarget(null)} size="sm" variant="ghost">Cancel</Button>
              )}
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
              <span>Enrolled: <strong className="text-foreground">{enrolledCount}/{learners.length}</strong></span>
              <span>Recognized today: <strong className="text-foreground">{recognized.length}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Right panel: enrollment + log */}
        <Card>
          <CardContent className="p-3 space-y-3">
            <div>
              <h3 className="font-semibold text-sm mb-2">Recognized (auto-marked present)</h3>
              <ScrollArea className="h-[140px] border rounded-md p-2 bg-muted/30">
                {recognized.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No one recognized yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {recognized.map(r => (
                      <li key={r.learnerId + r.at} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="font-medium">{r.name}</span>
                          <span className="text-muted-foreground">{r.admNo}</span>
                        </span>
                        <Badge variant="outline" className="text-[10px]">d={r.distance.toFixed(2)}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Not yet enrolled ({notEnrolled.length})</h3>
              <ScrollArea className="h-[180px] border rounded-md p-2">
                {notEnrolled.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">All learners are enrolled.</p>
                ) : (
                  <ul className="space-y-1">
                    {notEnrolled.map(l => (
                      <li key={l.id} className="flex items-center justify-between text-xs">
                        <span><span className="font-medium">{l.full_name}</span> <span className="text-muted-foreground">({l.admission_number})</span></span>
                        <Button
                          size="sm"
                          variant={enrollmentTarget?.id === l.id ? 'default' : 'ghost'}
                          className="h-6 px-2 text-[10px]"
                          onClick={() => setEnrollmentTarget(l)}
                        >
                          <UserPlus className="h-3 w-3 mr-1" /> Enroll
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
              {enrollmentTarget && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Center <strong>{enrollmentTarget.full_name}</strong>'s face in the camera, then press Capture.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
