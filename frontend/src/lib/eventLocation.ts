export interface EventLocationFields {
  venue?: string;
  geo_address?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  location?: string;
}

/** نص الموقع للعرض — مطابق لـ _location_label في الباك-إند. */
export function formatEventLocation(event: EventLocationFields): string {
  if (event.location && event.location !== "—") {
    return event.location;
  }
  const venue = (event.venue || "").trim();
  const geo = (event.geo_address || "").trim();
  if (venue && geo) return `${venue} — ${geo}`;
  if (venue) return venue;
  if (geo) return geo;
  const lat = event.latitude;
  const lng = event.longitude;
  if (lat != null && lng != null && lat !== "" && lng !== "") {
    return `${lat}, ${lng}`;
  }
  return "";
}

export function hasEventLocation(event: EventLocationFields): boolean {
  return formatEventLocation(event).length > 0;
}

export function eventMapsUrl(event: EventLocationFields): string | null {
  const lat = event.latitude;
  const lng = event.longitude;
  if (lat != null && lng != null && lat !== "" && lng !== "") {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  const label = formatEventLocation(event);
  if (label) {
    return `https://www.google.com/maps/search/${encodeURIComponent(label)}`;
  }
  return null;
}
