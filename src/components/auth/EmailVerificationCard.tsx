import { useState, useEffect } from 'react';
import { Mail, RefreshCw, ExternalLink, ArrowLeft, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { sanitizeError } from '@/lib/errorUtils';

interface EmailVerificationCardProps {
  email: string;
  onBackToLogin: () => void;
  onBackToSignup: () => void;
}

export function EmailVerificationCard({
  email,
  onBackToLogin,
  onBackToSignup,
}: EmailVerificationCardProps) {
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [copied, setCopied] = useState(false);
  const { resendConfirmationEmail } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || resending || !email) return;

    setResending(true);
    const { error } = await resendConfirmationEmail(email);

    if (error) {
      toast({
        title: 'Could not resend email',
        description: sanitizeError(error),
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Verification email sent!',
        description: `We've sent a new confirmation link to ${email}.`,
      });
      setCooldown(60);
    }
    setResending(false);
  };

  const handleCopyEmail = () => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getEmailProviderLink = () => {
    const domain = email.split('@')[1]?.toLowerCase() || '';
    if (domain.includes('gmail.com') || domain.includes('googlemail.com')) {
      return { label: 'Open Gmail', url: 'https://mail.google.com' };
    }
    if (domain.includes('outlook.com') || domain.includes('hotmail.com') || domain.includes('live.com')) {
      return { label: 'Open Outlook', url: 'https://outlook.live.com' };
    }
    if (domain.includes('yahoo.com')) {
      return { label: 'Open Yahoo Mail', url: 'https://mail.yahoo.com' };
    }
    if (domain.includes('icloud.com') || domain.includes('me.com')) {
      return { label: 'Open iCloud Mail', url: 'https://www.icloud.com/mail' };
    }
    return { label: 'Open Mail App', url: 'mailto:' };
  };

  const provider = getEmailProviderLink();

  return (
    <Card className="shadow-card border-border/80">
      <CardHeader className="text-center pb-4">
        <div className="relative w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center mx-auto mb-3 ring-8 ring-accent/5">
          <Mail className="h-8 w-8 text-accent animate-pulse" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Verify your email
        </CardTitle>
        <CardDescription className="text-sm mt-1 max-w-sm mx-auto">
          We sent a verification link to your email address. Please click the link to confirm your account and get started.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {email && (
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/60 border rounded-xl text-sm font-medium">
            <div className="flex items-center gap-2 truncate pr-2">
              <span className="text-muted-foreground text-xs uppercase font-semibold tracking-wider">To:</span>
              <span className="truncate text-foreground font-semibold">{email}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyEmail}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Copy email"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        )}

        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-amber-700 dark:text-amber-400 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            Tip: Check your Spam or Junk folder
          </p>
          <p className="text-muted-foreground">
            If the email doesn't arrive within 2 minutes, verify your address or use the resend button below.
          </p>
        </div>

        <div className="space-y-2.5 pt-1">
          <a
            href={provider.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors shadow-sm"
          >
            <span>{provider.label}</span>
            <ExternalLink className="h-4 w-4 opacity-80" />
          </a>

          <Button
            type="button"
            variant="outline"
            className="w-full text-sm font-medium h-10 gap-2"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
          >
            <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
            {resending
              ? 'Sending email...'
              : cooldown > 0
              ? `Resend email in ${cooldown}s`
              : 'Resend confirmation email'}
          </Button>
        </div>

        <div className="pt-2 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={onBackToSignup}
            className="hover:text-foreground transition-colors inline-flex items-center gap-1 font-medium"
          >
            <ArrowLeft className="h-3 w-3" />
            Wrong email? Change
          </button>
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-accent hover:underline font-medium"
          >
            Already confirmed? Sign in
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
