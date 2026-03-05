
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'headteacher');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT NOT NULL,
  assigned_grades TEXT[] DEFAULT '{}',
  assigned_streams TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Create learning_areas table
CREATE TABLE public.learning_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  max_score INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create learners table
CREATE TABLE public.learners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admission_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  grade TEXT NOT NULL,
  stream TEXT NOT NULL DEFAULT 'A',
  parent_name TEXT,
  parent_phone TEXT,
  academic_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scores table
CREATE TABLE public.scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  learning_area_id UUID NOT NULL REFERENCES public.learning_areas(id) ON DELETE RESTRICT,
  term INTEGER NOT NULL CHECK (term BETWEEN 1 AND 3),
  year INTEGER NOT NULL,
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0),
  teacher_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(learner_id, learning_area_id, term, year)
);

-- Create promotion_log table
CREATE TABLE public.promotion_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  from_grade TEXT NOT NULL,
  to_grade TEXT NOT NULL,
  year INTEGER NOT NULL,
  promoted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_log ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Function to get user assigned grades
CREATE OR REPLACE FUNCTION public.get_user_assigned_grades(_user_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(assigned_grades, '{}') FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Headteachers can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'headteacher'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Learning areas policies
CREATE POLICY "Authenticated can view learning areas" ON public.learning_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage learning areas" ON public.learning_areas FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Learners policies
CREATE POLICY "Admins can manage learners" ON public.learners FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Headteachers can view all learners" ON public.learners FOR SELECT USING (public.has_role(auth.uid(), 'headteacher'));
CREATE POLICY "Teachers can view assigned learners" ON public.learners FOR SELECT USING (
  public.has_role(auth.uid(), 'teacher') AND 
  grade = ANY(public.get_user_assigned_grades(auth.uid()))
);

-- Scores policies
CREATE POLICY "Admins can manage scores" ON public.scores FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Headteachers can view all scores" ON public.scores FOR SELECT USING (public.has_role(auth.uid(), 'headteacher'));
CREATE POLICY "Teachers can view scores for assigned learners" ON public.scores FOR SELECT USING (
  public.has_role(auth.uid(), 'teacher') AND
  learner_id IN (SELECT id FROM public.learners WHERE grade = ANY(public.get_user_assigned_grades(auth.uid())))
);
CREATE POLICY "Teachers can insert scores for assigned learners" ON public.scores FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'teacher') AND
  learner_id IN (SELECT id FROM public.learners WHERE grade = ANY(public.get_user_assigned_grades(auth.uid())))
);
CREATE POLICY "Teachers can update scores for assigned learners" ON public.scores FOR UPDATE USING (
  public.has_role(auth.uid(), 'teacher') AND
  learner_id IN (SELECT id FROM public.learners WHERE grade = ANY(public.get_user_assigned_grades(auth.uid())))
);

-- Promotion log policies
CREATE POLICY "Admins can manage promotion log" ON public.promotion_log FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Headteachers can view promotion log" ON public.promotion_log FOR SELECT USING (public.has_role(auth.uid(), 'headteacher'));

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_learners_updated_at BEFORE UPDATE ON public.learners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scores_updated_at BEFORE UPDATE ON public.scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
