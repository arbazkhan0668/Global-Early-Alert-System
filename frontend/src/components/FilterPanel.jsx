import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { CloudRain, Activity, Swords, Layers } from "lucide-react";

const filterDefs = [
  { key: "weather", label: "Weather & Floods", color: "#FF3B30", Icon: CloudRain },
  { key: "disease", label: "Disease Outbreaks", color: "#34C759", Icon: Activity },
  { key: "conflict", label: "Conflict Zones", color: "#FFCC00", Icon: Swords },
];

const sevLabels = ["low", "moderate", "high", "critical"];

const FilterPanel = ({ filters, onChange, minSeverity, onMinSeverity, heatmapOn, onHeatmap }) => {
  return (
    <motion.aside
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.15, duration: 0.5 }}
      className="glass rounded-2xl mx-4 mb-4 px-5 py-5 w-72 flex flex-col gap-5 z-20"
      data-testid="filter-panel"
    >
      <div>
        <div className="label-overline mb-3">Categories</div>
        <div className="flex flex-col gap-3">
          {filterDefs.map(({ key, label, color, Icon }) => (
            <label
              key={key}
              className="flex items-center justify-between cursor-pointer group"
              data-testid={`filter-${key}`}
            >
              <span className="flex items-center gap-2.5 text-sm">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                />
                <Icon
                  className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors"
                  strokeWidth={1.5}
                />
                {label}
              </span>
              <Switch
                checked={filters[key]}
                onCheckedChange={(v) => onChange({ ...filters, [key]: v })}
                data-testid={`switch-${key}`}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/5" />

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="label-overline">Min. severity</span>
          <span
            className="text-xs font-mono-data uppercase tracking-wider"
            style={{ color: ["#a1a1aa", "#FFCC00", "#FF9F0A", "#FF3B30"][minSeverity] }}
          >
            {sevLabels[minSeverity]}
          </span>
        </div>
        <Slider
          value={[minSeverity]}
          min={0}
          max={3}
          step={1}
          onValueChange={(v) => onMinSeverity(v[0])}
          data-testid="severity-slider"
        />
      </div>

      <div className="h-px bg-white/5" />

      <label
        className="flex items-center justify-between cursor-pointer"
        data-testid="filter-heatmap"
      >
        <span className="flex items-center gap-2.5 text-sm">
          <Layers className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
          Risk heatmap
        </span>
        <Switch checked={heatmapOn} onCheckedChange={onHeatmap} data-testid="switch-heatmap" />
      </label>
    </motion.aside>
  );
};

export default FilterPanel;
