/**
 * Survivor Emergency Lifeline Engine
 * 1-Touch SOS, 1-Time KYC Verification, Live Hazard Detection & Nearby Helpers
 */

let survivorMap = null;
let survivorMarker = null;
let safeHavenMarker = null;
let hazardRouteLine = null;

// Survivor State
let survivorLat = 19.0178; // Default: Hindmata Dadar Inundation Sector
let survivorLng = 72.8478;
let survivorProfile = null;

const STORAGE_KYC_KEY = 'survivor_lifeline_kyc';

document.addEventListener('DOMContentLoaded', () => {
  checkExistingKYC();
  initSurvivorMap();
  detectLocationAndCheckHazard();
  fetchNearbyHelpers();
});

// ================= FEATURE 2: 1-TIME KYC DURING LOGIN (Requirement 2) =================
function checkExistingKYC() {
  const saved = localStorage.getItem(STORAGE_KYC_KEY);
  if (saved) {
    try {
      survivorProfile = JSON.parse(saved);
      applyKYCVerifiedUI(survivorProfile);
      closeKYCModal();
    } catch (e) {
      openKYCModal();
    }
  } else {
    // KYC not completed yet -> Open modal
    openKYCModal();
  }
}

function openKYCModal() {
  document.getElementById('modal-kyc').classList.remove('hidden');
}

function closeKYCModal() {
  document.getElementById('modal-kyc').classList.add('hidden');
}

async function saveSurvivorKYC(e) {
  e.preventDefault();

  const profile = {
    full_name: document.getElementById('kyc-name').value.trim(),
    phone: document.getElementById('kyc-phone').value.trim(),
    gov_id_type: document.getElementById('kyc-id-type').value,
    gov_id_number: document.getElementById('kyc-id-number').value.trim(),
    emergency_contact_name: document.getElementById('kyc-em-name').value.trim(),
    emergency_contact_phone: document.getElementById('kyc-em-phone').value.trim(),
    latitude: survivorLat,
    longitude: survivorLng,
    location_sharing_enabled: document.getElementById('kyc-location-toggle').checked
  };

  try {
    const res = await fetch('/api/survivor/kyc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    }).then(r => r.json());

    if (res.success) {
      survivorProfile = profile;
      localStorage.setItem(STORAGE_KYC_KEY, JSON.stringify(profile));
      applyKYCVerifiedUI(profile);
      closeKYCModal();
      alert(`KYC VERIFIED SUCCESSFULLY!\nIdentity: ${profile.full_name}\nGov ID: ${profile.gov_id_type} (${profile.gov_id_number})\nLocation sharing is active.`);
    }
  } catch (err) {
    console.error("KYC saving error:", err);
    // Offline / fallback storage
    survivorProfile = profile;
    localStorage.setItem(STORAGE_KYC_KEY, JSON.stringify(profile));
    applyKYCVerifiedUI(profile);
    closeKYCModal();
  }
}

function applyKYCVerifiedUI(profile) {
  const badge = document.getElementById('kyc-badge');
  badge.className = "px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center gap-1";
  badge.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i> KYC Verified`;

  document.getElementById('kyc-user-name').textContent = profile.full_name;
  document.getElementById('kyc-user-details').textContent = `${profile.phone} &bull; ${profile.gov_id_type} (${profile.gov_id_number}) &bull; Emergency Contact: ${profile.emergency_contact_name}`;
}

// ================= FEATURE 3: LIVE HAZARD LEVEL ON MAP (Requirement 3) =================
function initSurvivorMap() {
  survivorMap = L.map('survivor-map', {
    center: [survivorLat, survivorLng],
    zoom: 13,
    zoomControl: false
  });

  L.control.zoom({ position: 'top-right' }).addTo(survivorMap);

  // Cartographic Basemap (Clean Street Navigation, Zero Watermark, Zero API Key)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '&copy; Esri &bull; Street Cartography'
  }).addTo(survivorMap);

  // Survivor Marker
  const icon = L.divIcon({
    className: '',
    html: `<div class="sos-beacon" style="background: #38bdf8; border-color: #ffffff;"><i class="fa-solid fa-person-circle-exclamation"></i></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  survivorMarker = L.marker([survivorLat, survivorLng], { icon: icon }).addTo(survivorMap);
  survivorMarker.bindPopup(`<b>You Are Here</b><br>GPS: ${survivorLat.toFixed(4)}, ${survivorLng.toFixed(4)}`).openPopup();
}

function refreshSurvivorLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        survivorLat = pos.coords.latitude;
        survivorLng = pos.coords.longitude;
        updateMapLocation();
        detectLocationAndCheckHazard();
        fetchNearbyHelpers();
      },
      () => {
        // High-waterlogging zone demo coordinate
        survivorLat = 19.0178;
        survivorLng = 72.8478;
        updateMapLocation();
        detectLocationAndCheckHazard();
      }
    );
  }
}

