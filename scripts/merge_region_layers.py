import json
import os

merged = {"type": "FeatureCollection", "features": []}

for fn in os.listdir("region_layers"):
    if fn.endswith(".geojson"):
        filepath = os.path.join("region_layers", fn)
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            features = data.get("features", [])
            merged["features"].extend(features)
            print(f"Added {len(features)} features from {fn}")

with open("region_combined.geojson", "w", encoding="utf-8") as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)

print(f"Merged {len(merged['features'])} features into region_combined.geojson")
