import L from 'leaflet';

/** Harita iğnesi (kart renklerine uygun, CSS ile çizilir). */
export const pinIcon = L.divIcon({
  className: 'cc-pin-wrap',
  html: '<span class="cc-pin"><i></i></span>',
  iconSize: [34, 42],
  iconAnchor: [17, 40],
});
