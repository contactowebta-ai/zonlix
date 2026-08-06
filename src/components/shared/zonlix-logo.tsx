"use client";

import React from 'react';
import { cn } from "@/lib/utils";

interface ZonlixLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
  showText?: boolean;
  className?: string;
}

export function ZonlixLogo({
  size = 'md',
  variant = 'dark',
  showText = true,
  className = '',
}: ZonlixLogoProps) {
  const sizes = {
    sm: { icon: 24, text: 'text-lg' },
    md: { icon: 32, text: 'text-xl' },
    lg: { icon: 48, text: 'text-2xl' },
  };

  const strokeColor = 'currentColor';
  const textColor = variant === 'dark' ? 'text-slate-900 dark:text-white' : 'text-white';

  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <svg
        viewBox="0 0 64 64"
        width={sizes[size].icon}
        height={sizes[size].icon}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Trazo continuo Z */}
        <polyline
          points="8,13 56,13 8,51 56,51"
          stroke={strokeColor}
          strokeWidth="5.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        {/* Nodo Esmeralda Diamante */}
        <polygon
          points="32,26.5 37.5,32 32,37.5 26.5,32"
          fill="#10b981"
        />
      </svg>

      {showText && (
        <span className={cn("font-sans font-semibold tracking-tight leading-none", sizes[size].text, textColor)}>
          Zonlix
        </span>
      )}
    </div>
  );
}
