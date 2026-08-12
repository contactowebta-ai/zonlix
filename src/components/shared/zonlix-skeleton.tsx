"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ZonlixSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  showWatermark?: boolean;
}

export function ZonlixSkeleton({ className, showWatermark = true, ...props }: ZonlixSkeletonProps) {
  return (
    <div className="relative overflow-hidden w-full h-full">
      <Skeleton className={cn("w-full h-full rounded-xl", className)} {...props} />
      {showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05]">
          <svg
            viewBox="0 0 64 64"
            className="w-1/2 h-1/2 max-w-[64px] max-h-[64px] min-w-[24px] min-h-[24px] text-foreground"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polyline
              points="8,13 56,13 8,51 56,51"
              stroke="currentColor"
              strokeWidth="5.5"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export function ZonlixSkeletonCard({ className, ...props }: ZonlixSkeletonProps) {
  return <ZonlixSkeleton className={cn("h-[120px] w-full", className)} {...props} />;
}

export function ZonlixSkeletonRow({ className, ...props }: ZonlixSkeletonProps) {
  return <ZonlixSkeleton className={cn("h-16 w-full", className)} {...props} />;
}

export function ZonlixSkeletonText({ className, ...props }: ZonlixSkeletonProps) {
  return (
    <div className="space-y-2 w-full">
      <ZonlixSkeleton className={cn("h-4 w-full", className)} showWatermark={false} {...props} />
      <ZonlixSkeleton className={cn("h-4 w-[90%]", className)} showWatermark={false} {...props} />
      <ZonlixSkeleton className={cn("h-4 w-[80%]", className)} showWatermark={false} {...props} />
    </div>
  );
}
