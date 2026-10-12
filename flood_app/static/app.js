/**
 * Aqualert: Autonomous Space & Ground Disaster System
 * Leaflet-Powered GIS Engine — ZERO API KEYS OR SIGN-IN REQUIRED
 */

// Global State
let map = null;
let currentBaseLayer = null;
let currentMapMode = 'zone'; // 'zone', 'realistic', '3d', 'satellite'
let overlayOpacity = 0.45;
let isMarkingToolActive = false;
let rememberFiltersActive = true;

// Data containers
let rawZones = [];
let rawFloodProne = [];
let rawSOS = [];

// Layer Groups
let zonesLayerGroup = null;
let floodProneLayerGroup = null;
let sosLayerGroup = null;

// Storage key for "Yaad Karlo" filter persistence
const STORAGE_KEY_FILTERS = 'aqualert_saved_filters';

// 4 Fast, Open Basemap Tile Providers (Zero API Key, Zero Login)
const BASEMAPS = {
  zone: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: '&copy; Esri &copy; OpenStreetMap (High-Contrast Zone Cartography)'
  }),
  realistic: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '&copy; Esri &bull; Street Cartography'
  }),
  '3d': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: '&copy; Esri Topographical 3D Terrain'
  }),
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: '&copy; Esri, Maxar, Earthstar Geographics'
  })
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadSavedFilters();
  fetchData();

  // Periodic auto-sync
  setInterval(fetchData, 12000);
});

function initMap() {
  // Center on Bhote Koshi - Trishuli river corridor (Nepal)
  const initialCenter = [27.95, 85.55];

  map = L.map('map', {
    center: initialCenter,
    zoom: 10,
    zoomControl: false
  });

  // Controls
  L.control.zoom({ position: 'top-right' }).addTo(map);
  L.control.scale({ imperial: false, metric: true, position: 'bottom-left' }).addTo(map);

  // Set default basemap: 1. Zone Map
  currentBaseLayer = BASEMAPS['zone'];
  currentBaseLayer.addTo(map);

  // Initialize Layer Groups for dynamic filtering
  zonesLayerGroup = L.layerGroup().addTo(map);
  floodProneLayerGroup = L.layerGroup().addTo(map);
  sosLayerGroup = L.layerGroup().addTo(map);

  // Click on map for Marking Flood-Prone Area (Req 5)
  map.on('click', (e) => {
    if (isMarkingToolActive) {
      handleMapClickForMarking(e.latlng.lat, e.latlng.lng);
    }
  });
}

// ================= 4 MAP MODES (Requirement 9) =================
function switchMapMode(mode) {
  currentMapMode = mode;
  const buttons = {
    zone: document.getElementById('btn-map-zone'),
    realistic: document.getElementById('btn-map-realistic'),
    '3d': document.getElementById('btn-map-3d'),
    satellite: document.getElementById('btn-map-satellite')
  };

  // Update button active styling
  Object.keys(buttons).forEach(key => {
    const btn = buttons[key];
    if (key === mode) {
      btn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 bg-blue-600 text-white shadow";
    } else {
      btn.className = "px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 text-slate-400 hover:text-white";
    }
  });

  // Switch basemap layer
  if (currentBaseLayer) {
    map.removeLayer(currentBaseLayer);
  }
  currentBaseLayer = BASEMAPS[mode];
  currentBaseLayer.addTo(map);
  currentBaseLayer.bringToBack();

  // 3D Perspective tilt handling
  const mapElement = document.getElementById('map');
  if (mode === '3d') {
    mapElement.classList.add('map-perspective-3d');
    map.flyTo([27.95, 85.55], 11, { duration: 1.5 });
  } else {
    mapElement.classList.remove('map-perspective-3d');
  }
}

// ================= FETCH DATA FROM BACKEND =================
async function fetchData() {
  try {
    const [resZones, resFP, resSOS, resSummary] = await Promise.all([
      fetch('/api/zones').then(r => r.json()),
      fetch('/api/flood-prone').then(r => r.json()),
      fetch('/api/sos').then(r => r.json()),
      fetch('/api/summary').then(r => r.json())
    ]);

    rawZones = resZones;
    rawFloodProne = resFP;
    rawSOS = resSOS;

    updateUIElements(resSummary);
    applyFilters();
  } catch (err) {
    console.error("Disaster intelligence fetch error:", err);
  }
}

