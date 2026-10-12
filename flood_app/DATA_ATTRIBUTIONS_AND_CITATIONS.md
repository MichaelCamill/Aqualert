# DATA ATTRIBUTIONS, LEGAL FRAMEWORKS & TRAINING-DATASET CITATIONS
## AegisFlood: Autonomous Space & Ground Disaster Intelligence System (v2.2)

---

### 1. Earth Observation Satellite Missions & Remote Sensing Data

#### 1.1 European Space Agency (ESA) — Copernicus Programme
* **Missions Utilized**:
  * **Sentinel-1 (Sentinel-1A & Sentinel-1B)**: C-band Synthetic Aperture Radar (SAR) operating at a center frequency of $5.405\text{ GHz}$. Modes: Interferometric Wide swath (IW), Ground Range Detected (GRD). Used for all-weather, day-and-night surface water delineation and soil moisture backscatter saturation.
  * **Sentinel-2 (Sentinel-2A & Sentinel-2B)**: MultiSpectral Instrument (MSI) acquiring 13 spectral bands from the visible/near-infrared (VNIR) to shortwave infrared (SWIR). Spatial resolutions: $10\text{ m}, 20\text{ m}, 60\text{ m}$. Used for Modified Normalized Difference Water Index (MNDWI), Normalized Difference Moisture Index (NDMI), and pre-/post-flood vegetation damage assessment.
* **Legal Policy & Licensing**:
  * **Legal Basis**: European Commission Delegated Regulation (EU) No 1159/2013 establishing the registration and licensing conditions for GMES/Copernicus users.
  * **License**: *Copernicus Open Access Policy*. Data is distributed free of charge, with worldwide, full, open, and continuous access for operational, scientific, and commercial use.
  * **Mandatory Attribution**: *"Contains modified Copernicus Sentinel data [2016–2026], processed by ESA / Copernicus Emergency Management Service."*

#### 1.2 NASA / USGS Earth Resources Observation and Science (EROS)
* **Missions & Products**:
  * **Landsat 8 & Landsat 9**: Operational Land Imager (OLI) and Thermal Infrared Sensor (TIRS). Bands 1–11 used for multi-decadal baseline hydrology and historical watercourse variation.
  * **Shuttle Radar Topography Mission (SRTM v3.0 / NASADEM)**: 1 arc-second global digital elevation model ($30\text{ m}$ spatial resolution) used for terrain slope, flow accumulation, and watershed perimeter calculation in the Trishuli River basin.
* **Legal Policy & Licensing**:
  * **Legal Basis**: United States Geological Survey (USGS) Free and Open Data Policy (implemented October 2008).
  * **License**: Public Domain (United States Government Work under 17 U.S.C. § 105).
  * **Citation**: U.S. Geological Survey / NASA EROS Data Center, *Shuttle Radar Topography Mission (SRTM) 1 Arc-Second Global*, distributed by USGS EarthExplorer.

#### 1.3 Indian Space Research Organisation (ISRO) & National Remote Sensing Centre (NRSC)
* **Missions & Products**:
  * **Resourcesat-2 / 2A (LISS-IV & AWiFS)**: Advanced Wide Field Sensor data for regional Indian river basin inundation mapping.
  * **Cartosat-1 / Cartosat-2 Digital Elevation Models (CartoDEM)**: High-resolution Indian terrain elevation used for coastal relief profiling across the Mumbai Metropolitan Region (MMR).
* **Legal Policy & Statutory Governance**:
  * **Legal Basis**: National Remote Sensing Data Policy (NRSDP-2011) and Geospatial Data Guidelines (2021) issued by the Department of Science and Technology (DST), Government of India.
  * **Disaster Mandate**: Disaster Management Support Programme (DMSP), under the National Disaster Management Act, 2005.

---

### 2. GIS Cartography, Basemaps & Tile Services

