/**
 * Government Disaster Command Server Engine
 * Powers State/NDRF Command Center, 100s Survivor Tracking & 1-Click Operations
 */

// Global State
let govMap = null;
let currentCity = 'mumbai'; // 'mumbai' or 'nepal'
let govZonesGroup = null;
let govSurvivorsGroup = null;

let allGovZones = [];
let allGovContacts = [];
let survPage = 1;
const survPageSize = 15;
let survFilterStatus = 'ALL';
let survSearchQuery = '';

// Center Coordinates
const CITIES = {
  mumbai: { center: [19.0400, 72.8500], zoom: 12 },
  nepal: { center: [27.9500, 85.5500], zoom: 10 }
};

document.addEventListener('DOMContentLoaded', () => {
  initGovMap();
  fetchGovData();
  fetchSurvivorsTable();
  fetchContacts();
  generateOneClickSitRep();
});

// ================= SECTION NAVIGATION (Requirement 6) =================
function showSection(sectionId) {
  const sections = ['map', 'survivors', 'reports', 'contacts', 'zones'];
  sections.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    const nav = document.getElementById(`nav-${s}`);
    if (el) el.classList.add('hidden');
    if (nav) nav.classList.remove('tab-active');
  });

  const activeEl = document.getElementById(`section-${sectionId}`);
  const activeNav = document.getElementById(`nav-${sectionId}`);
  if (activeEl) activeEl.classList.remove('hidden');
  if (activeNav) activeNav.classList.add('tab-active');

  // Trigger leaflet redraw if map becomes visible
  if (sectionId === 'map' && govMap) {
    setTimeout(() => govMap.invalidateSize(), 150);
  }
}

function togglePortalDropdown() {
  const dd = document.getElementById('portal-dropdown');
  dd.classList.toggle('hidden');
}

let govHeatmapLayer = null;
let isHeatmapActive = true;
let allSurvivorsList = [];

// Continuous Multi-Stop Hazard Gradient (from prompt)
// 0.0 - 0.2: Transparent / light lime green (rgba(0, 255, 0, 0) to #32CD32)
// 0.4 - 0.5: Bright yellow (#FFD700)
// 0.6 - 0.7: Deep orange (#FF8C00)
// 0.9 - 1.0: Intense crimson red (#DC143C)
const HAZARD_HEATMAP_GRADIENT = {
  0.0: 'rgba(0, 255, 0, 0)',
  0.2: '#32CD32',
  0.4: '#FFD700',
  0.5: '#FFD700',
  0.6: '#FF8C00',
  0.7: '#FF8C00',
  0.9: '#DC143C',
  1.0: '#DC143C'
};

// 4 Fast, Public Basemaps for Gov Command Center (100% Free, Zero Watermark, Zero API Key, Zero Login)
const GOV_BASEMAPS = {
  realistic: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '&copy; Esri &bull; Clean Street Navigation & Transport Map'
  }),
  zone: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: '&copy; Esri &bull; High-Contrast Tactical Dark GIS'
  }),
  '3d': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: '&copy; Esri Topographical 3D Terrain'
  }),
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: '&copy; Esri, Maxar Earthstar Geographics'
  })
};

let currentGovBaseLayer = null;

// ================= MAP INITIALIZATION (Requirements 1 & 2) =================
function initGovMap() {
  const container = document.getElementById('gov-map');
  if (!container) return;

  govMap = L.map('gov-map', {
    center: CITIES[currentCity].center,
    zoom: CITIES[currentCity].zoom,
    zoomControl: false
  });

  // Valid Leaflet control positions: 'bottomright' & 'bottomleft' (NO HYPHENS)
  L.control.zoom({ position: 'bottomright' }).addTo(govMap);
  L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(govMap);

  currentGovBaseLayer = GOV_BASEMAPS['realistic'];
  currentGovBaseLayer.addTo(govMap);

  govZonesGroup = L.layerGroup().addTo(govMap);
  govSurvivorsGroup = L.layerGroup().addTo(govMap);

  // Invalidate size immediately and on intervals to guarantee full rendering
  setTimeout(() => { if (govMap) govMap.invalidateSize(); }, 100);
  setTimeout(() => { if (govMap) govMap.invalidateSize(); }, 400);
  window.addEventListener('resize', () => { if (govMap) govMap.invalidateSize(); });
}

