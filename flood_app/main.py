import uvicorn
import os
import webbrowser
import threading
import time

def open_browser():
    time.sleep(1.5)
    url = "http://127.0.0.1:8000"
    print(f"\n[Aqualert] Launching emergency response dashboard in default browser at: {url}")
    webbrowser.open(url)

if __name__ == "__main__":
    print("=" * 65)
    print("  AQUALERT: SPACE & GROUND DISASTER INTELLIGENCE SYSTEM")
    print("  Track B & Multi-Zone Crisis Response Prototype")
    print("=" * 65)
    print("✓ 1. Green - Safe Zone (Operational Shelters & Highlands)")
    print("✓ 2. Yellow - Flood Nearby (Approaching Hazard Buffers)")
    print("✓ 3. Orange - Unsafe Zone (Erosion & Severe Swell)")
    print("✓ 4. Red - Flooded Zone (Active Inundation & Debris Flow)")
    print("✓ 5. Interactive Flood-Prone Areas Marking")
    print("✓ 6. Mandatory 15-Day Post-Flood Retention Rule Enforced")
    print("✓ 7. Emergency SOS Dispatch & Reporting System")
    print("✓ 8. Persistent 'Yaad Karlo' Filter Memory System")
    print("✓ 9. 4-Mode Map Engine: Zone / Realistic / 3D / Satellite")
    print("=" * 65)
    print("Starting server on http://127.0.0.1:8000 ...")

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False, log_level="info")