#### 2.1 Environmental Systems Research Institute (Esri)
* **Services Integrated**:
  * **Esri World Street Map**: REST Endpoint: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}`. Provides global vector-derived road navigation, bridges, transit lines, and urban arterial cartography.
  * **Esri Canvas World Dark Gray Base**: REST Endpoint: `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`. High-contrast monochromatic tactical cartography.
  * **Esri World Topo Map**: REST Endpoint: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`. Topographical contours, mountain terrain elevation, and hydrographic drainage networks.
  * **Esri World Imagery**: REST Endpoint: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`. High-resolution orthorectified satellite composite imagery.
* **Source Attributions & Partners**:
  * Esri, HERE, Garmin, Maxar Earthstar Geographics, CNES/Airbus DS, USGS, METI/NASA, USDA FSA, Intermap, INCREMENT P, NRCan, Ordnance Survey, and the GIS User Community.
  * **Legal License**: Esri Master License Agreement (MLA) for public Web GIS tile services via ArcGIS Online Public CDN. Zero API key, public access tier for emergency mapping and web application embedding.

#### 2.2 OpenStreetMap Foundation (OSMF)
* **Datasets Integrated**:
  * Vector street geometry, highway classifications, drainage infrastructure, building footprints, and geographic place names across Mumbai (Maharashtra, India) and Bagmati Province (Nepal).
* **Legal License**:
  * **Data**: Licensed under the **Open Database License (ODbL) v1.0** by the OpenStreetMap Foundation (OSMF).
  * **Cartography / Tiles**: Licensed under Creative Commons Attribution-ShareAlike 2.0 (CC BY-SA 2.0).
  * **Mandatory Attribution**: *© OpenStreetMap contributors*.

---

### 3. Hydro-Meteorological Research, Datasets & Scientific Literature

#### 3.1 Global & Himalayan River Basin Flood Intelligence
1. **Pekel, J.-F., Cottam, A., Gorelick, N., & Belward, A. S. (2016)**. *High-resolution mapping of global surface water and its long-term changes*. **Nature**, 540(7633), 418–422. DOI: `10.1038/nature20584`.
   * *Application*: Used to define the 36-year permanent versus seasonal water extent baseline for the Bhote Koshi and Trishuli rivers.
2. **Lehner, B., Verdin, K., & Jarvis, A. (2008)**. *New global hydrography derived from spaceborne elevation data*. **Eos, Transactions American Geophysical Union**, 89(10), 93–94. DOI: `10.1029/2008EO100001`.
   * *Dataset*: **HydroSHEDS (Hydrological data based on SHuttle Elevation Derivatives at multiple Scales)**. Technical basis for basin drainage direction and river network extraction.
3. **ICIMOD (International Centre for Integrated Mountain Development) (2011, 2020)**. *Glacial Lakes and Glacial Lake Outburst Floods in Nepal*. Research Reports, Kathmandu, Nepal.
   * *Application*: Morphometric parameters, slope thresholds, and debris torrent breach dynamics modeled in the Tatopani–Bahrabise gorge hazard zones.
4. **Alfieri, L., Burek, P., Dutra, E., et al. (2013)**. *GloFAS—global ensemble streamflow forecasting and flood early warning*. **Hydrology and Earth System Sciences**, 17(3), 1161–1175.
   * *Application*: Copernicus Emergency Management Service (CEMS) European Centre for Medium-Range Weather Forecasts (ECMWF) GloFAS hydrograph reference.

#### 3.2 Mumbai Monsoon Inundation & Urban Drainage Research
1. **Chitale, M. A. et al. (2006)**. *Fact Finding Committee on Mumbai Floods (Chitale Committee Final Report)*. Government of Maharashtra, Mumbai.
   * *Application*: Identification of chronic high-tide/monsoon drainage bottlenecks: Hindmata junction, Dadar TT underpass, Milan Subway (Santacruz), and the Mithi River Kurla Kamani bottleneck.
2. **Zope, P. E., Eldho, T. I., & Jothiprakash, V. (2016)**. *Impacts of urbanization on flooding of a coastal urban catchment: Investigation in Mumbai, India*. **Natural Hazards**, 75(1), 887–908. DOI: `10.1007/s11069-014-1352-7`.
   * *Application*: Runoff coefficient modeling and depth thresholds ($0.3\text{ m}, 1.0\text{ m}, 2.5\text{ m}$) adopted in the AegisFlood 4-tier hazard matrix.
3. **Municipal Corporation of Greater Mumbai (MCGM / BMC)**. *Monsoon Disaster Management Plan (MDMP 2023–2026)*. Disaster Management Department, Emergency Operations Centre (EOC), Mumbai.
   * *Application*: Standard operating procedures for traffic subway closures, NDRF stationing, and de-watering pump deployment matrices.

---

### 4. Software Libraries, Open-Source Frameworks & Algorithms

| Software / Component | Author / Maintainer | Version | License | Primary Function |
|---|---|---|---|---|
| **FastAPI** | Sebastián Ramírez | 0.110+ | MIT License | Asynchronous ASGI REST API pipeline & response serialization |
| **Uvicorn** | Encode OSS / Tom Christie | 0.28+ | BSD 3-Clause | Lightning-fast ASGI production web server |
| **Leaflet** | Vladimir Agafonkin | 1.9.4 | BSD 2-Clause | Client-side interactive cartography and slippy map renderer |
| **Leaflet.heat / simpleheat** | Vladimir Agafonkin | 0.2.0 | BSD 2-Clause | Hardware-accelerated Canvas Gaussian kernel density estimation (Thermal Heatmap) |
| **Tailwind CSS** | Tailwind Labs Inc. | 3.4+ | MIT License | Utility-first responsive UI and glassmorphism styling |
| **Font Awesome Free** | Fonticons, Inc. | 6.5.1 | SIL OFL 1.1 / MIT / CC BY 4.0 | Tactical operational vector icons |
| **Python Standard Library** | Python Software Foundation | 3.12 | PSF License | JSON document persistence, asynchronous networking, math kernels |

---

### 5. Legal, Regulatory & Statutory Disaster Frameworks

#### 5.1 Rule 6: Mandatory 15-Day Post-Flood Retention Lock
* **Statutory Framework**: Formulated in alignment with Section 30 & Section 34 of the **Disaster Management Act, 2005 (Act No. 53 of 2005, Government of India)** and State Disaster Management Authority (SDMA) operational mandates:
  * Prohibits administrative premature dismissal, de-escalation, or archival of severe inundation zones (Level 4 Critical Flooded) within **15 calendar days** of flood onset.
  * Ensures compliance with mandatory health and structural safety intervals: floodwater recession monitoring, structural foundation integrity inspections, and prevention of waterborne epidemic outbreaks (leptospirosis, cholera).
  * Systematically enforced in software by returning an **HTTP 403 Forbidden** safety protocol rejection upon early dismissal attempts.

#### 5.2 Survivor Data Governance & Privacy in Emergencies
* **Statutory Frameworks**:
  * **Digital Personal Data Protection Act, 2023 (DPDP Act, Government of India)**: Section 7(c) (*Processing of personal data for responding to any medical emergency involving a threat to the life or immediate threat to the health of the data principal or any other individual*) and Section 7(d) (*Processing of personal data for taking measures to provide medical treatment or health services to any individual during an epidemic, outbreak of disease, or any other threat to public health or disaster*).
  * **General Data Protection Regulation (GDPR - EU 2016/679)**: Article 6(1)(d) (*Processing is necessary in order to protect the vital interests of the data subject or of another natural person*) and Article 9(2)(c).
* **Operational Scope**: One-time KYC onboarding (Government ID, primary phone, GPS coordinates, and trapped headcounts) is strictly partitioned for authorized government search-and-rescue teams (NDRF, Police, Armed Forces Air Command) with client-side credential storage and zero commercial data brokering.

---

### 6. Formal Citation Style (BibTeX Format)

```bibtex
@article{pekel2016high,
  title={High-resolution mapping of global surface water and its long-term changes},
  author={Pekel, Jean-Fran{\c{c}}ois and Cottam, Andrew and Gorelick, Noel and Belward, Alan S},
  journal={Nature},
  volume={540},
  number={7633},
  pages={418--422},
  year={2016},
  publisher={Nature Publishing Group},
  doi={10.1038/nature20584}
}

