import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Sunrise, TrendingUp, Share2 } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/alerts";
import { recordTodayDigest } from "@/lib/digestHistory";
import DigestHistoryDrawer from "@/components/DigestHistoryDrawer";

/**
 * Daily Risk Digest card - a pinned summary of today's global alert landscape.
 * Derived live from the current alerts list. One-click share opens the
 * snapshot modal pre-scoped to the digest.
 */
const DigestCard = ({ alerts, onShare }) => {
  const digest = useMemo(() => {
    if (!alerts.length) return null;
    const countryCount = {};
    const catCount = { weather: 0, disease: 0, conflict: 0 };
    let topRisk = alerts[0];
    for (const a of alerts) {
      countryCount[a.country] = (countryCount[a.country] || 0) + 1;
      catCount[a.category] = (catCount[a.category] || 0) + 1;
      if ((a.risk_score || 0) > (topRisk.risk_score || 0)) topRisk = a;
    }
    const countries = Object.keys(countryCount).length;
    const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
    return {
      total: alerts.length,
      countries,
      topRisk,
      topCategory: topCat[0],
      topCategoryCount: topCat[1],
    };
  }, [alerts]);

  // Persist today's digest to local history (no-op if alerts list is empty).
  useEffect(() => {
    if (digest) recordTodayDigest(digest);
  }, [digest?.total, digest?.topCategory]);

  if (!digest) return null;

  const today = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-4 mb-3 overflow-hidden"
      data-testid="digest-card"
    >
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-40"
        style={{ background: CATEGORY_COLORS[digest.topCategory] || "#007AFF" }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Sunrise className="w-3.5 h-3.5 text-amber-300" strokeWidth={1.8} />
            <span className="label-overline text-amber-300/90">
              Risk Digest · {today}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <DigestHistoryDrawer />
            <button
              onClick={onShare}
              className="text-zinc-400 hover:text-white transition-colors"
              title="Share digest"
              data-testid="digest-share"
            >
              <Share2 className="w-3.5 h-3.5" strokeWidth={1.8} />
            </button>
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-display text-2xl font-semibold text-white font-mono-data">
            {digest.total}
          </span>
          <span className="text-[11px] text-zinc-400 uppercase tracking-wider">
            signals · {digest.countries} countries
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-2.5">
          <TrendingUp className="w-3 h-3" />
          <span>
            Leading:{" "}
            <span
              className="font-medium capitalize"
              style={{ color: CATEGORY_COLORS[digest.topCategory] }}
            >
              {digest.topCategory}
            </span>{" "}
            ({digest.topCategoryCount})
          </span>
        </div>

        <div className="rounded-lg bg-black/30 border border-white/5 p-2.5">
          <div className="label-overline mb-1 text-zinc-500">Top risk</div>
          <div className="text-xs font-medium text-white truncate">
            {digest.topRisk.title}
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[10px] text-zinc-500 truncate">
              {digest.topRisk.country}
            </span>
            <span className="text-[11px] font-mono-data text-white">
              {(digest.topRisk.risk_score * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DigestCard;