function updateUIElements(summary) {
  if (!summary) return;

  // Counts in Filter Legend
  document.getElementById('cnt-green').textContent = summary.zone_counts.green_safe || 0;
  document.getElementById('cnt-yellow').textContent = summary.zone_counts.yellow_nearby || 0;
  document.getElementById('cnt-orange').textContent = summary.zone_counts.orange_unsafe || 0;
  document.getElementById('cnt-red').textContent = summary.zone_counts.red_flooded || 0;
  document.getElementById('cnt-flood-prone').textContent = summary.flood_prone_marked_areas || 0;

  // 15-Day locked count
  document.getElementById('locked-badge-count').textContent = summary.locked_15_day_zones || 0;

  // SOS active count
  document.getElementById('sos-active-count').textContent = (summary.sos_metrics.pending || 0) + (summary.sos_metrics.dispatched || 0);

  // Render 15-Day Watchlist Drawer
  renderWatchlistDrawer();

  // Render SOS Dispatch Feed
  renderSOSFeed();
}

// ================= FILTERS ("YAAD KARLO" - Requirement 8) =================
function getFilterState() {
  return {
    show_green: document.getElementById('chk-green').checked,
    show_yellow: document.getElementById('chk-yellow').checked,
    show_orange: document.getElementById('chk-orange').checked,
    show_red: document.getElementById('chk-red').checked,
    show_flood_prone: document.getElementById('chk-flood-prone').checked,
    show_15day_locked_only: document.getElementById('chk-15day-locked').checked,
    search_query: document.getElementById('filter-search').value.toLowerCase().trim()
  };
}

function applyFilters() {
  const filters = getFilterState();

  // Save to persistent storage if "Yaad Karlo" is enabled
  if (rememberFiltersActive) {
    saveFilterPreferences(filters);
  }

  // Filter Zones
  const filteredZones = rawZones.filter(z => {
    if (z.type === 'safe' && !filters.show_green) return false;
    if (z.type === 'nearby' && !filters.show_yellow) return false;
    if (z.type === 'unsafe' && !filters.show_orange) return false;
    if (z.type === 'flooded' && !filters.show_red) return false;
    if (filters.show_15day_locked_only && !z.is_locked_15_days) return false;

    if (filters.search_query) {
      const match = (z.name || '').toLowerCase().includes(filters.search_query) ||
                    (z.description || '').toLowerCase().includes(filters.search_query) ||
                    (z.status || '').toLowerCase().includes(filters.search_query);
      if (!match) return false;
    }
    return true;
  });

  // Filter Flood Prone
  const filteredFP = filters.show_flood_prone ? rawFloodProne.filter(fp => {
    if (filters.search_query) {
      return (fp.name || '').toLowerCase().includes(filters.search_query) ||
             (fp.river_basin || '').toLowerCase().includes(filters.search_query);
    }
    return true;
  }) : [];

  renderZonesOnMap(filteredZones);
  renderFloodProneOnMap(filteredFP);
  renderSOSMarkersOnMap(rawSOS);
}

// Yaad Karlo Toggle Handler
function toggleRememberFilter(checked) {
  rememberFiltersActive = checked;
  const pill = document.getElementById('yaad-status-pill');
  if (checked) {
    pill.className = "mt-2 text-[10px] py-1 px-2 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5";
    pill.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 text-xs"></i> <span>Preferences remembered (Yaad hai)</span>`;
    saveFilterPreferences(getFilterState());
  } else {
    pill.className = "mt-2 text-[10px] py-1 px-2 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5";
    pill.innerHTML = `<i class="fa-solid fa-circle-minus text-slate-400 text-xs"></i> <span>Session memory paused</span>`;
    localStorage.removeItem(STORAGE_KEY_FILTERS);
  }
}

