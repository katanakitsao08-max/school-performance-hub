import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'teacher' | 'headteacher' | 'super_admin' | 'parent';

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

  // School is frozen if status is 'expired' and user is NOT super_admin
  const isSchoolFrozen = schoolStatus === 'expired' && role !== 'super_admin';

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
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
    setSchoolStatus(null);
  };

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