function switchGovMapMode(mode) {
  if (currentGovBaseLayer && govMap) {
    govMap.removeLayer(currentGovBaseLayer);
  }
  currentGovBaseLayer = GOV_BASEMAPS[mode] || GOV_BASEMAPS['realistic'];
  if (govMap) {
    currentGovBaseLayer.addTo(govMap);
    currentGovBaseLayer.bringToBack();
  }

  // Update button active state
  ['realistic', 'zone', '3d', 'satellite'].forEach(m => {
    const btn = document.getElementById(`gov-btn-map-${m}`);
    if (btn) {
      if (m === mode) {
        btn.className = 'px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 bg-blue-600 text-white shadow';
      } else {
        btn.className = 'px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 text-slate-400 hover:text-white';
      }
    }
  });
}

// Continuous Thermal Hazard Heatmap Layer (Req 2 & Prompt)
function renderThermalHazardHeatmap(zones, survivors) {
  if (typeof L.heatLayer !== 'function') return;

  const heatPoints = [];

  // 1. Inundation Zones: Core intensity + thermal dispersion plume
  (zones || []).forEach(z => {
    const lat = z.center[1];
    const lng = z.center[0];

    // Map flood depth & category to intensity scale [0.0 to 1.0]
    let coreIntensity = 0.45;
    if (z.type === 'flooded') coreIntensity = 1.0;          // >2.5m Inundation -> Crimson Red
    else if (z.type === 'unsafe') coreIntensity = 0.68;      // 1.0m - 2.5m -> Deep Orange
    else if (z.type === 'nearby') coreIntensity = 0.45;      // 0.3m - 1.0m -> Bright Yellow
    else if (z.type === 'safe') coreIntensity = 0.15;        // 0m Safe Haven -> Light Lime Green

    // Core point
    heatPoints.push([lat, lng, coreIntensity]);

    // Generate radial Gaussian dispersion points for continuous gradient look
    const dispersionRadiusKm = z.type === 'flooded' ? 0.014 : 0.009;
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const dLat = (dispersionRadiusKm * Math.cos(angle)) / 110.574;
      const dLng = (dispersionRadiusKm * Math.sin(angle)) / (111.32 * Math.cos(lat * Math.PI / 180));
      // Mid gradient ring
      heatPoints.push([lat + dLat, lng + dLng, coreIntensity * 0.72]);
      // Outer fading perimeter ring
      heatPoints.push([lat + dLat * 1.7, lng + dLng * 1.7, coreIntensity * 0.28]);
    }

    // Include polygon vertices to shape the flood basin
    if (z.polygon && z.polygon.length > 0) {
      z.polygon.forEach(coord => {
        heatPoints.push([coord[1], coord[0], coreIntensity * 0.85]);
      });
    }
  });

  // 2. Trapped Survivor Distress Clusters
  (survivors || []).forEach(s => {
    if (s.latitude && s.longitude) {
      const survIntensity = s.medical_emergency ? 0.95 : (s.urgency === 'Critical' ? 0.88 : 0.62);
      heatPoints.push([s.latitude, s.longitude, survIntensity]);
    }
  });

  if (govHeatmapLayer && govMap) {
    govMap.removeLayer(govHeatmapLayer);
  }

  govHeatmapLayer = L.heatLayer(heatPoints, {
    radius: 46,
    blur: 32,
    maxZoom: 16,
    max: 1.0,
    minOpacity: 0.38,
    gradient: HAZARD_HEATMAP_GRADIENT
  });

  if (isHeatmapActive && govMap) {
    govHeatmapLayer.addTo(govMap);
  }
}