function saveFilterPreferences(filters) {
  try {
    localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(filters));
    fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        remember_filters: true,
        saved_filters: filters
      })
    }).catch(e => console.log("Preferences stored in browser"));
  } catch (e) {
    console.warn("Storage write failed", e);
  }
}

function loadSavedFilters() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FILTERS);
    if (saved) {
      const f = JSON.parse(saved);
      if (f.show_green === false && f.show_yellow === false && f.show_orange === false && f.show_red === false) {
        f.show_green = true; f.show_yellow = true; f.show_orange = true; f.show_red = true;
      }
      if (document.getElementById('chk-green')) document.getElementById('chk-green').checked = f.show_green ?? true;
      if (document.getElementById('chk-yellow')) document.getElementById('chk-yellow').checked = f.show_yellow ?? true;
      if (document.getElementById('chk-orange')) document.getElementById('chk-orange').checked = f.show_orange ?? true;
      if (document.getElementById('chk-red')) document.getElementById('chk-red').checked = f.show_red ?? true;
      if (document.getElementById('chk-flood-prone')) document.getElementById('chk-flood-prone').checked = f.show_flood_prone ?? true;
      if (document.getElementById('chk-15day-locked')) document.getElementById('chk-15day-locked').checked = f.show_15day_locked_only ?? false;
      if (document.getElementById('filter-search')) document.getElementById('filter-search').value = f.search_query || '';
    }
  } catch (e) {
    console.warn("Could not load saved filters", e);
  }
}

function resetFilters() {
  document.getElementById('chk-green').checked = true;
  document.getElementById('chk-yellow').checked = true;
  document.getElementById('chk-orange').checked = true;
  document.getElementById('chk-red').checked = true;
  document.getElementById('chk-flood-prone').checked = true;
  document.getElementById('chk-15day-locked').checked = false;
  document.getElementById('filter-search').value = '';
  applyFilters();
}

// Opacity Slider for Realistic Satellite Image blend
function updateOverlayOpacity(val) {
  overlayOpacity = val / 100;
  document.getElementById('opacity-val').textContent = `${val}%`;
  applyFilters(); // Re-render polygons with new opacity
}

// ================= MAP RENDERING =================
let hasFittedBoundsOnce = false;

