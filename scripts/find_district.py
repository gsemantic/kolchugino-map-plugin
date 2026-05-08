import json
import sys
import os

district_name = os.environ.get('DISTRICT_NAME', 'Кольчугинский район')

if not os.path.exists('boundary.geojson'):
    print("Error: boundary.geojson not found", file=sys.stderr)
    sys.exit(1)

with open('boundary.geojson', 'r', encoding='utf-8') as f:
    data = json.load(f)

found = False
features = data.get('features', [])
print(f"Found {len(features)} features in GeoJSON", file=sys.stderr)

all_names = []

for feature in features:
    props = feature.get('properties', {})
    
    name_fields = ['name', 'NAME', 'name:ru', 'name:en', 'official:name', 'addr:district', 'boundary']
    
    feature_name = None
    for field in name_fields:
        if field in props and props[field]:
            feature_name = props[field]
            all_names.append(feature_name)
            break
    
    if feature_name:
        print(f"Checking feature: '{feature_name}'", file=sys.stderr)
        
    if feature_name and district_name.lower() in str(feature_name).lower():
        found = True
        with open('district.geojson', 'w', encoding='utf-8') as out:
            json.dump({"type": "FeatureCollection", "features": [feature]}, out, ensure_ascii=False, indent=2)
        print(f"Found district: {feature_name}", file=sys.stderr)
        break

if not found:
    print(f"District '{district_name}' not found in GeoJSON", file=sys.stderr)
    print(f"Available names: {all_names}", file=sys.stderr)
    if features:
        print(f"Sample properties: {json.dumps(features[0].get('properties', {}), ensure_ascii=False)}", file=sys.stderr)
    sys.exit(1)