function toggleGovHeatmap() {
  isHeatmapActive = !isHeatmapActive;
  const btn = document.getElementById('btn-toggle-heatmap');
  if (isHeatmapActive) {
    if (govHeatmapLayer && govMap) govHeatmapLayer.addTo(govMap);
    if (btn) {
      btn.className = "px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-lg shadow-red-600/30 hover:brightness-110 active:scale-95 border border-red-500/50";
    }
  } else {
    if (govHeatmapLayer && govMap) govMap.removeLayer(govHeatmapLayer);
    if (btn) {
      btn.className = "px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 bg-slate-800 text-slate-400 border border-slate-700 hover:text-white";
    }
  }
}

function jumpToCity(city) {
  currentCity = city;
  if (!govMap) return;

  if (city === 'mumbai') {
    const mumbaiPoints = allGovZones.filter(z => z.center[0] < 80.0).map(z => [z.center[1], z.center[0]]);
    if (mumbaiPoints.length > 0) {
      govMap.fitBounds(L.latLngBounds(mumbaiPoints), { padding: [70, 70] });
    } else {
      govMap.flyTo(CITIES.mumbai.center, CITIES.mumbai.zoom, { duration: 1.0 });
    }
  } else {
    const nepalPoints = allGovZones.filter(z => z.center[0] >= 80.0).map(z => [z.center[1], z.center[0]]);
    if (nepalPoints.length > 0) {
      govMap.fitBounds(L.latLngBounds(nepalPoints), { padding: [70, 70] });
    } else {
      govMap.flyTo(CITIES.nepal.center, CITIES.nepal.zoom, { duration: 1.0 });
    }
  }
  setTimeout(() => { if (govMap) govMap.invalidateSize(); }, 200);
}

function fitAllZonesOnGovMap() {
  if (!allGovZones || allGovZones.length === 0 || !govMap) return;
  const allPoints = allGovZones.map(z => [z.center[1], z.center[0]]);
  govMap.fitBounds(L.latLngBounds(allPoints), { padding: [60, 60] });
  setTimeout(() => { if (govMap) govMap.invalidateSize(); }, 200);
}

// ================= FETCH ZONES & RENDER =================
async function fetchGovData() {
  try {
    const [resZones, resSummary] = await Promise.all([
      fetch('/api/zones').then(r => r.json()),
      fetch('/api/summary').then(r => r.json())
    ]);

    allGovZones = resZones;
    renderGovZonesOnMap(allGovZones);
    renderGovZonesRegistry(allGovZones);
    renderThermalHazardHeatmap(allGovZones, allSurvivorsList);

    // Auto-fit bounds to Mumbai Monsoon zones on initial load
    jumpToCity('mumbai');
  } catch (err) {
    console.error("Gov data fetch error:", err);
  }
}

