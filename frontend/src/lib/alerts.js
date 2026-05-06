// Shared constants & helpers for alerts UI.
import {
  Flame,
  Droplets,
  CloudLightning,
  Activity,
  Swords,
  CloudRain,
} from "lucide-react";

export const ALERT_COLORS = {
  heatwave: "#FF3B30",
  flood: "#007AFF",
  rain: "#0A84FF",
  storm: "#5E5CE6",
  outbreak: "#34C759",
  conflict: "#FFCC00",
};

export const CATEGORY_COLORS = {
  weather: "#FF3B30",
  disease: "#34C759",
  conflict: "#FFCC00",
};

export const SEVERITY_RANK = { low: 0, moderate: 1, high: 2, critical: 3 };

export const ICONS = {
  heatwave: Flame,
  flood: Droplets,
  rain: CloudRain,
  storm: CloudLightning,
  outbreak: Activity,
  conflict: Swords,
};

export const subtypeIcon = (subtype) => ICONS[subtype] || Activity;

export const colorForAlert = (alert) =>
  ALERT_COLORS[alert.subtype] || CATEGORY_COLORS[alert.category] || "#ffffff";

export const formatTimeAgo = (iso) => {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};
