import { useEffect, useState } from "react";
import axios from "axios";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Database } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const LABEL = { weather: "Weather", disease: "Disease", conflict: "Conflict" };

const Dot = ({ live }) => (
  <span
    className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-400" : "bg-amber-400"}`}
    style={{ boxShadow: `0 0 6px ${live ? "#34d399" : "#fbbf24"}` }}
  />
);

const SourceStatus = () => {
  const [sources, setSources] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await axios.get(`${API}/sources`);
        if (!cancelled) setSources(r.data);
      } catch {
        /* silent */
      }
    };
    load();
    const t = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!sources) return null;
  const liveCount = Object.values(sources).filter((s) => s.live).length;
  const totalCount = Object.keys(sources).length;

  return (
    <HoverCard openDelay={120}>
      <HoverCardTrigger asChild>
        <button
          className="hidden md:flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white transition-colors font-mono-data"
          data-testid="source-status"
        >
          <Database className="w-3 h-3" strokeWidth={1.8} />
          <span>
            {liveCount}/{totalCount} live
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="end"
        className="glass border-white/10 text-white w-72"
      >
        <div className="label-overline mb-3">Data sources</div>
        <div className="space-y-2.5">
          {Object.entries(sources).map(([cat, s]) => (
            <div
              key={cat}
              className="flex items-center justify-between text-xs"
              data-testid={`source-${cat}`}
            >
              <span className="flex items-center gap-2 text-zinc-300">
                <Dot live={s.live} />
                {LABEL[cat]}
              </span>
              <span
                className={`font-mono-data text-[10px] uppercase tracking-wider ${
                  s.live ? "text-emerald-300" : "text-amber-300/80"
                }`}
              >
                {s.live ? "live" : "mock"} · {s.provider}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-zinc-500 leading-relaxed">
          Add API keys to <span className="font-mono-data text-zinc-300">/app/backend/.env</span> to flip mocks to live.
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default SourceStatus;
