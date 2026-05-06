import { Radio, Activity, Globe2 } from "lucide-react";
import { motion } from "framer-motion";

const Stat = ({ label, value, color, testid }) => (
  <div className="flex flex-col" data-testid={testid}>
    <span className="label-overline">{label}</span>
    <span
      className="font-mono-data font-semibold text-2xl mt-1"
      style={{ color }}
    >
      {value}
    </span>
  </div>
);

const StatsHeader = ({ stats, connected }) => {
  const total = stats?.total ?? 0;
  const cats = stats?.by_category ?? { weather: 0, disease: 0, conflict: 0 };
  const sev = stats?.by_severity ?? {};
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="glass rounded-2xl m-4 px-6 py-4 flex items-center justify-between gap-6 z-20"
      data-testid="stats-header"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Globe2 className="w-7 h-7 text-white" strokeWidth={1.5} />
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-black ${
              connected ? "bg-emerald-400" : "bg-zinc-500"
            }`}
          />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-base font-semibold tracking-tight">
            Global Early Alert System
          </span>
          <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <Radio className="w-3 h-3" strokeWidth={2} />
            {connected ? "Live feed connected" : "Connecting feed…"}
          </span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-10">
        <Stat label="Active" value={total} color="#fff" testid="stat-total" />
        <Stat label="Heatwave / Flood" value={cats.weather || 0} color="#FF3B30" testid="stat-weather" />
        <Stat label="Disease" value={cats.disease || 0} color="#34C759" testid="stat-disease" />
        <Stat label="Conflict" value={cats.conflict || 0} color="#FFCC00" testid="stat-conflict" />
        <Stat label="Critical" value={sev.critical || 0} color="#FF453A" testid="stat-critical" />
      </div>

      <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 font-mono-data">
        <Activity className="w-3.5 h-3.5" />
        v1.0 / situational-awareness
      </div>
    </motion.header>
  );
};

export default StatsHeader;
