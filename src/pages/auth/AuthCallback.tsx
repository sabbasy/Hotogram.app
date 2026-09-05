import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Check for error parameters in hash or query
      const hash = window.location.hash;
      const search = window.location.search;
      const params = new URLSearchParams(search || hash.replace('#', '?'));
      
      const errorDescription = params.get('error_description');
      if (errorDescription) {
        setStatus('error');
        setErrorMsg(errorDescription.replace(/\+/g, ' '));
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setStatus('error');
          setErrorMsg(error.message);
          return;
        }

        if (session?.user) {
          setStatus('success');
          // Check if user has restaurant
          const { data: restaurants } = await supabase
            .from('restaurants')
            .select('id')
            .eq('owner_id', session.user.id)
            .limit(1);

          setTimeout(() => {
            if (restaurants && restaurants.length > 0) {
              navigate('/restaurant/dashboard', { replace: true });
            } else {
              navigate('/', { replace: true, state: { verified: true } });
            }
          }, 1200);
        } else {
          // If no session yet, wait for onAuthStateChange
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              if (event === 'SIGNED_IN' && session?.user) {
                setStatus('success');
                const { data: restaurants } = await supabase
                  .from('restaurants')
                  .select('id')
                  .eq('owner_id', session.user.id)
                  .limit(1);

                setTimeout(() => {
                  if (restaurants && restaurants.length > 0) {
                    navigate('/restaurant/dashboard', { replace: true });
                  } else {
                    navigate('/', { replace: true, state: { verified: true } });
                  }
                }, 1200);
              }
            }
          );

          // Timeout fallback
          setTimeout(() => {
            subscription.unsubscribe();
            if (status === 'verifying') {
              navigate('/', { replace: true });
            }
          }, 4000);
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg('An unexpected error occurred while confirming your email.');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center p-8 bg-card border rounded-2xl shadow-card space-y-4">
        {status === 'verifying' && (
          <>
            <Loader2 className="h-10 w-10 text-accent animate-spin mx-auto" />
            <h2 className="text-xl font-bold tracking-tight">Verifying your account...</h2>
            <p className="text-sm text-muted-foreground">
              Please wait while we complete your email verification and set up your session.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Email Verified!</h2>
            <p className="text-sm text-muted-foreground">
              Your email has been confirmed. Redirecting to your dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Verification Link Expired or Invalid</h2>
            <p className="text-sm text-muted-foreground">
              {errorMsg || 'The verification link may have expired or has already been used.'}
            </p>
            <div className="pt-2">
              <Button variant="accent" className="w-full" onClick={() => navigate('/', { replace: true })}>
                Back to Sign In
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
