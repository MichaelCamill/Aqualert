# 🌊 Aqualert: Autonomous Space & Ground Disaster System (v2.2)

> **Multi-Portal Emergency Disaster Command, Thermal Hazard Heatmap & Survivor Lifeline Response Platform**  
> *Zero API Keys Required • Zero User Sign-In Required • 100% Free Open Cartography*

---

## 📌 Overview

**Aqualert** is an operational disaster management and emergency tactical dispatch prototype engineered to coordinate catastrophic flood responses across two demanding hydrological operational theaters:
1. **Urban Coastal Inundation**: Mumbai Monsoon Torrential Flood Corridors (*Hindmata, Dadar TT, Milan Subway, Kurla Mithi Basin, Malabar Hill Safe Haven*).
2. **High-Altitude River Gorges**: Bhote Koshi & Trishuli Torrential Corridors (*Bahrabise, Tatopani, Dhunche, Bidur Relief Depot*).

The platform separates responsibilities across **three distinct interfaces**:
- 🛡️ **[Government Disaster Command Server (`/gov`)](http://127.0.0.1:8000/gov)**: Multi-agency coordination desk for SDMA, NDRF, Police, and Joint Aviation Command. Real-time 100+ survivor triage, 1-click tactical force deployment, continuous thermal flood heatmap, and 1-click official Situation Report (SitRep) generation.
- 🛟 **[Survivor Emergency Lifeline (`/survivor`)](http://127.0.0.1:8000/survivor)**: Mobile-optimized lifeline for stranded citizens with 1-touch SOS broadcasting, 1-time KYC onboarding, automatic geofenced hazard detection, safe haven routing, and 1-click nearby helper alerts.
- 🗺️ **[Citizen / Public Transparency Portal (`/`)](http://127.0.0.1:8000/)**: Public portal featuring interactive flood-prone demarcation, multi-layer GIS switching, and statutory 15-day post-flood retention tracking.

---

## 🚀 How to Run the System

### Prerequisites
- **Operating System**: Windows 10/11, macOS, or Linux.
- **Python**: Python 3.10, 3.11, or 3.12 installed.
- **Browser**: Modern web browser (Edge, Chrome, Firefox, Safari).

### Method 1: 1-Click Batch File (Windows)
Double-click the included batch launcher located in the project root:
```
E:\Hackathon\flood_app\run_app.bat
```

### Method 2: Command Line (PowerShell / Command Prompt / Terminal)
1. Open PowerShell or Terminal and navigate to the application directory:
   ```powershell
   cd E:\Hackathon\flood_app
   ```
2. *(Optional)* Install requirements if running for the first time:
   ```powershell
   pip install fastapi uvicorn
   ```
3. Launch the ASGI server:
   ```powershell
   python -m uvicorn server:app --host 127.0.0.1 --port 8000
   ```
   *Or launch using:*
   ```powershell
   python main.py
   ```
4. Access the portals in your web browser:
   - **Government Command Center**: [http://127.0.0.1:8000/gov](http://127.0.0.1:8000/gov)
   - **Survivor Emergency Lifeline**: [http://127.0.0.1:8000/survivor](http://127.0.0.1:8000/survivor)
   - **Public Citizen Portal**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)

---

## 🌟 Key Capabilities & Features

### 1. 4-Tier Monsoon Hazard Levels (Always-On HUD)
Visualizes waterlogging and inundation severity with a pinned, always-visible map legend:
- 🔴 **Level 4: Critical Flooded Zone (`#DC143C` / `#EF4444`)**: $> 2.5\text{ m}$ inundation, submerged roads, severe current.
- 🟠 **Level 3: Unsafe Zone (`#FF8C00` / `#F97316`)**: $1.0\text{ m} - 2.5\text{ m}$ depth, rapid river swell and embankment erosion.
- 🟡 **Level 2: Flood Nearby / Warning (`#FFD700` / `#F59E0B`)**: $0.3\text{ m} - 1.0\text{ m}$ depth, traffic waterlogging advisory.
- 🟢 **Level 1: Safe Zone (`#32CD32` / `#10B981`)**: $0\text{ m}$ depth, high-ground shelters, helipads, and medical depots.

### 2. Continuous Multi-Stop Thermal Hazard Heatmap
Overlays a GPU-accelerated thermal flood gradient layer over street navigation cartography:
- **0.0 - 0.2**: Transparent outer perimeter fading into Light Lime Green (`rgba(0, 255, 0, 0)` $\to$ `#32CD32`).
- **0.4 - 0.5**: Bright Yellow (`#FFD700`).
- **0.6 - 0.7**: Deep Orange (`#FF8C00`).
- **0.9 - 1.0**: Intense Crimson Red (`#DC143C`) at high-intensity submerged epicenters.
- Fully toggleable via the **Thermal Flood Heatmap** button on the bottom control bar.

### 3. Government Operations Desk (`/gov`)
- **100+ Survivor Live Triage Table**: Searchable, paginated distress list (seeded with 107 records) with status filtering (`PENDING`, `DISPATCHED`, `RESCUED`, `CRITICAL MEDICAL`).
- **"Track on Map" Telemetry**: Instantly flies to survivor GPS coordinates and drops an active pulsing locator beacon.
- **1-Click Tactical Force Deployment**: Immediate dispatch orders for **Helicopter Air-Lift**, **Central Cops (112)**, **Regional Traffic Police**, and **NDRF Rescue Boats**.
- **1-Click Situation Report (SitRep)**: Auto-compiles casualty counts, inundated infrastructure, population at risk, and legal compliance seals into a print/PDF export modal.

### 4. Survivor Lifeline Interface (`/survivor`)
- **1-Touch SOS Transmitter**: Transmits live GPS, trapped headcounts, infant/elderly counts, and medical emergencies to the state operations room with a single tap.
- **1-Time KYC Verification**: Prompts user on first entry for Government ID (Aadhaar / Passport / Voter ID), phone number, location sharing authorization, and emergency contact details.
- **Live Hazard Level Detector**: Automatically calculates distance to flood perimeters and plots safe escape routes to the nearest Level 1 haven (e.g., Malabar Hill Ridge Shelter).
- **1-Click Nearby Helpers**: Direct telephone dialer and alert sender connecting stranded survivors to nearby field police cruisers and local volunteers.

### 5. Rule 6 Compliance: Mandatory 15-Day Retention Lock
- Critical flooded sectors cannot be archived, cleared, or marked dismissed for a statutory minimum of **15 days (half a month)** from flood onset.
- Early dismissal attempts are blocked at the API level with **HTTP 403 Forbidden** safety protocol violations.

---

## 🗺️ Zero-Key Open Cartography Architecture

Aqualert avoids fragile, paid, or token-restricted mapping services in favor of high-availability, open GIS cartography:
1. **Google Streets**: Esri World Street Map (`MapServer/tile/{z}/{y}/{x}`) — vector roads, labels, and arterial transit routes with zero watermarks.
2. **Dark Tactical**: Esri Canvas World Dark Gray Base (`MapServer/tile/{z}/{y}/{x}`) — high-contrast tactical night theme.
3. **3D Topographic Terrain**: Esri World Topo Map — relief elevation, ridgelines, and contours.
4. **Satellite Imagery**: Esri World Imagery — true-color high-resolution Earth observation tiles.

---

## 📑 Technical Documentation & Report

For an in-depth 6-page equivalent engineering report—including the full **System Limitations Section** explaining orbital satellite latency, radar shadowing, optical cloud occlusion, and GNSS drift—view:
- 📄 **[`REPORT.md`](file:///E:/Hackathon/flood_app/REPORT.md)**

---

## 📂 Project Structure

```
flood_app/
├── server.py              # FastAPI asynchronous REST backend
├── main.py                # Standalone Python entrypoint
├── run_app.bat            # Windows 1-click launcher
├── REPORT.md              # 6-page technical report & limitations analysis
├── README.md              # System run instructions & feature documentation
├── data/
│   └── database.json      # Persistent document store (107+ SOS tickets, hazard zones)
└── static/
    ├── gov.html           # Government Command Server UI
    ├── gov.js             # Gov tactical operations & thermal heatmap engine
    ├── survivor.html      # Survivor Emergency Lifeline UI
    ├── survivor.js        # Survivor SOS, KYC, and helper client engine
    ├── index.html         # Public citizen transparency portal UI
    ├── app.js             # Public portal GIS client engine
    ├── style.css          # Glassmorphism styling, layout, and pulse animations
    └── vendor/
        ├── leaflet.css    # Core Leaflet styling
        ├── leaflet.js     # Core Leaflet GIS library
        └── leaflet-heat.js# Hardware-accelerated Canvas thermal heatmap plugin
```

---

## 🔒 Prototype Status

Per written user instruction: **The prototype codebase is frozen and locked. Zero functional or styling modifications will be made without explicit written approval.**
