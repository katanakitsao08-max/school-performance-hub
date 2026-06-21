import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useSessionHeartbeat, sendLogoutBeacon } from '@/hooks/use-session-heartbeat';

type AppRole = 'admin' | 'teacher' | 'headteacher' | 'super_admin' | 'parent' | 'independent_learner' | 'pending_teacher';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  school_id: string | null;
  assigned_grades: string[] | null;
  assigned_streams: string[] | null;
  assigned_learning_areas: string[] | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  schoolId: string | null;
  schoolStatus: string | null;
  isSchoolFrozen: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [schoolStatus, setSchoolStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const schoolId = profile?.school_id || null;

  // School is frozen if subscription is expired/suspended/disabled and user is NOT super_admin
  const isSchoolFrozen = !!schoolStatus && ['expired','suspended','disabled'].includes(schoolStatus) && role !== 'super_admin';

  const fetchUserData = async (userId: string) => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);
      if (profileRes.data) {
        setProfile(profileRes.data as Profile);
        if (profileRes.data.school_id) {
          const { data: schoolData } = await supabase
            .from('schools')
            .select('subscription_status')
            .eq('id', profileRes.data.school_id)
            .maybeSingle();
          setSchoolStatus(schoolData?.subscription_status || null);
        }
      }
      if (roleRes.data) setRole(roleRes.data.role as AppRole);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    let initialSessionHandled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid Supabase deadlock, but await the result before clearing loading
          setTimeout(async () => {
            await fetchUserData(session.user.id);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setSchoolStatus(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (initialSessionHandled) return;
      initialSessionHandled = true;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // log failed attempt
      try {
        await supabase.from('login_events').insert({
          email_attempt: email,
          success: false,
          failure_reason: error.message,
          user_agent: navigator.userAgent.slice(0, 500),
          device: /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        });
      } catch {}
      throw error;
    }
    // Fire-and-forget activity log for analytics (login event)
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        const [{ data: p }, { data: r }] = await Promise.all([
          supabase.from('profiles').select('school_id').eq('user_id', u.id).maybeSingle(),
          supabase.from('user_roles').select('role').eq('user_id', u.id).maybeSingle(),
        ]);
        supabase.from('user_activity_log').insert({
          user_id: u.id,
          school_id: p?.school_id ?? null,
          role: r?.role ?? null,
          action: 'login',
          metadata: {},
          device: /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
          user_agent: navigator.userAgent.slice(0, 500),
        }).then(() => {}, () => {});
      }
    } catch {}
  };

  const signOut = async () => {
    try { await sendLogoutBeacon(); } catch {}
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
    setSchoolStatus(null);
  };

  // Presence heartbeat — captures IP/device on the edge and powers Live Users dashboard
  useSessionHeartbeat(user?.id ?? null);

  return (
    <AuthContext.Provider value={{ user, session, profile, role, schoolId, schoolStatus, isSchoolFrozen, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