function renderZonesOnMap(zones) {
  if (!zonesLayerGroup) return;
  zonesLayerGroup.clearLayers();

  const allLatLngs = [];

  const typeLabelsShort = {
    safe: 'SAFE ZONE',
    nearby: 'FLOOD NEARBY',
    unsafe: 'UNSAFE ZONE',
    flooded: 'FLOODED ZONE'
  };

  zones.forEach(z => {
    // GeoJSON polygon coords are [lng, lat], Leaflet uses [lat, lng]
    let latlngs = [];
    if (z.polygon && z.polygon.length > 2) {
      latlngs = z.polygon.map(coord => [coord[1], coord[0]]);
    } else {
      latlngs = generateCircleLatLngs(z.center[1], z.center[0], 2000);
    }

    latlngs.forEach(ll => allLatLngs.push(ll));

    // High-visibility Polygon
    const poly = L.polygon(latlngs, {
      color: z.color,
      weight: 3.5,
      opacity: 1.0,
      fillColor: z.color,
      fillOpacity: overlayOpacity
    });

    const isLocked = z.is_locked_15_days === true || z.is_locked_15_days === 'true';
    const typeBadges = {
      safe: '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">1. GREEN — SAFE ZONE</span>',
      nearby: '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">2. YELLOW — FLOOD NEARBY</span>',
      unsafe: '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-400 border border-orange-800">3. ORANGE — UNSAFE ZONE</span>',
      flooded: '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">4. RED — FLOODED ZONE</span>'
    };

    const popupContent = `
      <div class="space-y-2 p-1 max-w-[280px]">
        <div>${typeBadges[z.type] || ''}</div>
        <h3 class="text-xs font-bold text-white">${z.name}</h3>
        <p class="text-[11px] text-slate-300 leading-snug">${z.description || ''}</p>
        
        <div class="grid grid-cols-2 gap-1.5 text-[10px] bg-slate-900/90 p-2 rounded-lg border border-slate-700/80">
          <div><strong class="text-slate-400">Water Depth:</strong> <span class="text-cyan-300 font-mono">${z.water_level_m}m</span></div>
          <div><strong class="text-slate-400">Hazard:</strong> <span class="text-amber-300">${z.severity}</span></div>
          <div><strong class="text-slate-400">Roads Cut:</strong> <span class="text-red-300">${z.submerged_roads_km} km</span></div>
          <div><strong class="text-slate-400">Bridges Down:</strong> <span class="text-red-300">${z.damaged_bridges}</span></div>
        </div>

        ${isLocked ? `
          <div class="p-2 rounded-lg bg-red-950/70 border border-red-700 text-[10px] text-red-200">
            <div class="flex items-center gap-1 font-bold text-red-300 mb-0.5">
              <i class="fa-solid fa-lock text-red-400"></i>
              <span>15-DAY MANDATORY RETENTION LOCKED</span>
            </div>
            <p>${z.retention_status_text || 'Active monitoring locked for 15 days.'}</p>
          </div>
        ` : ''}

        <div class="pt-1">
          <button onclick="attemptDismissZone('${z.id}')" class="w-full py-1.5 rounded text-xs font-semibold ${isLocked ? 'bg-red-950 text-red-400 border border-red-800 hover:bg-red-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'} transition flex items-center justify-center gap-1">
            <i class="fa-solid ${isLocked ? 'fa-lock' : 'fa-box-archive'}"></i>
            <span>${isLocked ? 'Archive / Dismiss (Locked)' : 'Archive Zone'}</span>
          </button>
        </div>
      </div>
    `;

    poly.bindPopup(popupContent);
    zonesLayerGroup.addLayer(poly);

    // Floating High-Visibility Center Marker Badge
    const centerLat = z.center[1];
    const centerLng = z.center[0];
    const badgeHtml = `
      <div class="px-2 py-1 rounded-full text-[10px] font-bold text-white shadow-2xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer hover:scale-110 transition border border-white/60" style="background-color: ${z.color};">
        <span class="w-2 h-2 rounded-full bg-white ${z.type === 'flooded' ? 'animate-ping' : ''}"></span>
        <span>${typeLabelsShort[z.type] || 'ZONE'}: ${z.name.split('(')[0].trim()}</span>
      </div>
    `;
    const badgeMarker = L.marker([centerLat, centerLng], {
      icon: L.divIcon({
        className: '',
        html: badgeHtml,
        iconAnchor: [60, 14]
      })
    });
    badgeMarker.bindPopup(popupContent);
    zonesLayerGroup.addLayer(badgeMarker);
  });

  // Automatically zoom & fit all zones on screen on initial load
  if (!hasFittedBoundsOnce && allLatLngs.length > 0) {
    hasFittedBoundsOnce = true;
    map.fitBounds(L.latLngBounds(allLatLngs), { padding: [70, 70], maxZoom: 11 });
  }
}

// Quick Fly-To Zone function
function flyToZone(zoneType) {
  const target = rawZones.find(z => z.type === zoneType);
  if (target) {
    map.flyTo([target.center[1], target.center[0]], 12.5, { duration: 1.2 });
  }
}

function focusAllZones() {
  if (rawZones.length > 0) {
    const latlngs = rawZones.map(z => [z.center[1], z.center[0]]);
    map.fitBounds(L.latLngBounds(latlngs), { padding: [70, 70], maxZoom: 11 });
  }
}

window.flyToZone = flyToZone;
window.focusAllZones = focusAllZones;

