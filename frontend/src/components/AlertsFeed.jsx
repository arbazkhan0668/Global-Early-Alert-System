import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { colorForAlert, formatTimeAgo, subtypeIcon } from "@/lib/alerts";
import DigestCard from "@/components/DigestCard";

const AlertCard = ({ alert, onSelect, index }) => {
  const Icon = subtypeIcon(alert.subtype);
  const color = colorForAlert(alert);
  return (
    <motion.button
      layout
      initial={{ x: 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 30, opacity: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.4 }}
      whileHover={{ y: -2 }}
      onClick={() => onSelect(alert)}
      className="relative w-full text-left rounded-xl border border-white/5 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/15 transition-colors p-3.5 pl-5 group"
      data-testid={`alert-card-${alert.id}`}
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ background: color, boxShadow: `0 0 12px ${color}` }}
      />
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}22`, color }}
        >
          <Icon className="w-4 h-4" strokeWidth={1.7} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span
              className="label-overline"
              style={{ color }}
            >
              {alert.subtype} · {alert.severity}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono-data shrink-0">
              {formatTimeAgo(alert.timestamp)}
            </span>
          </div>
          <div className="font-display text-sm font-medium text-white leading-snug truncate">
            {alert.title}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] text-zinc-400 truncate">
              {alert.region ? `${alert.region}, ` : ""}
              {alert.country}
            </span>
            <span className="text-[11px] font-mono-data text-zinc-300">
              {(alert.risk_score * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.button>
  );
};

const AlertsFeed = ({ alerts, onSelect, loading, onShareDigest }) => {
  return (
    <motion.aside
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="glass rounded-2xl mr-4 mt-4 mb-4 w-[360px] flex flex-col z-20"
      data-testid="alerts-feed"
    >
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <div className="label-overline">Live alerts feed</div>
          <div className="font-display text-base font-semibold mt-0.5">
            {alerts.length} active signal{alerts.length === 1 ? "" : "s"}
          </div>
        </div>
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
        </span>
      </div>
      <div className="px-4 pb-4 flex-1 overflow-y-auto thin-scroll space-y-2.5">
        <DigestCard alerts={alerts} onShare={onShareDigest} />
        <AnimatePresence initial={false}>
          {alerts.map((a, i) => (
            <AlertCard key={a.id} alert={a} onSelect={onSelect} index={i} />
          ))}
        </AnimatePresence>
        {!loading && alerts.length === 0 && (
          <div className="text-center text-sm text-zinc-500 py-10">
            No alerts match your filters.
          </div>
        )}
        {loading && (
          <div className="text-center text-sm text-zinc-500 py-10">
            Loading global alerts…
          </div>
        )}
      </div>
    </motion.aside>
  );
};

export default AlertsFeed;
