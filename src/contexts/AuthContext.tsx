import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any; data: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  credits: number;
  refreshCredits: () => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<{ error: any }>;
  isEmailConfirmed: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [isEmailConfirmed, setIsEmailConfirmed] = useState(true);

  const refreshCredits = async () => {
    if (!user) {
      setCredits(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('credit_balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching credits:', error);
        return;
      }

      setCredits(data?.credit_balance || 0);
    } catch (error) {
      console.error('Error refreshing credits:', error);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (accessToken && type) {
          if (type === 'recovery') {
            window.location.hash = '';
            setLoading(false);
            return;
          }

          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (error) {
            console.error('Error setting session from URL:', error);
          } else if (data.session) {
            setUser(data.session.user);
            setIsEmailConfirmed(data.session.user?.email_confirmed_at ? true : false);
          }

          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          setUser(session?.user ?? null);
          setIsEmailConfirmed(session?.user?.email_confirmed_at ? true : false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsEmailConfirmed(session?.user?.email_confirmed_at ? true : false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      refreshCredits();
    } else {
      setCredits(0);
    }
  }, [user]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    return { error, data };
  };

  const signInWithGoogle = async () => {
    const redirectUrl = window.location.hostname === 'localhost'
      ? `${window.location.origin}/`
      : 'https://mycomic-book.com/';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    return { error };
  };

  const resendConfirmationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        credits,
        refreshCredits,
        resendConfirmationEmail,
        isEmailConfirmed,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
