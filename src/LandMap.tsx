import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { M_PER_MILE, propertyRadiusM, type WaterFeature } from "./geo";

export type MapListing = { id: string; name: string; lat: number; lon: number; acres: number; tone: string };

const USGS = "https://basemap.nationalmap.gov/arcgis/rest/services";

export function LandMap({
  center,
  listings,
  selectedId,
  pending,
  water,
  onPick,
  onSelect,
}: {
  center: [number, number, number];
  listings: MapListing[];
  selectedId: string | null;
  pending: [number, number] | null;
  water: WaterFeature[];
  onPick: (lat: number, lon: number) => void;
  onSelect: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const overlay = useRef<L.LayerGroup | null>(null);
  const handlers = useRef({ onPick, onSelect });
  handlers.current = { onPick, onSelect };

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView([center[0], center[1]], center[2]);
    const topo = L.tileLayer(`${USGS}/USGSTopo/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 16,
      attribution: "USGS The National Map",
    });
    const imagery = L.tileLayer(`${USGS}/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 16,
      attribution: "USGS The National Map",
    });
    topo.addTo(m);
    L.control.layers({ "USGS topo": topo, "Aerial + topo": imagery }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => handlers.current.onPick(e.latlng.lat, e.latlng.lng));
    overlay.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    map.current?.setView([center[0], center[1]], center[2]);
  }, [center[0], center[1], center[2]]);

  useEffect(() => {
    const g = overlay.current;
    if (!g) return;
    g.clearLayers();
    for (const f of water) {
      const style = { color: f.perennial ? "#3b82f6" : "#93c5fd", weight: f.perennial ? 3 : 2, dashArray: f.perennial ? undefined : "4 4" };
      if (f.line) f.line.forEach((p) => L.polyline(p, style).addTo(g));
      if (f.area) L.polygon(f.area, { ...style, fillOpacity: 0.35 }).addTo(g);
    }
    for (const l of listings) {
      const sel = l.id === selectedId;
      if (sel) {
        L.circle([l.lat, l.lon], { radius: M_PER_MILE, color: "#a3a3a3", weight: 1, dashArray: "6 6", fill: false }).addTo(g);
        L.circle([l.lat, l.lon], { radius: propertyRadiusM(l.acres), color: l.tone, weight: 2, fillOpacity: 0.12 }).addTo(g);
      }
      L.circleMarker([l.lat, l.lon], { radius: sel ? 9 : 7, color: "#111", weight: 1, fillColor: l.tone, fillOpacity: 1 })
        .bindTooltip(l.name)
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          handlers.current.onSelect(l.id);
        })
        .addTo(g);
    }
    if (pending) {
      L.circleMarker(pending, { radius: 7, color: "#fff", weight: 2, fillColor: "#f59e0b", fillOpacity: 1 })
        .bindTooltip("New listing location")
        .addTo(g);
    }
  }, [listings, selectedId, pending, water]);

  useEffect(() => {
    const l = listings.find((x) => x.id === selectedId);
    if (l && map.current) map.current.setView([l.lat, l.lon], Math.max(map.current.getZoom(), 13));
  }, [selectedId]);

  return <div ref={el} style={{ height: 520, borderRadius: 8, overflow: "hidden" }} />;
}
