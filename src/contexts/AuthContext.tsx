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
  school_access_status?: string | null;
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

  // School is frozen if subscription is expired/suspended/disabled/deleted OR the user has been individually disabled, and user is NOT super_admin
  const isSchoolFrozen = (
    (!!schoolStatus && ['expired','suspended','disabled','deleted'].includes(schoolStatus))
    || profile?.school_access_status === 'disabled'
  ) && role !== 'super_admin';

  const fetchUserData = async (userId: string) => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);
      const userRole = roleRes.data?.role as AppRole | undefined;
      if (roleRes.data) setRole(userRole ?? null);

      if (profileRes.data) {
        setProfile(profileRes.data as Profile);
        let schoolDeleted = false;
        let schoolSub: string | null = null;
        if (profileRes.data.school_id) {
          const { data: schoolData } = await supabase
            .from('schools')
            .select('subscription_status, deleted_at')
            .eq('id', profileRes.data.school_id)
            .maybeSingle();
          schoolSub = schoolData?.subscription_status || null;
          schoolDeleted = !!schoolData?.deleted_at || ['deleted','disabled'].includes(schoolSub || '');
          setSchoolStatus(schoolDeleted && !schoolSub ? 'deleted' : schoolSub);
        }

        // Hard enforcement: revoke session if account or school is disabled (super_admin exempt)
        if (userRole !== 'super_admin') {
          const accountDisabled = profileRes.data.school_access_status === 'disabled';
          if (accountDisabled || schoolDeleted) {
            try { await sendLogoutBeacon(); } catch {}
            await supabase.auth.signOut();
            try {
              sessionStorage.setItem(
                'pt_access_denied',
                'Access denied. Your school account is no longer active.'
              );
            } catch {}
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
              window.location.replace('/login');
            }
            return;
          }
        }
      }
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

    // Post-login access validation: school + account must be active
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        const [{ data: p }, { data: r }] = await Promise.all([
          supabase.from('profiles').select('school_id, school_access_status').eq('user_id', u.id).maybeSingle(),
          supabase.from('user_roles').select('role').eq('user_id', u.id).maybeSingle(),
        ]);
        const isSuper = r?.role === 'super_admin';
        let denyReason: string | null = null;

        if (!isSuper) {
          if (p?.school_access_status === 'disabled') {
            denyReason = 'Access denied. Your school account is no longer active.';
          } else if (p?.school_id) {
            const { data: school } = await supabase
              .from('schools')
              .select('subscription_status, deleted_at')
              .eq('id', p.school_id)
              .maybeSingle();
            if (!school) {
              denyReason = 'Access denied. Your school account is no longer active.';
            } else if (
              school.deleted_at ||
              ['deleted','disabled','suspended'].includes(school.subscription_status || '')
            ) {
              denyReason = 'Access denied. Your school account is no longer active.';
            }
          }
        }

        if (denyReason) {
          try { await sendLogoutBeacon(); } catch {}
          await supabase.auth.signOut();
          throw new Error(denyReason);
        }

        // Activity log
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
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Access denied')) throw e;
    }
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
