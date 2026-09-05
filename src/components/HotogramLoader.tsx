import React from 'react';
import { cn } from '@/lib/utils';

interface HotogramLoaderProps {
  className?: string;
  text?: string;
  fullScreen?: boolean;
}

export const HotogramLoader = ({
  className,
  text = "Loading menu...",
  fullScreen = true
}: HotogramLoaderProps) => {
  const content = (
    <div className={cn("flex flex-col items-center justify-center space-y-5 p-6 text-center", className)}>
      {/* Outer Glowing Ring & Animated Hotogram Logo */}
      <div className="relative flex items-center justify-center">
        {/* Glowing Aura Ring */}
        <div className="absolute w-20 h-20 bg-accent/20 rounded-full blur-xl animate-pulse" />
        
        {/* Rotating Outer Ring with Dots */}
        <div className="absolute w-16 h-16 border-2 border-accent/20 border-t-accent rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />

        {/* Central Hotogram Logo Icon */}
        <div className="relative z-10 p-3 bg-card/80 backdrop-blur border rounded-2xl shadow-lg">
          <img 
            src="/hotogram-logo.svg" 
            alt="Hotogram" 
            className="w-9 h-9 object-contain animate-bounce"
            style={{ animationDuration: '2s' }}
          />
        </div>
      </div>

      {/* Animated Bouncing Dot Particles */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        <span className="text-sm font-semibold tracking-wide text-foreground lowercase">
          hotogram<span className="text-accent">.</span>
        </span>
        <div className="flex gap-1 items-center ml-1">
          <span className="w-1.5 h-1.5 bg-accent rounded-full animate-ping" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-accent rounded-full animate-ping" style={{ animationDelay: '200ms' }} />
          <span className="w-1.5 h-1.5 bg-accent rounded-full animate-ping" style={{ animationDelay: '400ms' }} />
        </div>
      </div>

      {text && (
        <p className="text-xs text-muted-foreground animate-pulse font-medium">
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground z-50">
        {content}
      </div>
    );
  }

  return content;
};
