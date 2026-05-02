import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { listProviders } from "../lib/api";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";

const dotIcon = L.divIcon({
  className: "custom-marker",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:linear-gradient(145deg,#fff,#c9d9ff);box-shadow:0 0 0 4px rgba(126,163,255,0.35),0 0 24px rgba(126,163,255,0.75);border:1px solid #fff"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function MapView() {
  const [providers, setProviders] = useState([]);

  useEffect(() => { listProviders({ limit: 500 }).then(setProviders); }, []);

  const withGeo = providers.filter((p) => p.lat && p.lng);
  const center = withGeo[0] ? [withGeo[0].lat, withGeo[0].lng] : [39.5, -98.35];

  return (
    <div className="fade-up">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-overline mb-3">Geography</div>
          <h1 className="serif text-6xl tracking-tight">Map</h1>
          <p className="text-white/60 mt-3">{withGeo.length} of {providers.length} providers geocoded.</p>
        </div>
      </div>

      <div className="glass p-2 h-[600px] overflow-hidden">
        <MapContainer center={center} zoom={withGeo.length ? 11 : 4} className="h-full w-full" scrollWheelZoom data-testid="map-container">
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          {withGeo.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={dotIcon}>
              <Popup>
                <div className="p-1 min-w-[200px]">
                  <div className="text-[10px] tracking-widest uppercase text-white/50 mb-1">{p.specialty || "Provider"}</div>
                  <div className="serif text-lg text-white mb-2" style={{ fontFamily: "Instrument Serif, serif" }}>{p.name}</div>
                  {(p.city || p.state) && <div className="text-xs text-white/70 mb-2 flex items-center gap-1"><MapPin size={11} />{[p.city, p.state].filter(Boolean).join(", ")}</div>}
                  {p.phone && <div className="text-xs text-white/60 mb-2">{p.phone}</div>}
                  <Link to={`/providers/${p.id}`} className="text-xs" style={{ color: "#7ea3ff" }}>View details →</Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {withGeo.length === 0 && providers.length > 0 && (
        <div className="glass p-8 mt-6 text-center text-white/60">
          None of your providers have coordinates yet. Addresses are geocoded automatically on save — make sure the address + city are filled in.
        </div>
      )}
      {providers.length === 0 && (
        <div className="glass p-8 mt-6 text-center text-white/60">
          No providers yet. <Link to="/upload" className="underline" style={{ color: "var(--accent)" }}>Upload a file</Link> to get started.
        </div>
      )}
    </div>
  );
}