function renderGovZonesOnMap(zones) {
  if (!govZonesGroup) return;
  govZonesGroup.clearLayers();

  const levelBadges = {
    flooded: '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">LEVEL 4: FLOODED ZONE</span>',
    unsafe: '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-600 text-white">LEVEL 3: UNSAFE SWELL</span>',
    nearby: '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black">LEVEL 2: WATERLOGGING WARNING</span>',
    safe: '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">LEVEL 1: SAFE HAVEN</span>'
  };

  zones.forEach(z => {
    let latlngs = [];
    if (z.polygon && z.polygon.length > 2) {
      latlngs = z.polygon.map(coord => [coord[1], coord[0]]);
    } else {
      latlngs = generateCircleLatLngs(z.center[1], z.center[0], 1800);
    }

    const poly = L.polygon(latlngs, {
      color: z.color,
      weight: 3.5,
      opacity: 1.0,
      fillColor: z.color,
      fillOpacity: 0.52
    });

    const popupHtml = `
      <div class="space-y-2 p-1 max-w-[280px]">
        <div>${levelBadges[z.type] || ''}</div>
        <h4 class="text-xs font-bold text-white">${z.name}</h4>
        <p class="text-[11px] text-slate-300">${z.description || ''}</p>
        <div class="grid grid-cols-2 gap-1.5 text-[10px] bg-slate-900/90 p-2 rounded-lg border border-slate-700">
          <div><strong class="text-slate-400">Water Level:</strong> <span class="text-cyan-300 font-mono">${z.water_level_m}m</span></div>
          <div><strong class="text-slate-400">Submerged Roads:</strong> <span class="text-red-300">${z.submerged_roads_km} km</span></div>
          <div><strong class="text-slate-400">Population:</strong> <span class="text-amber-300">${(z.affected_population || 0).toLocaleString()}</span></div>
          <div><strong class="text-slate-400">15-Day Lock:</strong> <span class="text-rose-300">${z.is_locked_15_days ? 'Active' : 'Expired'}</span></div>
        </div>
      </div>
    `;

    poly.bindPopup(popupHtml);
    govZonesGroup.addLayer(poly);

    // Pinned permanent floating badge in center
    const badgeHtml = `
      <div class="px-2 py-0.5 rounded-full text-[10px] font-black text-white shadow-xl border border-white/60 whitespace-nowrap cursor-pointer hover:scale-110 transition flex items-center gap-1" style="background-color: ${z.color}">
        <span class="w-2 h-2 rounded-full bg-white ${z.type === 'flooded' ? 'animate-ping' : ''}"></span>
        <span>${z.name.split('&')[0].trim()} (${z.water_level_m}m)</span>
      </div>
    `;

    const marker = L.marker([z.center[1], z.center[0]], {
      icon: L.divIcon({ className: '', html: badgeHtml, iconAnchor: [60, 12] })
    });
    marker.bindPopup(popupHtml);
    govZonesGroup.addLayer(marker);
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
    coords.push([lat + distanceLat * Math.sin(theta), lng + distanceLng * Math.cos(theta)]);
  }
  return coords;
}

// ================= SURVIVOR REPORTS TABLE (Requirement 5) =================
async function fetchSurvivorsTable() {
  const searchInput = document.getElementById('survivor-search');
  survSearchQuery = searchInput ? searchInput.value : '';

  let url = `/api/survivors?page=${survPage}&page_size=${survPageSize}`;
  if (survSearchQuery) url += `&query=${encodeURIComponent(survSearchQuery)}`;
  if (survFilterStatus === 'PENDING') url += `&status=PENDING`;
  if (survFilterStatus === 'DISPATCHED') url += `&status=DISPATCHED`;
  if (survFilterStatus === 'CRITICAL') url += `&medical_only=true`;

  try {
    const res = await fetch(url).then(r => r.json());
    document.getElementById('surv-page').textContent = res.page;
    document.getElementById('surv-total-pages').textContent = res.total_pages;
    document.getElementById('tab-survivor-count').textContent = res.total;

    allSurvivorsList = res.items || [];
    renderSurvivorsTable(res.items);
    renderSurvivorsOnMap(res.items);
    renderThermalHazardHeatmap(allGovZones, allSurvivorsList);
  } catch (err) {
    console.error("Survivor table error:", err);
  }
}

function renderSurvivorsOnMap(survivors) {
  if (!govSurvivorsGroup || !survivors) return;
  govSurvivorsGroup.clearLayers();

  survivors.forEach(s => {
    if (!s.latitude || !s.longitude) return;

    const isMedical = s.medical_emergency;
    const isDispatched = s.status === 'DISPATCHED';
    const isRescued = s.status === 'RESCUED';

    const color = isRescued ? '#10b981' : (isMedical ? '#ef4444' : (isDispatched ? '#38bdf8' : '#f59e0b'));
    const iconHtml = `
      <div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.6); cursor: pointer;" title="${s.caller_name} (${s.status})">
        <i class="fa-solid ${isMedical ? 'fa-truck-medical' : (isRescued ? 'fa-check' : 'fa-person-burst')}"></i>
      </div>
    `;

    const marker = L.marker([s.latitude, s.longitude], {
      icon: L.divIcon({ className: '', html: iconHtml, iconAnchor: [14, 14] })
    });

    marker.bindPopup(`
      <div class="space-y-1.5 p-1 max-w-[250px]">
        <div class="flex items-center justify-between">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isMedical ? 'bg-red-950 text-red-300' : 'bg-slate-800 text-slate-300'}">${s.status}</span>
          <span class="text-[10px] text-cyan-400 font-mono">${s.id}</span>
        </div>
        <h4 class="text-xs font-bold text-white">${s.caller_name} &bull; ${s.trapped_count} Trapped</h4>
        <p class="text-[11px] text-slate-300">${s.location_name}</p>
        <p class="text-[10px] text-amber-300">${(s.needs || []).join(', ')}</p>
        <div class="pt-1 flex gap-1">
          <button onclick="dispatchTacticalForce('${s.id}', 'ALH Air-Lift Helicopter', '${s.location_name}')" class="flex-1 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-[10px]">
            🚁 Chopper
          </button>
          <button onclick="dispatchTacticalForce('${s.id}', 'NDRF Water Rescue Boat', '${s.location_name}')" class="flex-1 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-[10px]">
            🚤 Boat
          </button>
        </div>
      </div>
    `);

    govSurvivorsGroup.addLayer(marker);
  });
}

function filterSurvivorCategory(category) {
  survFilterStatus = category;
  survPage = 1;
  fetchSurvivorsTable();
}

function changeSurvPage(delta) {
  const cur = survPage + delta;
  if (cur >= 1) {
    survPage = cur;
    fetchSurvivorsTable();
  }
}

function renderSurvivorsTable(reports) {
  const tbody = document.getElementById('survivors-tbody');
  if (!reports || reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">No survivor distress reports found.</td></tr>`;
    return;
  }

  tbody.innerHTML = reports.map(r => `
    <tr class="hover:bg-slate-800/60 transition">
      <td class="p-3.5">
        <div class="font-bold text-white">${r.caller_name}</div>
        <div class="text-[10px] text-cyan-400 font-mono">${r.id} &bull; ${r.phone}</div>
      </td>
      <td class="p-3.5 max-w-[200px]">
        <div class="text-slate-200 font-medium">${r.location_name}</div>
        <div class="text-[10px] text-slate-400 italic truncate">${r.message || ''}</div>
      </td>
      <td class="p-3.5">
        <div class="font-bold ${r.medical_emergency ? 'text-red-400' : 'text-slate-200'}">
          ${r.trapped_count} trapped ${r.medical_emergency ? '⚠️ MEDICAL CRITICAL' : ''}
        </div>
        <div class="text-[10px] text-slate-400">${r.children_count} kids &bull; ${r.elderly_count} elderly</div>
      </td>
      <td class="p-3.5">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
          r.urgency === 'Critical' ? 'bg-red-950 text-red-300 border border-red-800' :
          r.urgency === 'High' ? 'bg-orange-950 text-orange-300 border border-orange-800' :
          'bg-slate-800 text-slate-300'
        }">${r.urgency}</span>
        <div class="text-[10px] text-slate-400 mt-1">${(r.needs || []).join(', ')}</div>
      </td>
      <td class="p-3.5">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
          r.status === 'PENDING' ? 'bg-red-900/60 text-red-300 border border-red-700 animate-pulse' :
          r.status === 'DISPATCHED' ? 'bg-blue-900/60 text-blue-300 border border-blue-700' :
          'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
        }">${r.status}</span>
        ${r.dispatched_unit ? `<div class="text-[9px] text-cyan-400 mt-0.5">${r.dispatched_unit}</div>` : ''}
      </td>
      <td class="p-3.5 text-right space-x-1 whitespace-nowrap">
        <!-- 1. Track on Map Button (Req 5) -->
        <button onclick="trackSurvivorOnMap(${r.latitude}, ${r.longitude}, '${r.id}', '${r.caller_name}')" title="Track Exact GPS Location" class="px-2 py-1 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white font-bold text-[10px] transition inline-flex items-center gap-1">
          <i class="fa-solid fa-location-crosshairs"></i> Track on Map
        </button>

        <!-- 2. Dispatch Chopper / Team -->
        ${r.status === 'PENDING' ? `
          <button onclick="dispatchTacticalForce('${r.id}', 'Disaster Helicopter ALH-4', '${r.location_name}')" class="px-2 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-[10px] transition">
            🚁 Chopper
          </button>
          <button onclick="dispatchTacticalForce('${r.id}', 'NDRF Water Rescue Boat 12', '${r.location_name}')" class="px-2 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-[10px] transition">
            🚤 Boat
          </button>
        ` : `
          <button onclick="markSurvivorRescued('${r.id}')" class="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[10px] transition">
            ✅ Rescued
          </button>
        `}
      </td>
    </tr>
  `).join('');
}

// Track survivor on map
function trackSurvivorOnMap(lat, lng, sosId, name) {
  showSection('map');
  govMap.flyTo([lat, lng], 14, { duration: 1.5 });

  if (govSurvivorsGroup) govSurvivorsGroup.clearLayers();

  const beaconIcon = L.divIcon({
    className: '',
    html: `<div class="sos-beacon" style="width: 38px; height: 38px; font-size: 16px;"><i class="fa-solid fa-person-burst"></i></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19]
  });

  const marker = L.marker([lat, lng], { icon: beaconIcon }).addTo(govSurvivorsGroup);
  marker.bindPopup(`
    <div class="space-y-1.5 p-1">
      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">TARGET SURVIVOR ACQUIRED</span>
      <h4 class="text-xs font-bold text-white">${name} (${sosId})</h4>
      <p class="text-[11px] text-slate-300">GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
      <button onclick="dispatchTacticalForce('${sosId}', 'Helicopter ALH Air Wing', 'Survivor Location')" class="w-full py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold mt-1">
        🚁 Direct Air-Lift Winch Dispatch
      </button>
    </div>
  `).openPopup();
}

async function dispatchTacticalForce(sosId, unitName, location) {
  try {
    await fetch(`/api/survivors/${sosId}/action`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'DISPATCHED',
        assigned_unit: unitName,
        eta_minutes: 12,
        officer_notes: `Tactical force dispatched directly to ${location}`
      })
    });
    fetchSurvivorsTable();
  } catch (err) {
    console.error("Dispatch force error:", err);
  }
}

async function markSurvivorRescued(sosId) {
  try {
    await fetch(`/api/survivors/${sosId}/action`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'RESCUED',
        officer_notes: 'Survivor recovered to safe haven hospital.'
      })
    });
    fetchSurvivorsTable();
  } catch (err) {
    console.error("Rescue confirm error:", err);
  }
}

// ================= 1-CLICK SITUATION REPORT GENERATOR (Requirement 4) =================
async function generateOneClickSitRep() {
  try {
    const report = await fetch('/api/reports/generate').then(r => r.json());
    const container = document.getElementById('sitrep-container');
    if (!container) return;

    container.innerHTML = `
      <!-- Official Header -->
      <div class="flex items-center justify-between border-b border-slate-700 pb-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-400 text-2xl font-black">
            <i class="fa-solid fa-file-contract"></i>
          </div>
          <div>
            <span class="text-[10px] font-mono tracking-widest text-cyan-400 font-bold">${report.classification}</span>
            <h3 class="text-base font-extrabold text-white">${report.report_id} &bull; INCIDENT SITREP</h3>
            <p class="text-[11px] text-slate-400">${report.authorizing_authority} &bull; Generated: ${report.timestamp_formatted}</p>
          </div>
        </div>
        <button onclick="openPrintModal()" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow">
          <i class="fa-solid fa-print"></i> Print / PDF Export
        </button>
      </div>

      <!-- Executive Overview Card -->
      <div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed">
        <strong class="text-white">COMMAND EXECUTIVE BRIEFING:</strong> ${report.executive_summary}
      </div>

      <!-- Key Tactical Metrics Grid -->
      <div class="grid grid-cols-4 gap-3 text-center">
        <div class="p-3 rounded-xl bg-red-950/60 border border-red-800">
          <div class="text-xl font-extrabold text-red-300">${report.hazard_summary.critical_flooded_zones}</div>
          <div class="text-[10px] font-bold text-red-400 uppercase">Flooded Critical Sectors</div>
        </div>
        <div class="p-3 rounded-xl bg-orange-950/60 border border-orange-800">
          <div class="text-xl font-extrabold text-orange-300">${report.survivor_triage.total_trapped_headcount}</div>
          <div class="text-[10px] font-bold text-orange-400 uppercase">Trapped Persons Count</div>
        </div>
        <div class="p-3 rounded-xl bg-rose-950/60 border border-rose-800">
          <div class="text-xl font-extrabold text-rose-300">${report.survivor_triage.critical_medical_cases}</div>
          <div class="text-[10px] font-bold text-rose-400 uppercase">Medical Air-Lift Required</div>
        </div>
        <div class="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800">
          <div class="text-xl font-extrabold text-emerald-300">${report.hazard_summary.designated_safe_havens}</div>
          <div class="text-[10px] font-bold text-emerald-400 uppercase">Secure Safe Havens</div>
        </div>
      </div>

      <!-- Critical Flooded Zones Table -->
      <div>
        <h4 class="text-xs font-bold text-white uppercase tracking-wider mb-2">Critical Inundated Sectors Breakdown</h4>
        <div class="border border-slate-800 rounded-xl overflow-hidden">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-950 text-slate-400 text-[10px] uppercase">
              <tr>
                <th class="p-2.5">Zone Name</th>
                <th class="p-2.5">Water Depth</th>
                <th class="p-2.5">Hazard Level</th>
                <th class="p-2.5">Population at Risk</th>
                <th class="p-2.5">15-Day Retention Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 bg-slate-900/60 text-slate-300">
              ${report.critical_flooded_zones_detail.map(z => `
                <tr>
                  <td class="p-2.5 font-bold text-white">${z.name}</td>
                  <td class="p-2.5 text-cyan-300 font-mono">${z.water_depth_m}m</td>
                  <td class="p-2.5"><span class="px-2 py-0.5 rounded bg-red-950 text-red-300 font-bold text-[10px]">${z.severity}</span></td>
                  <td class="p-2.5">${z.population_at_risk.toLocaleString()}</td>
                  <td class="p-2.5 text-[10px] text-red-400 font-mono">${z['15_day_retention_lock']}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Priority Air-Lift Targets List -->
      <div>
        <h4 class="text-xs font-bold text-white uppercase tracking-wider mb-2">Priority Helicopter / Boat Evacuation Targets</h4>
        <div class="grid grid-cols-2 gap-2 text-xs">
          ${report.urgent_air_lift_targets.map(t => `
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div class="flex items-center justify-between">
                <span class="font-bold text-white">${t.name} (${t.sos_id})</span>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300">${t.trapped} Trapped</span>
              </div>
              <div class="text-[10px] text-slate-400">${t.location} &bull; GPS: ${t.coordinates[0]}, ${t.coordinates[1]}</div>
              <div class="text-[10px] text-amber-300">${(t.needs || []).join(' &bull; ')}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Legal Compliance Seal -->
      <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
        <span>${report.compliance_declaration}</span>
        <span class="font-bold text-cyan-400">STATE COMMAND SEAL VERIFIED</span>
      </div>
    `;
  } catch (err) {
    console.error("Sitrep generation error:", err);
  }
}

function openPrintModal() {
  const sitrepBody = document.getElementById('sitrep-container').innerHTML;
  document.getElementById('modal-sitrep-body').innerHTML = sitrepBody;
  document.getElementById('modal-print-sitrep').classList.remove('hidden');
}

function closeSitRepModal() {
  document.getElementById('modal-print-sitrep').classList.add('hidden');
}

// ================= EMERGENCY CONTACT & DISPATCH HUB (Requirement 4) =================
async function fetchContacts() {
  try {
    const contacts = await fetch('/api/emergency-contacts').then(r => r.json());
    allGovContacts = contacts;
    renderContactsGrid(contacts);
  } catch (err) {
    console.error("Contacts fetch error:", err);
  }
}

function renderContactsGrid(contacts) {
  const container = document.getElementById('contacts-grid');
  if (!container) return;

  const icons = {
    HELICOPTER: 'fa-helicopter text-cyan-400',
    POLICE: 'fa-shield-halved text-blue-400',
    REGIONAL_POLICE: 'fa-car-side text-indigo-400',
    NDRF: 'fa-life-ring text-orange-400'
  };

  container.innerHTML = contacts.map(c => `
    <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center text-lg">
            <i class="fa-solid ${icons[c.category] || 'fa-phone'}"></i>
          </div>
          <div>
            <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400">${c.category}</span>
            <h4 class="text-xs font-bold text-white">${c.title}</h4>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
          ${c.dispatch_status}
        </span>
      </div>

      <div class="space-y-1 text-xs text-slate-300 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
        <div><strong>Commander:</strong> ${c.commander}</div>
        <div><strong>Hotline Direct:</strong> <span class="text-white font-mono font-bold">${c.hotline}</span></div>
        <div><strong>Frequency:</strong> <span class="text-cyan-300 font-mono">${c.frequency_vhf}</span></div>
        <div><strong>Base / Helipad:</strong> ${c.helipad_location || c.location}</div>
      </div>

      <div class="flex gap-2">
        <button onclick="quickDispatchCall('${c.id}')" class="flex-1 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center justify-center gap-1.5 shadow">
          <i class="fa-solid fa-paper-plane"></i>
          <span>1-Click Dispatch Force</span>
        </button>
        <a href="tel:${c.hotline}" class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1">
          <i class="fa-solid fa-phone"></i>
        </a>
      </div>
    </div>
  `).join('');
}

async function quickDispatchCall(contactId) {
  try {
    const res = await fetch(`/api/emergency-contacts/${contactId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incident_id: 'COMMAND-DIRECT-ORDER',
        target_location: 'Central Inundation Sector',
        notes: 'Priority emergency dispatch logged by Officer in Charge.'
      })
    }).then(r => r.json());

    alert(`DISPATCH ORDER TRANSMITTED:\n${res.message}`);
    fetchContacts();
  } catch (err) {
    console.error("Dispatch order error:", err);
  }
}

// ================= ZONES REGISTRY (Requirement 6) =================
function renderGovZonesRegistry(zones) {
  const container = document.getElementById('gov-zones-grid');
  if (!container) return;

  container.innerHTML = zones.map(z => `
    <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-white flex items-center gap-2">
          <span class="w-3 h-3 rounded-full" style="background-color: ${z.color}"></span>
          ${z.name}
        </span>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded" style="background-color: ${z.color}22; color: ${z.color}; border: 1px solid ${z.color}66;">
          ${z.type.toUpperCase()}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2 text-[11px] bg-slate-950 p-2.5 rounded-xl border border-slate-800">
        <div><strong class="text-slate-400">Water Depth:</strong> <span class="text-white font-mono">${z.water_level_m}m</span></div>
        <div><strong class="text-slate-400">Roads Cut:</strong> <span class="text-red-400">${z.submerged_roads_km} km</span></div>
        <div><strong class="text-slate-400">Population:</strong> <span class="text-amber-400">${(z.affected_population || 0).toLocaleString()}</span></div>
        <div><strong class="text-slate-400">Bridges Down:</strong> <span class="text-red-400">${z.damaged_bridges}</span></div>
      </div>

      ${z.is_locked_15_days ? `
        <div class="p-2 rounded-xl bg-red-950/70 border border-red-800 text-[10px] text-red-200">
          <div class="font-bold text-red-300">🔒 RULE 6 COMPLIANCE: 15-DAY LOCK ACTIVE</div>
          <p>${z.retention_status_text}</p>
        </div>
      ` : ''}
    </div>
  `).join('');
}
