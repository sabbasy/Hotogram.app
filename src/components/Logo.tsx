import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  text?: string;
}

export const Logo = ({ className, iconOnly = false, text = "hotogram" }: LogoProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* We use an standard HTML img tag to display the logo from our public folder */}
      <img 
        src="/hotogram-logo.svg" 
        alt="Hotogram Logo" 
        className="w-10 h-10 object-contain shrink-0" 
      />
      
      {!iconOnly && (
        <span className="text-2xl font-bold tracking-tight lowercase">
          {text}<span className="text-accent">.</span>
        </span>
      )}
    </div>
  );
};
