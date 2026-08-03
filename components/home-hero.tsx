"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function HomeHero({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center gap-6"
    >
      <motion.h1
        variants={item}
        className="bg-gradient-to-r from-brand-from via-brand-via to-brand-to bg-clip-text text-5xl font-bold tracking-tight text-transparent"
      >
        fracture
      </motion.h1>
      <motion.p
        variants={item}
        className="text-lg text-zinc-600 dark:text-zinc-400"
      >
        One page for all your links. Claim a username, add your links, and
        share a single URL anywhere.
      </motion.p>
      <motion.div variants={item} className="flex gap-3">
        {isSignedIn ? (
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center rounded-full bg-gradient-to-r from-brand-from via-brand-via to-brand-to px-6 text-sm font-medium text-white shadow-lg shadow-brand-via/25 transition-shadow hover:shadow-xl hover:shadow-brand-via/35"
          >
            Go to my page
          </Link>
        ) : (
          <>
            <Link
              href="/register"
              className="inline-flex h-11 items-center rounded-full bg-gradient-to-r from-brand-from via-brand-via to-brand-to px-6 text-sm font-medium text-white shadow-lg shadow-brand-via/25 transition-shadow hover:shadow-xl hover:shadow-brand-via/35"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-full border border-white/60 bg-white/60 px-6 text-sm font-medium text-zinc-800 backdrop-blur-xl transition hover:bg-white/80 dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-200 dark:hover:bg-zinc-900/80"
            >
              Sign in
            </Link>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
