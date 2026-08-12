"use client";
import { motion } from "framer-motion";

interface ZonlixLoaderProps {
  size?: number;
  text?: string;
  inline?: boolean;
  variant?: "default" | "button";
}

export function ZonlixLoader({ size = 48, text, inline = false, variant = "default" }: ZonlixLoaderProps) {
  const actualSize = variant === "button" ? 16 : size;
  
  const svgContent = (
    <svg
      viewBox="0 0 64 64"
      width={actualSize}
      height={actualSize}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={variant === "button" ? "shrink-0" : ""}
    >
      <polyline
        points="8,13 56,13 8,51 56,51"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
        className={variant === "button" ? "" : "stroke-slate-900 dark:stroke-slate-100"}
      />
      {/* Nodo con pulso de resplandor IA */}
      <motion.polygon
        points="32,26.5 37.5,32 32,37.5 26.5,32"
        fill="#10b981"
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </svg>
  );

  if (inline || variant === "button") {
    return (
      <span className={`inline-flex items-center ${variant === "button" ? "gap-1.5" : "gap-2"}`}>
        {svgContent}
        {text && <span className={variant === "button" ? "" : "animate-pulse"}>{text}</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-4 w-full h-full">
      <div className="relative flex items-center justify-center">
        {svgContent}
      </div>
      {text && (
        <p className="text-xs font-medium text-slate-500 animate-pulse tracking-wide">
          {text}
        </p>
      )}
    </div>
  );
}

