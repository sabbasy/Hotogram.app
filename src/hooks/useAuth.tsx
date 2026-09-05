import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Restaurant } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  restaurant: Restaurant | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshRestaurant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(() => {
    try {
      const stored = localStorage.getItem('cached_restaurant');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchRestaurant = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', userId)
        .limit(1);

      if (data?.[0]) {
        const rest = data[0] as unknown as Restaurant;
        setRestaurant(rest);
        localStorage.setItem('cached_restaurant', JSON.stringify(rest));
        localStorage.setItem('cached_restaurant_id', rest.id);
      }
    } catch (e) {
      console.error('Error fetching restaurant in AuthProvider:', e);
    }
  };

  const refreshRestaurant = async () => {
    if (user) {
      await fetchRestaurant(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchRestaurant(session.user.id);
        } else {
          setRestaurant(null);
          localStorage.removeItem('cached_restaurant');
          localStorage.removeItem('cached_restaurant_id');
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRestaurant(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    setRestaurant(null);
    localStorage.removeItem('cached_restaurant');
    localStorage.removeItem('cached_restaurant_id');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, restaurant, loading, signUp, signIn, signOut, refreshRestaurant }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
