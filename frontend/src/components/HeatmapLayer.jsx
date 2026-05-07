import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

/**
 * Renders a leaflet.heat intensity overlay weighted by alert.risk_score.
 * Mounted only while `enabled` is true.
 */
const HeatmapLayer = ({ alerts, enabled }) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return undefined;
    const points = alerts
      .filter((a) => a?.location && Number.isFinite(a.location.lat))
      .map((a) => [a.location.lat, a.location.lng, Math.max(a.risk_score || 0.2, 0.15)]);

    const layer = L.heatLayer(points, {
      radius: 35,
      blur: 28,
      maxZoom: 6,
      minOpacity: 0.35,
      gradient: {
        0.2: "#007AFF",
        0.4: "#34C759",
        0.6: "#FFCC00",
        0.8: "#FF9F0A",
        1.0: "#FF3B30",
      },
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [alerts, enabled, map]);

  return null;
};

export default HeatmapLayer;
