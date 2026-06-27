"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753];
const DEFAULT_ZOOM = 13;

if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
  }, [lat, lng, map]);
  return null;
}

interface EventLocationMapProps {
  latitude: number | null;
  longitude: number | null;
  className?: string;
}

export default function EventLocationMap({
  latitude,
  longitude,
  className = "",
}: EventLocationMapProps) {
  const hasCoords = latitude != null && longitude != null;
  const center: [number, number] = hasCoords
    ? [latitude, longitude]
    : DEFAULT_CENTER;

  if (!hasCoords) {
    return (
      <div
        className={`flex h-48 sm:h-56 items-center justify-center rounded-2xl border border-outline-variant/10 bg-surface-container-high text-sm text-on-surface-variant ${className}`}
      >
        <span className="material-symbols-outlined text-outline mr-2">map</span>
        لا توجد إحداثيات لعرض الخريطة
      </div>
    );
  }

  return (
    <div
      className={`h-48 sm:h-56 rounded-2xl overflow-hidden border border-outline-variant/10 ring-1 ring-outline-variant/10 relative z-0 ${className}`}
    >
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full z-0"
        scrollWheelZoom={false}
        dragging
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapRecenter lat={latitude} lng={longitude} />
        <Marker position={[latitude, longitude]} />
      </MapContainer>
    </div>
  );
}
