"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753];
const DEFAULT_ZOOM = 12;

// أيقونة العلامة الافتراضية في Leaflet مع Next.js
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

export interface GeoSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapFlyTo({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    }
  }, [lat, lng, map]);
  return null;
}

interface GeoLocationMapProps {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  onAddressSuggestion?: (label: string) => void;
  className?: string;
}

export default function GeoLocationMap({
  latitude,
  longitude,
  onLocationChange,
  onAddressSuggestion,
  className = "",
}: GeoLocationMapProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GeoSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const center: [number, number] =
    latitude != null && longitude != null ? [latitude, longitude] : DEFAULT_CENTER;

  const runSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "json");
      url.searchParams.set("q", q);
      url.searchParams.set("limit", "6");
      url.searchParams.set("accept-language", "ar");
      const res = await fetch(url.toString());
      const data = (await res.json()) as GeoSearchResult[];
      setResults(data);
      setSearchOpen(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(search), 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, runSearch]);

  const pickResult = (item: GeoSearchResult) => {
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    onLocationChange(lat, lng);
    if (onAddressSuggestion) onAddressSuggestion(item.display_name);
    setSearch(item.display_name.split(",").slice(0, 2).join("، "));
    setSearchOpen(false);
    setResults([]);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative">
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
          search
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => results.length > 0 && setSearchOpen(true)}
          placeholder="ابحث عن موقع (مثال: قصر الوجبة، الدوحة)"
          className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl py-3.5 pr-10 pl-4 text-on-surface text-sm focus:ring-2 focus:ring-primary-container/40 outline-none"
        />
        {searching && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
        {searchOpen && results.length > 0 && (
          <ul
            className="absolute z-30 top-full mt-2 w-full rounded-xl border border-outline-variant/20 bg-surface-container-high shadow-2xl overflow-hidden"
          >
            {results.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  className="w-full text-right px-4 py-3 text-sm text-on-surface hover:bg-primary-container/10 transition-colors border-b border-outline-variant/10 last:border-0"
                  onClick={() => pickResult(r)}
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="h-[280px] sm:h-[320px] rounded-2xl overflow-hidden ring-1 ring-outline-variant/20 relative z-0">
        <MapContainer
          center={center}
          zoom={DEFAULT_ZOOM}
          className="w-full h-full z-0"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onPick={onLocationChange} />
          <MapFlyTo lat={latitude} lng={longitude} />
          {latitude != null && longitude != null && (
            <Marker position={[latitude, longitude]} />
          )}
        </MapContainer>
        <div className="absolute bottom-3 right-3 z-[400] bg-surface-container-high/90 backdrop-blur px-3 py-1.5 rounded-xl text-[10px] font-bold text-primary flex items-center gap-1 pointer-events-none">
          <span className="material-symbols-outlined text-sm">touch_app</span>
          انقر على الخريطة أو الصق الإحداثيات
        </div>
      </div>
    </div>
  );
}
