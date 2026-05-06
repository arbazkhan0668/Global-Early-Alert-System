import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const TimelineBar = ({ hours, onHours, onRefresh, lastUpdated }) => {
  const labels = ["1h", "6h", "12h", "24h", "3d", "7d"];
  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="glass rounded-2xl mx-4 mb-4 px-5 py-3.5 flex items-center gap-6 z-20"
      data-testid="timeline-bar"
    >
      <div className="flex items-center gap-2 shrink-0">
        <Clock className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
        <span className="label-overline">Window</span>
        <span className="font-mono-data text-xs text-white ml-1">{labels[hours]}</span>
      </div>
      <div className="flex-1">
        <Slider
          value={[hours]}
          min={0}
          max={5}
          step={1}
          onValueChange={(v) => onHours(v[0])}
          data-testid="timeline-slider"
        />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {lastUpdated && (
          <span className="text-[11px] text-zinc-500 font-mono-data hidden md:inline">
            Updated {new Date(lastUpdated).toLocaleTimeString()}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="h-8 px-3 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
          data-testid="refresh-btn"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>
    </motion.div>
  );
};

export default TimelineBar;
