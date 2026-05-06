import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { colorForAlert } from "@/lib/alerts";

const buildIcon = (alert) => {
  const color = colorForAlert(alert);
  const sev = alert.severity || "moderate";
  return L.divIcon({
    html: `<div class="alert-marker sev-${sev}" style="--alert-color:${color}"><div class="ring"></div><div class="core"></div></div>`,
    className: "alert-divicon",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
};

const FlyTo = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 5), {
        duration: 1.2,
      });
    }
  }, [target, map]);
  return null;
};

const GlobalMap = ({ alerts, focus }) => {
  const markerRefs = useRef({});

  useEffect(() => {
    if (focus && markerRefs.current[focus.id]) {
      markerRefs.current[focus.id].openPopup();
    }
  }, [focus]);

  const markers = useMemo(
    () =>
      alerts.map((a) => (
        <Marker
          key={a.id}
          position={[a.location.lat, a.location.lng]}
          icon={buildIcon(a)}
          ref={(m) => {
            if (m) markerRefs.current[a.id] = m;
          }}
        >
          <Popup>
            <div className="text-white text-sm" data-testid={`map-popup-${a.id}`}>
              <div
                className="label-overline mb-1"
                style={{ color: colorForAlert(a) }}
              >
                {a.category} · {a.severity}
              </div>
              <div className="font-display font-semibold text-base mb-1">
                {a.title}
              </div>
              <div className="text-zinc-300 text-xs leading-relaxed mb-2">
                {a.description}
              </div>
              <div className="text-zinc-400 text-[11px] flex justify-between">
                <span>{a.country}{a.region ? ` · ${a.region}` : ""}</span>
                <span className="font-mono-data">
                  risk {(a.risk_score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </Popup>
        </Marker>
      )),
    [alerts]
  );

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      worldCopyJump
      zoomControl
      style={{ height: "100%", width: "100%" }}
      data-testid="global-map"
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      {markers}
      <FlyTo target={focus?.location} />
    </MapContainer>
  );
};

export default GlobalMap;