function renderFloodProneOnMap(fpAreas) {
  if (!floodProneLayerGroup) return;
  floodProneLayerGroup.clearLayers();

  fpAreas.forEach(fp => {
    let latlngs = [];
    if (fp.polygon && fp.polygon.length > 2) {
      latlngs = fp.polygon.map(coord => [coord[1], coord[0]]);
    } else {
      latlngs = generateCircleLatLngs(fp.coordinates[1], fp.coordinates[0], fp.radius_m || 1500);
    }

    const poly = L.polygon(latlngs, {
      color: '#c084fc',
      weight: 2,
      dashArray: '5, 5',
      fillColor: '#a855f7',
      fillOpacity: 0.28
    });

    const popupContent = `
      <div class="space-y-1.5 p-1 max-w-[260px]">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-700">FLOOD-PRONE MARKED AREA</span>
        <h4 class="text-xs font-bold text-white">${fp.name}</h4>
        <p class="text-[11px] text-slate-300"><strong>Basin:</strong> ${fp.river_basin}</p>
        <p class="text-[11px] text-slate-300"><strong>Risk Level:</strong> ${fp.risk_level}</p>
        <p class="text-[10px] text-slate-400">${fp.notes || 'Identified natural drainage constriction.'}</p>
      </div>
    `;

    poly.bindPopup(popupContent);
    floodProneLayerGroup.addLayer(poly);

    // Warning Pin marker
    const icon = L.divIcon({
      className: '',
      html: `<div class="w-6 h-6 rounded-full bg-purple-600 border-2 border-purple-200 flex items-center justify-center text-white text-[10px] shadow-lg hover:scale-125 transition"><i class="fa-solid fa-triangle-exclamation"></i></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const marker = L.marker([fp.coordinates[1], fp.coordinates[0]], { icon: icon });
    marker.bindPopup(popupContent);
    floodProneLayerGroup.addLayer(marker);
  });
}

function renderSOSMarkersOnMap(reports) {
  if (!sosLayerGroup) return;
  sosLayerGroup.clearLayers();

  reports.forEach(r => {
    if (r.status === 'RESCUED') return;

    const icon = L.divIcon({
      className: '',
      html: `<div class="sos-beacon"><i class="fa-solid fa-tower-broadcast"></i></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([r.latitude, r.longitude], { icon: icon });

    const popupContent = `
      <div class="space-y-2 p-1 max-w-[270px]">
        <div class="flex items-center justify-between">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white animate-pulse">SOS DISTRESS SIGNAL</span>
          <span class="text-[10px] text-slate-400">${r.status}</span>
        </div>
        <h4 class="text-xs font-bold text-white">${r.caller_name} (${r.phone})</h4>
        <p class="text-[11px] text-slate-300"><i class="fa-solid fa-location-dot text-red-400"></i> ${r.location_name}</p>
        <div class="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-700">
          <div><strong>Trapped:</strong> ${r.trapped_count} (${r.children_count} children, ${r.elderly_count} elderly)</div>
          <div><strong>Medical Emergency:</strong> ${r.medical_emergency ? '⚠️ YES' : 'No'}</div>
          <div><strong>Needs:</strong> ${(r.needs || []).join(', ')}</div>
        </div>
        <p class="text-[10px] text-slate-400 italic">"${r.message || ''}"</p>
        ${r.status === 'PENDING' ? `
          <button onclick="dispatchSOS('${r.id}')" class="w-full py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition">
            Dispatch Rescue Team
          </button>
        ` : `
          <button onclick="resolveSOS('${r.id}')" class="w-full py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition">
            Mark as Rescued
          </button>
        `}
      </div>
    `;

    marker.bindPopup(popupContent);
    sosLayerGroup.addLayer(marker);
  });
}

function generateCircleLatLngs(lat, lng, radiusMeters) {
  const points = 32;
  const coords = [];
  const km = radiusMeters / 1000;
  const distanceLat = km / 110.574;
  const distanceLng = km / (111.320 * Math.cos(lat * Math.PI / 180));

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const dLat = distanceLat * Math.sin(theta);
    const dLng = distanceLng * Math.cos(theta);
    coords.push([lat + dLat, lng + dLng]);
  }
  return coords;
}

// ================= 15-DAY RETENTION RULE (Requirement 6) =================
async function attemptDismissZone(zoneId) {
  try {
    const res = await fetch(`/api/zones/${zoneId}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      // 15-Day Rule Block triggered
      open15DayModal(data.detail || "Flooded zone reports cannot be ignored for at least half a month.");
    } else {
      fetchData();
    }
  } catch (err) {
    console.error("Dismiss request error:", err);
  }
}

function open15DayModal(reasonText) {
  document.getElementById('modal-15day-reason').textContent = reasonText;
  document.getElementById('modal-15day-block').classList.remove('hidden');
}

function close15DayModal() {
  document.getElementById('modal-15day-block').classList.add('hidden');
}

function renderWatchlistDrawer() {
  const container = document.getElementById('locked-zones-list');
  const lockedZones = rawZones.filter(z => z.is_locked_15_days);

  if (lockedZones.length === 0) {
    container.innerHTML = `<div class="text-[11px] text-slate-400 italic">No zones currently subject to active 15-day retention.</div>`;
    return;
  }

  container.innerHTML = lockedZones.map(z => `
    <div class="p-3 rounded-xl bg-slate-900/90 border border-red-900/60 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-red-200">${z.name}</span>
        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800 flex items-center gap-1">
          <i class="fa-solid fa-lock text-[9px]"></i> ${z.retention_remaining_days}d ${z.retention_remaining_hours}h left
        </span>
      </div>
      <div class="text-[10px] text-slate-300">
        <div><strong>Flooded Date:</strong> ${new Date(z.flood_date).toLocaleDateString()}</div>
        <div><strong>Water Depth:</strong> ${z.water_level_m}m &bull; <strong>Damaged Bridges:</strong> ${z.damaged_bridges}</div>
      </div>
      <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div class="bg-red-500 h-full rounded-full" style="width: ${Math.max(10, ((15 - z.retention_remaining_days) / 15) * 100)}%"></div>
      </div>
      <div class="flex items-center justify-between text-[10px] text-red-400/90">
        <span>Rule 6 Enforced: Cannot be dismissed</span>
        <button onclick="attemptDismissZone('${z.id}')" class="text-red-400 underline font-mono text-[9px]">Attempt Dismiss</button>
      </div>
    </div>
  `).join('');
}

function toggleWatchlistDrawer() {
  const drawer = document.getElementById('watchlist-drawer');
  drawer.classList.toggle('hidden');
}

// ================= REPORTING SOS SYSTEM (Requirement 7) =================
function openSOSModal() {
  document.getElementById('modal-sos').classList.remove('hidden');
}

function closeSOSModal() {
  document.getElementById('modal-sos').classList.add('hidden');
}

async function submitSOS(e) {
  e.preventDefault();

  const needs = [];
  document.querySelectorAll('input[name="sos_need"]:checked').forEach(c => needs.push(c.value));

  const payload = {
    caller_name: document.getElementById('sos-name').value,
    phone: document.getElementById('sos-phone').value,
    location_name: document.getElementById('sos-location').value,
    latitude: parseFloat(document.getElementById('sos-lat').value),
    longitude: parseFloat(document.getElementById('sos-lng').value),
    trapped_count: parseInt(document.getElementById('sos-trapped').value) || 1,
    children_count: parseInt(document.getElementById('sos-children').value) || 0,
    elderly_count: parseInt(document.getElementById('sos-elderly').value) || 0,
    medical_emergency: document.getElementById('sos-medical').checked,
    urgency: document.getElementById('sos-medical').checked ? 'Critical' : 'High',
    needs: needs,
    message: document.getElementById('sos-message').value
  };

  try {
    const res = await fetch('/api/sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      if (typeof playSOSBeep === 'function') playSOSBeep();
      closeSOSModal();
      document.getElementById('form-sos').reset();
      fetchData();
      map.flyTo([payload.latitude, payload.longitude], 12.5);
    }
  } catch (err) {
    console.error("SOS submission error:", err);
  }
}

async function dispatchSOS(sosId) {
  try {
    await fetch(`/api/sos/${sosId}/dispatch?unit_name=Nepal Army Rescue Boat Bravo&eta_minutes=12`, { method: 'PATCH' });
    fetchData();
  } catch (err) {
    console.error("Dispatch error:", err);
  }
}

async function resolveSOS(sosId) {
  try {
    await fetch(`/api/sos/${sosId}/resolve`, { method: 'PATCH' });
    fetchData();
  } catch (err) {
    console.error("Resolve error:", err);
  }
}

function renderSOSFeed() {
  const container = document.getElementById('sos-feed-list');
  const activeSOS = rawSOS.filter(s => s.status !== 'RESCUED');

  if (activeSOS.length === 0) {
    container.innerHTML = `<div class="text-[11px] text-slate-400 italic">No active distress calls.</div>`;
    return;
  }

  container.innerHTML = activeSOS.map(s => `
    <div class="p-2.5 rounded-xl bg-slate-900 border ${s.status === 'PENDING' ? 'border-red-600/80' : 'border-blue-600/80'} space-y-1.5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-white flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full ${s.status === 'PENDING' ? 'bg-red-500 animate-ping' : 'bg-blue-400'}"></span>
          ${s.caller_name}
        </span>
        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${s.status === 'PENDING' ? 'bg-red-950 text-red-400' : 'bg-blue-950 text-blue-400'}">
          ${s.status}
        </span>
      </div>
      <div class="text-[10px] text-slate-300">
        <div>${s.location_name} &bull; <strong>${s.trapped_count} trapped</strong> ${s.medical_emergency ? '<span class="text-red-400 font-bold">(MEDICAL CRITICAL)</span>' : ''}</div>
      </div>
      <div class="flex gap-2 pt-1">
        ${s.status === 'PENDING' ? `
          <button onclick="dispatchSOS('${s.id}')" class="flex-1 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold transition">
            Dispatch Rescue Boat
          </button>
        ` : `
          <button onclick="resolveSOS('${s.id}')" class="flex-1 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition">
            Confirm Rescued
          </button>
        `}
        <button onclick="map.flyTo([${s.latitude}, ${s.longitude}], 13)" class="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px] hover:text-white">
          <i class="fa-solid fa-crosshairs"></i>
        </button>
      </div>
    </div>
  `).join('');
}

// ================= MARK FLOOD-PRONE AREA TOOL (Requirement 5) =================
function toggleMarkingTool(forceState) {
  isMarkingToolActive = (forceState !== undefined) ? forceState : !isMarkingToolActive;
  const banner = document.getElementById('marking-banner');
  const btn = document.getElementById('btn-mark-mode');

  if (isMarkingToolActive) {
    banner.classList.remove('hidden');
    document.getElementById('map').style.cursor = 'crosshair';
    btn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-slate-900 border border-amber-400 transition flex items-center gap-1.5";
  } else {
    banner.classList.add('hidden');
    document.getElementById('map').style.cursor = '';
    btn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition flex items-center gap-1.5";
  }
}

function handleMapClickForMarking(lat, lng) {
  toggleMarkingTool(false);
  document.getElementById('fp-lat').value = lat.toFixed(4);
  document.getElementById('fp-lng').value = lng.toFixed(4);
  document.getElementById('modal-mark-floodprone').classList.remove('hidden');
}

function closeMarkModal() {
  document.getElementById('modal-mark-floodprone').classList.add('hidden');
}

async function submitFloodProne(e) {
  e.preventDefault();

  const lat = parseFloat(document.getElementById('fp-lat').value);
  const lng = parseFloat(document.getElementById('fp-lng').value);
  const radius = parseFloat(document.getElementById('fp-radius').value) || 1500;

  const payload = {
    name: document.getElementById('fp-name').value,
    river_basin: document.getElementById('fp-basin').value,
    risk_level: document.getElementById('fp-risk').value,
    elevation_m: 1320.0,
    coordinates: [lng, lat],
    radius_m: radius,
    notes: document.getElementById('fp-notes').value
  };

  try {
    const res = await fetch('/api/flood-prone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      closeMarkModal();
      document.getElementById('form-mark-floodprone').reset();
      fetchData();
      map.flyTo([lat, lng], 12);
    }
  } catch (err) {
    console.error("Flood prone marking error:", err);
  }
}
