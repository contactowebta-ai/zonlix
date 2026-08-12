"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ZonlixLoader } from "./zonlix-loader";

export interface ZonlixPageLoaderProps {
  isLoading: boolean;
}

export function ZonlixPageLoader({ isLoading }: ZonlixPageLoaderProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="zonlix-page-loader"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#F8F9FA]/95 dark:bg-[#0B0F17]/95 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-6">
            <ZonlixLoader size={72} />
            <div className="w-48 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                animate={{
                  x: ["-100%", "200%"],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: "easeInOut",
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