@article{zope2016impacts,
  title={Impacts of urbanization on flooding of a coastal urban catchment: Investigation in Mumbai, India},
  author={Zope, PE and Eldho, TI and Jothiprakash, V},
  journal={Natural Hazards},
  volume={75},
  number={1},
  pages={887--908},
  year={2016},
  publisher={Springer},
  doi={10.1007/s11069-014-1352-7}
}

@techreport{copernicus2013regulation,
  title={Commission Delegated Regulation (EU) No 1159/2013 establishing registration and licensing conditions for GMES users},
  author={{European Commission}},
  year={2013},
  institution={Official Journal of the European Union},
  url={https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32013R1159}
}

@misc{esri2026worldstreetmap,
  title={ArcGIS World Street Map and World Imagery MapServer Tiles},
  author={{Environmental Systems Research Institute (Esri)}},
  year={2026},
  howpublished={\url{https://server.arcgisonline.com/ArcGIS/rest/services/}},
  note={Attribution: Esri, Maxar, Earthstar Geographics, OpenStreetMap contributors}
}

@manual{ndma2008floods,
  title={National Disaster Management Guidelines: Management of Floods},
  author={{National Disaster Management Authority (NDMA)}},
  organization={Government of India},
  address={New Delhi},
  year={2008}
}
```
