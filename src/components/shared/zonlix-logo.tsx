"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from "@/lib/utils";

interface ZonlixLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
  showText?: boolean;
  className?: string;
  /** Aplica un drop-shadow esmeralda animado alrededor del ícono SVG.
   *  Default: false — no altera el comportamiento en Sidebar.tsx. */
  glow?: boolean;
}

export function ZonlixLogo({
  size = 'md',
  variant = 'dark',
  showText = true,
  className = '',
  glow = false,
}: ZonlixLogoProps) {
  const sizes = {
    sm: { icon: 24, text: 'text-lg' },
    md: { icon: 32, text: 'text-xl' },
    lg: { icon: 48, text: 'text-2xl' },
  };

  const strokeColor = 'currentColor';
  const textColor = variant === 'dark' ? 'text-slate-900 dark:text-white' : 'text-white';

  const svgElement = (
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
  );

  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      {glow ? (
        // Wrapper animado con pulso de glow esmeralda — mismo patrón que zonlix-loader.tsx
        <motion.div
          className="shrink-0 drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]"
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {svgElement}
        </motion.div>
      ) : (
        svgElement
      )}

      {showText && (
        <span className={cn("font-sans font-semibold tracking-tight leading-none", sizes[size].text, textColor)}>
          Zonlix
        </span>
      )}
    </div>
  );
}
