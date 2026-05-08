#!/usr/bin/env python3
import json
import os
import sys

district_name = os.environ.get("DISTRICT_NAME", "Кольчугинский район")
print(f"Searching for district boundary: {district_name}")

# Проверяем все GeoJSON файлы в текущей директории и поддиректориях
geojson_files = []
for root, dirs, files in os.walk("."):
    for fn in files:
        if fn.endswith(".geojson"):
            geojson_files.append(os.path.join(root, fn))

print(f"Found {len(geojson_files)} GeoJSON files")

found_feature = None
all_names = []
sample_props = None

for gpf in geojson_files:
    try:
        with open(gpf, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        features = []
        if data.get("type") == "Feature":
            features = [data]
        elif data.get("type") == "FeatureCollection":
            features = data.get("features", [])
        
        print(f"Checking {gpf}: {len(features)} features")
        
        for feat in features:
            props = feat.get("properties", {})
            
            # Собираем все возможные имена
            name = None
            for key in ["name", "NAME", "name:ru", "name:en", "official:name", "addr:district", "boundary"]:
                if key in props and isinstance(props[key], str):
                    if name is None:
                        name = props[key]
                    all_names.append(props[key])
            
            if name is None:
                continue
                
            # Проверяем точное совпадение или частичное
            if name == district_name or district_name in name or name in district_name:
                # Дополнительная проверка: это должна быть административная граница
                boundary = props.get("boundary", "")
                admin_level = props.get("admin_level", "")
                
                if boundary == "administrative" and admin_level in ["6", "7"]:
                    found_feature = feat
                    sample_props = props
                    print(f"FOUND: {name} (admin_level={admin_level}) in {gpf}")
                    break
            
            if sample_props is None:
                sample_props = props
                
    except Exception as e:
        print(f"Error reading {gpf}: {e}")
        continue
    
    if found_feature:
        break

if found_feature:
    # Сохраняем найденный район
    output = {
        "type": "FeatureCollection",
        "features": [found_feature]
    }
    with open("district.geojson", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"Successfully saved district boundary to district.geojson")
    sys.exit(0)
else:
    print(f"District '{district_name}' not found")
    print(f"Available names (first 20): {list(set(all_names))[:20]}")
    if sample_props:
        # Показываем только ключи, чтобы не переполнять лог
        print(f"Sample properties keys: {list(sample_props.keys())}")
        # Проверяем, есть ли отношения с нужным уровнем
        print("Tip: Check if admin_level=6 boundaries exist in the data")
    sys.exit(1)
