import json
import os

merged = {"type": "FeatureCollection", "features": []}

layers_dir = "osm_layers"
if not os.path.exists(layers_dir):
    print(f"Directory {layers_dir} not found")
    json.dump(merged, open("boundary.geojson", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    exit(0)

for fn in os.listdir(layers_dir):
    if fn.endswith(".geojson"):
        filepath = os.path.join(layers_dir, fn)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            if data.get("type") == "FeatureCollection":
                features = data.get("features", [])
                merged["features"].extend(features)
                print(f"Added {len(features)} features from {fn}")
        except Exception as e:
            print(f"Error reading {fn}: {e}")

output_file = "boundary.geojson"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)

print(f"Merged {len(merged['features'])} features into {output_file}")
