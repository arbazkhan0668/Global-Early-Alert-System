import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import GlobalMap from "@/components/GlobalMap";
import StatsHeader from "@/components/StatsHeader";
import FilterPanel from "@/components/FilterPanel";
import AlertsFeed from "@/components/AlertsFeed";
import TimelineBar from "@/components/TimelineBar";
import { SEVERITY_RANK } from "@/lib/alerts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const HOUR_OPTIONS = [1, 6, 12, 24, 72, 168];

const Dashboard = () => {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    weather: true,
    disease: true,
    conflict: true,
  });
  const [minSeverity, setMinSeverity] = useState(0);
  const [hours, setHours] = useState(3); // 24h
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [focus, setFocus] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const wsRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([
        axios.get(`${API}/alerts`, { params: { limit: 500 } }),
        axios.get(`${API}/alerts/stats`),
      ]);
      setAlerts(a.data || []);
      setStats(s.data);
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.error("fetch alerts failed", e);
      }
      toast.error("Could not load alerts feed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // WebSocket
  useEffect(() => {
    if (!BACKEND_URL) return;
    const wsUrl = BACKEND_URL.replace(/^http/, "ws") + "/api/ws";
    let ws;
    let retry;
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          retry = setTimeout(connect, 4000);
        };
        ws.onerror = () => setConnected(false);
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === "alert" && msg.alert) {
              setAlerts((prev) => {
                const exists = prev.find((p) => p.id === msg.alert.id);
                if (exists) return prev;
                return [msg.alert, ...prev].slice(0, 500);
              });
              toast(`${msg.alert.title}`, {
                description: `${msg.alert.country} · severity ${msg.alert.severity}`,
              });
            }
          } catch (err) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("ws message parse failed", err);
            }
          }
        };
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.error("ws connect failed", e);
        }
      }
    };
    connect();
    return () => {
      if (retry) clearTimeout(retry);
      if (ws) ws.close();
    };
  }, []);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - HOUR_OPTIONS[hours] * 3600 * 1000;
    return alerts.filter((a) => {
      if (!filters[a.category]) return false;
      if (SEVERITY_RANK[a.severity] < minSeverity) return false;
      const t = new Date(a.timestamp).getTime();
      if (Number.isFinite(t) && t < cutoff) return false;
      return true;
    });
  }, [alerts, filters, minSeverity, hours]);

  const filteredStats = useMemo(() => {
    const by_category = { weather: 0, disease: 0, conflict: 0 };
    const by_severity = { low: 0, moderate: 0, high: 0, critical: 0 };
    filtered.forEach((a) => {
      by_category[a.category] = (by_category[a.category] || 0) + 1;
      by_severity[a.severity] = (by_severity[a.severity] || 0) + 1;
    });
    return { total: filtered.length, by_category, by_severity };
  }, [filtered]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/refresh`);
      await fetchAll();
      toast.success("Alerts refreshed");
    } catch {
      toast.error("Refresh failed");
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050505]">
      {/* Map base layer */}
      <div className="absolute inset-0 z-0">
        <GlobalMap
          alerts={heatmapOn ? filtered : filtered}
          focus={focus}
          heatmap={heatmapOn}
        />
      </div>

      {/* Top header */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="pointer-events-auto">
          <StatsHeader stats={filteredStats} connected={connected} alerts={filtered} />
        </div>
      </div>

      {/* Left panel */}
      <div className="absolute left-0 top-24 z-20 pointer-events-none">
        <div className="pointer-events-auto">
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            minSeverity={minSeverity}
            onMinSeverity={setMinSeverity}
            heatmapOn={heatmapOn}
            onHeatmap={setHeatmapOn}
          />
        </div>
      </div>

      {/* Right feed */}
      <div className="absolute right-0 top-24 bottom-24 z-20 pointer-events-none flex">
        <div className="pointer-events-auto h-full">
          <AlertsFeed alerts={filtered} onSelect={setFocus} loading={loading} />
        </div>
      </div>

      {/* Bottom timeline */}
      <div className="absolute bottom-0 left-0 right-[388px] z-20 pointer-events-none">
        <div className="pointer-events-auto">
          <TimelineBar
            hours={hours}
            onHours={setHours}
            onRefresh={handleRefresh}
            lastUpdated={lastUpdated || stats?.updated_at}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