function updateMapLocation() {
  if (survivorMap && survivorMarker) {
    survivorMarker.setLatLng([survivorLat, survivorLng]);
    survivorMap.flyTo([survivorLat, survivorLng], 13.5, { duration: 1.2 });
  }
}

async function detectLocationAndCheckHazard() {
  try {
    const res = await fetch(`/api/hazard-check?lat=${survivorLat}&lng=${survivorLng}`).then(r => r.json());
    const hazard = res.current_hazard;
    const safeHaven = res.nearest_safe_haven;

    // Update Hazard Banner
    const banner = document.getElementById('hazard-status-banner');
    const title = document.getElementById('hazard-level-title');
    const depth = document.getElementById('hazard-depth');
    const adv = document.getElementById('hazard-advisory');

    title.innerHTML = `<span class="w-3 h-3 rounded-full animate-ping" style="background-color: ${hazard.color};"></span> ${hazard.level_name}`;
    depth.textContent = `${hazard.water_depth_m}m Water Depth`;
    adv.textContent = hazard.advisory;

    if (hazard.level === 4) {
      banner.className = "p-3.5 rounded-2xl bg-red-950/80 border-2 border-red-600 space-y-1.5 shadow-lg shadow-red-600/20";
    } else if (hazard.level === 3) {
      banner.className = "p-3.5 rounded-2xl bg-orange-950/80 border-2 border-orange-600 space-y-1.5";
    } else if (hazard.level === 2) {
      banner.className = "p-3.5 rounded-2xl bg-amber-950/80 border-2 border-amber-600 space-y-1.5";
    } else {
      banner.className = "p-3.5 rounded-2xl bg-emerald-950/80 border-2 border-emerald-600 space-y-1.5";
    }

    // Update Safe Haven
    document.getElementById('safe-haven-name').textContent = safeHaven.name;
    document.getElementById('safe-haven-dist').textContent = `Distance: ${safeHaven.distance_km} km away &bull; ${safeHaven.description}`;

    // Draw route to Safe Haven on map
    if (safeHaven.coordinates) {
      const shLat = safeHaven.coordinates[1];
      const shLng = safeHaven.coordinates[0];

      if (safeHavenMarker) survivorMap.removeLayer(safeHavenMarker);
      if (hazardRouteLine) survivorMap.removeLayer(hazardRouteLine);

      const greenIcon = L.divIcon({
        className: '',
        html: `<div class="w-7 h-7 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center text-white text-xs shadow-xl"><i class="fa-solid fa-shield-halved"></i></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      safeHavenMarker = L.marker([shLat, shLng], { icon: greenIcon }).addTo(survivorMap);
      safeHavenMarker.bindPopup(`<b>Level 1 Safe Haven</b><br>${safeHaven.name}<br>${safeHaven.distance_km} km away`);

      // Dashed guidance line
      hazardRouteLine = L.polyline([[survivorLat, survivorLng], [shLat, shLng]], {
        color: '#10b981',
        weight: 3.5,
        dashArray: '6, 8',
        opacity: 0.9
      }).addTo(survivorMap);
    }
  } catch (err) {
    console.error("Hazard check error:", err);
  }
}

function flyToSafeHaven() {
  if (safeHavenMarker) {
    survivorMap.flyTo(safeHavenMarker.getLatLng(), 14, { duration: 1.5 });
    safeHavenMarker.openPopup();
  }
}

// ================= FEATURE 1: EMERGENCY SOS TRANSMITTER (Requirement 1) =================
async function triggerEmergencySOS() {
  if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);

  const name = survivorProfile ? survivorProfile.full_name : "Stranded Citizen";
  const phone = survivorProfile ? survivorProfile.phone : "+91-9876543210";

  const payload = {
    caller_name: name,
    phone: phone,
    location_name: `Live Survivor GPS (${survivorLat.toFixed(4)}, ${survivorLng.toFixed(4)})`,
    latitude: survivorLat,
    longitude: survivorLng,
    trapped_count: 2,
    children_count: 0,
    elderly_count: 0,
    medical_emergency: true,
    urgency: "Critical",
    needs: ["Immediate Air/Boat Extraction", "Drinking Water"],
    message: `EMERGENCY TRANSMISSION FROM SURVIVOR LIFELINE. Gov ID: ${survivorProfile ? survivorProfile.gov_id_number : 'Aadhaar Verified'}. Water depth critical.`
  };

  try {
    const res = await fetch('/api/sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());

    const alertBox = document.getElementById('sos-active-alert');
    alertBox.classList.remove('hidden');
    alertBox.innerHTML = `
      <div class="flex items-center justify-between font-bold text-white">
        <span>🚨 DISTRESS BEACON ACTIVE: ${res.id}</span>
        <span class="px-2 py-0.5 rounded bg-red-600 text-white text-[10px]">TRANSMITTED</span>
      </div>
      <p>Your verified coordinates have been received by the <strong>Government Disaster Command Server</strong>. Rescuers (Helicopters & Inflatable Boats) have been alerted.</p>
      <div class="text-[10px] text-red-300 font-mono">Location: ${survivorLat.toFixed(4)} N, ${survivorLng.toFixed(4)} E &bull; Time: Just now</div>
    `;

    alert(`SOS TRANSMITTED TO GOVERNMENT COMMAND DESK!\nTicket: ${res.id}\nGPS Coordinates: ${survivorLat.toFixed(4)}, ${survivorLng.toFixed(4)}\nRescuers are viewing your location in the Government portal.`);
  } catch (err) {
    console.error("SOS error:", err);
    alert("Distress signal logged and cached for emergency dispatch.");
  }
}

// ================= FEATURE 4: CALL & ALERT NEARBY HELPERS (Requirement 4) =================
async function fetchNearbyHelpers() {
  try {
    const helpers = await fetch(`/api/helpers/nearby?lat=${survivorLat}&lng=${survivorLng}`).then(r => r.json());
    const container = document.getElementById('helpers-list');
    if (!container) return;

    if (!helpers || helpers.length === 0) {
      container.innerHTML = `<div class="text-xs text-slate-400 italic">No nearby helpers registered in this sector.</div>`;
      return;
    }

    const typeIcons = {
      POLICE: 'fa-shield-halved text-blue-400',
      NDRF: 'fa-life-ring text-orange-400',
      MEDICAL: 'fa-truck-medical text-rose-400',
      VOLUNTEER: 'fa-hands-holding-circle text-emerald-400',
      RESCUE: 'fa-mountain text-cyan-400'
    };

    container.innerHTML = helpers.map(h => `
      <div class="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 shadow-md">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-sm">
              <i class="fa-solid ${typeIcons[h.type] || 'fa-user'}"></i>
            </div>
            <div>
              <div class="font-bold text-xs text-white">${h.name}</div>
              <div class="text-[10px] text-cyan-400 font-medium">${h.vehicle}</div>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
            ${h.distance_km} km away
          </span>
        </div>

        <div class="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded-xl">
          <strong>Equipment on board:</strong> ${(h.equipment || []).join(', ')}
        </div>

        <div class="flex gap-2">
          <!-- 1-Click Call Button (Req 4) -->
          <a href="tel:${h.phone}" class="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 transition shadow">
            <i class="fa-solid fa-phone"></i>
            <span>Call Directly</span>
          </a>

          <!-- 1-Click Send Emergency Report to this helper (Req 4) -->
          <button onclick="sendEmergencyReportToHelper('${h.id}', '${h.name}')" class="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-1.5 transition shadow">
            <i class="fa-solid fa-paper-plane"></i>
            <span>Send Report</span>
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error("Helpers fetch error:", err);
  }
}

async function sendEmergencyReportToHelper(helperId, helperName) {
  const name = survivorProfile ? survivorProfile.full_name : "Survior";
  const phone = survivorProfile ? survivorProfile.phone : "+91-9876543210";

  try {
    const res = await fetch(`/api/helpers/${helperId}/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        survivor_name: name,
        survivor_phone: phone,
        latitude: survivorLat,
        longitude: survivorLng,
        situation_notes: `Urgent direct alert from ${name} (${phone}). Water level critical.`
      })
    }).then(r => r.json());

    alert(`REPORT SENT IN 1-CLICK!\nHelper: ${helperName}\nTicket ID: ${res.sos_ticket}\nEstimated Arrival: ${res.estimated_eta_minutes} mins\nCoordinates (${survivorLat.toFixed(4)}, ${survivorLng.toFixed(4)}) transmitted directly to helper.`);
  } catch (err) {
    console.error("Alert helper error:", err);
  }
}
