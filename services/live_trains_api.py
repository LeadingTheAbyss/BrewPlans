import os
import httpx
import time
import re
from collections import deque
from typing import List, Optional, Tuple
from datetime import datetime, timedelta
from dotenv import load_dotenv
from models.entities import TransportOption
from models.enums import TransportType
from services.db import get_db_connection
import uuid

load_dotenv(override=True)

# Rate Limiting Queue for RailRadar (10 requests / minute burst)
_request_timestamps = deque()
MAX_REQUESTS_PER_MINUTE = 9 # Keep it at 9 to be safe

# Fallback Station Cache
_fallback_station_cache: dict[str, str] = {}

# API Key Rotation State
_api_key_usage_count = 0
_current_api_key_index = 0

def get_railradar_api_key() -> Optional[str]:
    global _api_key_usage_count, _current_api_key_index
    
    keys = [
        "RAILRADAR_API_KEY", "RAILRADAR_API_KEY2", "RAILRADAR_API_KEY3",
        "RAILRADAR_API_KEY4", "RAILRADAR_API_KEY5", "RAILRADAR_API_KEY6", "RAILRADAR_API_KEY7", "RAILRADAR_API_KEY8"
    ]
    
    available_keys = [os.getenv(k) for k in keys if os.getenv(k)]
    if not available_keys:
        return None
        
    # Rotate key after 50 calls
    if _api_key_usage_count >= 50:
        _api_key_usage_count = 0
        _current_api_key_index = (_current_api_key_index + 1) % len(available_keys)
        
    if _current_api_key_index >= len(available_keys):
        _current_api_key_index = 0
        
    _api_key_usage_count += 1
    return available_keys[_current_api_key_index]

# Expanded city to station mapping for Indian Railways
CITY_TO_STATION = {
    "Delhi": "NDLS", "New Delhi": "NDLS", "DEL": "NDLS",
    "Mumbai": "CSMT", "BOM": "CSMT",
    "Bangalore": "SBC", "Bengaluru": "SBC", "BLR": "SBC",
    "Chennai": "MAS", "MAA": "MAS",
    "Kolkata": "HWH", "CCU": "HWH",
    "Lucknow": "LKO",
    "Jaipur": "JP", "JAI": "JP",
    "Agra": "AGC",
    "Varanasi": "BSB",
    "Ahmedabad": "ADI", "AMD": "ADI",
    "Pune": "PUNE", "PNQ": "PUNE",
    "Hyderabad": "SC", "HYD": "SC",
    "Chandigarh": "CDG",
    "Amritsar": "ASR",
    "Kochi": "ERS", "Cochin": "ERS",
    "Goa": "MAO",
    "Trivandrum": "TVC",
    "Guwahati": "GHY",
    "Patna": "PNBE",
    "Bhopal": "BPL",
    "Indore": "INDB",
    "Nagpur": "NGP",
    "Kanpur": "CNB",
    "Ludhiana": "LDH",
    "Dehradun": "DDN",
    "Ranchi": "RNC",
    "Bhubaneswar": "BBS",
    "Raipur": "R",
    "Surat": "ST",
    "Vadodara": "BRC",
    "Udaipur": "UDZ",
    "Jodhpur": "JU"
}

# Clustered stations for major cities to fetch more trains
STATION_CLUSTERS = {
    "Delhi": ["NDLS", "ANVT", "DLI"],
    "New Delhi": ["NDLS", "ANVT", "DLI"],
    "Lucknow": ["LKO", "LJN"]
}

async def get_station_code(city_name: str) -> str:
    # First check our fast-path dict
    if city_name in CITY_TO_STATION:
        return CITY_TO_STATION[city_name]
        
    # Attempt dynamic lookup using the Datameet stations JSON
    import json
    import os
    
    stations_file = os.path.join("data", "stations.json")
    
    # Download if not exists
    if not os.path.exists(stations_file):
        try:
            print(f"Downloading stations database for dynamic lookup...")
            async with httpx.AsyncClient() as client:
                res = await client.get("https://raw.githubusercontent.com/datameet/railways/master/stations.json", timeout=10.0)
                res.raise_for_status()
            os.makedirs("data", exist_ok=True)
            with open(stations_file, 'w', encoding='utf-8') as f:
                f.write(res.text)
        except Exception as e:
            print(f"[Warning] Failed to fetch stations JSON: {e}")
            return None
            
    # Load and search
    try:
        with open(stations_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        features = data.get("features", [])
        city_lower = city_name.lower()
        
        for feature in features:
            props = feature.get("properties", {})
            if not props: continue
            name = (props.get("name") or "").lower()
            code = props.get("code")
            
            # If exact match or city name is prominently in the station name
            if city_lower == name or city_lower + " jn" == name or city_lower + " cant" == name:
                return code
                
            # If address contains the city
            address = (props.get("address") or "").lower()
            if city_lower in address and code:
                # We can return the first match
                return code
                
    except Exception as e:
        print(f"[Warning] Error parsing stations JSON: {e}")
        
    return None

import urllib.parse
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

async def get_city_coords(city_name: str) -> dict:
    """Dynamically fetch coordinates using Open-Meteo API, fallback to Nominatim."""
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={urllib.parse.quote(city_name)}&count=15&format=json"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                if "results" in data:
                    for r in data["results"]:
                        if r.get("country") == "India":
                            return {"lat": float(r["latitude"]), "lng": float(r["longitude"])}
    except Exception as e:
        print(f"[Warning] Open-Meteo geocoding failed: {e}")
        
    # Fallback to Nominatim
    encoded_query = urllib.parse.quote(f"{city_name}, India")
    url = f"https://nominatim.openstreetmap.org/search?q={encoded_query}&format=json&limit=1"
    headers = {"User-Agent": "PlanBroTravelApp/1.0 (contact@planbro.com)"}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"])}
    except Exception as e:
        print(f"[Warning] Failed to geocode {city_name}: {e}")
    return {}

async def get_nearest_stations(lat: float, lon: float, limit: int = 3) -> List[dict]:
    import json
    import os
    stations_file = os.path.join("data", "stations.json")
    if not os.path.exists(stations_file):
        return []
        
    stations = []
    try:
        with open(stations_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for feature in data.get("features", []):
                geom = feature.get("geometry", {})
                props = feature.get("properties", {})
                if geom and geom.get("type") == "Point":
                    coords = geom.get("coordinates")
                    if coords and len(coords) == 2:
                        s_lon, s_lat = coords
                        dist = haversine(lat, lon, s_lat, s_lon)
                        if props.get("code"):
                            stations.append({
                                "code": props.get("code"),
                                "name": props.get("name"),
                                "lat": s_lat,
                                "lng": s_lon,
                                "distance_km": dist
                            })
    except Exception as e:
        print(f"[Warning] Error finding nearest stations: {e}")
        
    stations.sort(key=lambda x: x["distance_km"])
    return stations[:limit]

async def get_nearest_station(lat: float, lon: float) -> dict:
    stations = await get_nearest_stations(lat, lon, limit=1)
    return stations[0] if stations else None


async def search_gtfs_trains(origin_code: str, dest_code: str, date: str) -> List[TransportOption]:
    try:
        conn = await get_db_connection()
        req_date = datetime.strptime(date, "%Y-%m-%d")
        req_day_int = req_date.weekday() # Monday=0, Sunday=6
        
        # Check GTFS offline schema
        query = '''
            SELECT t.trip_id, r.long_name, st1.departure_time, st2.arrival_time, st2.day_offset,
                   c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday, c.sunday
            FROM "TransitTrip" t
            JOIN "TransitRoute" r ON t.route_id = r.route_id
            JOIN "TransitCalendar" c ON t.service_id = c.service_id
            JOIN "TransitStopTime" st1 ON t.trip_id = st1.trip_id
            JOIN "TransitStopTime" st2 ON t.trip_id = st2.trip_id
            WHERE st1.stop_id = $1 AND st2.stop_id = $2 
            AND st1.stop_sequence < st2.stop_sequence
        '''
        gtfs_rows = await conn.fetch(query, origin_code, dest_code)
        await conn.close()
        
        if not gtfs_rows: return []
        
        options = []
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        
        for idx, row in enumerate(gtfs_rows):
            # Calculate the exact origin day required to reach the destination on the req_day
            st1_offset = 0 # Simplifying: assuming origin_code is absolute origin for now, or just use 0.
            origin_day_idx = (req_day_int - 0) % 7 
            origin_day_col = days[origin_day_idx]
            
            if row[origin_day_col]:
                dep_hr, dep_min = map(int, row['departure_time'].split(':'))
                arr_hr, arr_min = map(int, row['arrival_time'].split(':'))
                
                dep_time = req_date.replace(hour=dep_hr, minute=dep_min)
                
                arr_time = req_date.replace(hour=arr_hr, minute=arr_min)
                st2_offset = int(row['day_offset'] or 0)
                if st2_offset > 0:
                    arr_time += timedelta(days=st2_offset)
                elif arr_time < dep_time:
                    arr_time += timedelta(days=1)
                    
                duration_hours = (arr_time - dep_time).total_seconds() / 3600.0
                price = round(500 + (duration_hours * 80))
                
                options.append(TransportOption(
                    id=f"tr_gtfs_{idx}",
                    type=TransportType.TRAIN,
                    departure=dep_time,
                    arrival=arr_time,
                    duration_hours=round(duration_hours, 1),
                    price=float(price),
                    safety_score=8,
                    comfort_score=7,
                    provider=row['long_name']
                ))
        return options
    except Exception as e:
        print(f"GTFS Query failed: {e}")
        return []

def get_station_coords_sync(code: str) -> dict:
    import json, os
    stations_file = os.path.join("data", "stations.json")
    if not os.path.exists(stations_file): return {}
    with open(stations_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        for feature in data.get("features", []):
            if feature.get("properties", {}).get("code") == code:
                coords = feature.get("geometry", {}).get("coordinates")
                if coords:
                    return {"lat": coords[1], "lng": coords[0], "name": feature["properties"].get("name", code)}
    return {}

async def search_live_trains(origin: str, destination: str, date: str, check_only: bool = False) -> Optional[List[TransportOption]]:
    """Fetches trains from offline GTFS DB first, then falls back to live RailRadar API."""
    
    # Strip any states from formatted names (e.g. "Lucknow, Uttar Pradesh" -> "Lucknow")
    clean_origin = re.sub(r'[^a-zA-Z0-9\s]', '', origin).strip()
    clean_dest = re.sub(r'[^a-zA-Z0-9\s]', '', destination).strip()

    major_railheads = {
        "leh": ["JAT", "SVDK", "CDG"],
        "ladakh": ["JAT", "SVDK", "CDG"],
        "srinagar": ["SVDK", "JAT", "UHP"],
        "manali": ["CDG", "UMB"],
        "gangtok": ["NJP"],
        "darjeeling": ["NJP"],
        "shimla": ["KLK", "CDG"],
        "ooty": ["CBE"],
        "munnar": ["AWY", "ERN"],
        "mcleodganj": ["PTK", "PTKC"],
        "dharamshala": ["PTK", "PTKC"],
        "spiti": ["CDG", "SML"]
    }

    if check_only:
        return None
    
    if clean_origin.lower() in major_railheads:
        origin_candidates = []
        for c in major_railheads[clean_origin.lower()]:
            c_data = get_station_coords_sync(c)
            origin_candidates.append({"code": c, "name": c_data.get("name", c), "lat": c_data.get("lat", 0), "lng": c_data.get("lng", 0)})
    else:
        origin_code = await get_station_code(clean_origin)
        origin_candidates = [{"code": origin_code, "name": origin}] if origin_code else []

    if clean_dest.lower() in major_railheads:
        dest_candidates = []
        for c in major_railheads[clean_dest.lower()]:
            c_data = get_station_coords_sync(c)
            dest_candidates.append({"code": c, "name": c_data.get("name", c), "lat": c_data.get("lat", 0), "lng": c_data.get("lng", 0)})
    else:
        dest_code = await get_station_code(clean_dest)
        dest_candidates = [{"code": dest_code, "name": destination}] if dest_code else []

    nearest_origin = None
    nearest_dest = None
    
    if not origin_candidates:
        cache_key = clean_origin.lower()
        if cache_key in _fallback_station_cache:
            origin_candidates = [{"code": _fallback_station_cache[cache_key], "from_cache": True}]
        else:
            o_coords = await get_city_coords(clean_origin)
            if o_coords:
                nearest_origins = await get_nearest_stations(o_coords["lat"], o_coords["lng"], limit=3)
                if nearest_origins:
                    origin_candidates = nearest_origins
                
    if not dest_candidates:
        cache_key = clean_dest.lower()
        if cache_key in _fallback_station_cache:
            dest_candidates = [{"code": _fallback_station_cache[cache_key], "from_cache": True}]
        else:
            d_coords = await get_city_coords(clean_dest)
            if d_coords:
                nearest_dests = await get_nearest_stations(d_coords["lat"], d_coords["lng"], limit=3)
                if nearest_dests:
                    dest_candidates = nearest_dests
                    
    if not origin_candidates or not dest_candidates:
        print(f"[Warning] Could not resolve station codes for {clean_origin} -> {clean_dest}")
        return []

    api_key = get_railradar_api_key()
    options = []
    seen_trains = set()
    
    for o_cand in origin_candidates:
        for d_cand in dest_candidates:
            o_code = o_cand["code"]
            d_code = d_cand["code"]
            
            # 1. Try GTFS Offline Database first
            gtfs_results = await search_gtfs_trains(o_code, d_code, date)
            if gtfs_results:
                print(f"[GTFS] Successfully served trains from local offline DB for {o_code}-{d_code}!")
                options.extend(gtfs_results)
                
            # 2. Try DB Cache (Legacy DOW Pattern Matching)
            if not options:
                try:
                    conn = await get_db_connection()
                    rows = await conn.fetch('SELECT train_num, train_name, dep_time, arr_time, duration_hours, price, date FROM "Train" WHERE origin = $1 AND dest = $2', o_code, d_code)
                    await conn.close()
                    
                    if rows:
                        req_date_obj = datetime.strptime(date, "%Y-%m-%d")
                        req_dow = req_date_obj.weekday()
                        valid_cached = []
                        for r in rows:
                            r_date_obj = datetime.strptime(r['date'], "%Y-%m-%d")
                            if r_date_obj.weekday() == req_dow:
                                days_diff = (req_date_obj - r_date_obj).days
                                orig_dep = datetime.fromisoformat(r['dep_time'])
                                orig_arr = datetime.fromisoformat(r['arr_time'])
                                new_dep = orig_dep + timedelta(days=days_diff)
                                new_arr = orig_arr + timedelta(days=days_diff)
                                valid_cached.append({
                                    "train_num": r['train_num'],
                                    "train_name": r['train_name'],
                                    "dep_time": new_dep,
                                    "arr_time": new_arr,
                                    "duration_hours": float(r['duration_hours']),
                                    "price": float(r['price'])
                                })
                                
                        seen_cached = set()
                        unique_cached = []
                        for c in valid_cached:
                            if c["train_num"] not in seen_cached:
                                seen_cached.add(c["train_num"])
                                unique_cached.append(c)
                                
                        if unique_cached:
                            print(f"[Cache Hit] Returning {len(unique_cached)} trains from DB using Day-of-Week pattern match for {o_code}-{d_code}.")
                            for idx, r in enumerate(unique_cached):
                                options.append(TransportOption(
                                    id=f"tr_{r['train_num']}_{idx}_cached",
                                    type=TransportType.TRAIN,
                                    departure=r['dep_time'],
                                    arrival=r['arr_time'],
                                    duration_hours=r['duration_hours'],
                                    price=r['price'],
                                    safety_score=8,
                                    comfort_score=7,
                                    provider=r['train_name']
                                ))
                except Exception as e:
                    print(f"[Warning] Train DB cache check failed: {e}")
                    
            # 3. Fetch from RailRadar if GTFS/Cache failed
            if not options and api_key:
                origins = STATION_CLUSTERS.get(clean_origin, [o_code]) if "from_cache" not in o_cand and "lat" not in o_cand else [o_code]
                dests = STATION_CLUSTERS.get(clean_dest, [d_code]) if "from_cache" not in d_cand and "lat" not in d_cand else [d_code]
                
                combinations = []
                for o in origins:
                    for d in dests:
                        combinations.append((o, d))
                combinations = combinations[:3]
                
                for (curr_o, curr_d) in combinations:
                    current_time = time.time()
                    while _request_timestamps and current_time - _request_timestamps[0] > 60:
                        _request_timestamps.popleft()
                        
                    if len(_request_timestamps) >= MAX_REQUESTS_PER_MINUTE:
                        print("[Warning] Rate limit exceeded (10 req/min). Stopping fetches.")
                        break
                        
                    _request_timestamps.append(current_time)
                    url = f"https://api.railradar.in/v1/trains/between/{curr_o}/{curr_d}?date={date}"
                    headers = {"Authorization": f"Bearer {api_key}"}

                    try:
                        async with httpx.AsyncClient() as client:
                            response = await client.get(url, headers=headers, timeout=15.0)
                            response.raise_for_status()
                            json_resp = response.json()
                            
                            if not json_resp.get("success"):
                                continue
                                
                            data_obj = json_resp.get("data", {})
                            train_list = data_obj if isinstance(data_obj, list) else data_obj.get("trains", [])
                            
                            for idx, train_obj in enumerate(train_list):
                                train_info = train_obj.get("train", {})
                                from_info = train_obj.get("from", {})
                                to_info = train_obj.get("to", {})
                                train_num = train_info.get("number", f"T{idx}")
                                train_name = train_info.get("name", f"Train {train_num}")
                                
                                if train_name in seen_trains:
                                    continue
                                seen_trains.add(train_name)
                                
                                if len(options) >= 20:
                                    break
                                    
                                dep_time_str = from_info.get("departure", "08:00")
                                arr_time_str = to_info.get("arrival", "20:00")
                                
                                try:
                                    base_date = datetime.strptime(date, "%Y-%m-%d")
                                    dep_hour, dep_minute = map(int, dep_time_str.split(":"))
                                    dep_time = base_date.replace(hour=dep_hour, minute=dep_minute)
                                    
                                    arr_hour, arr_minute = map(int, arr_time_str.split(":"))
                                    arr_time = base_date.replace(hour=arr_hour, minute=arr_minute)
                                    
                                    from_day = int(from_info.get("day", 1))
                                    to_day = int(to_info.get("day", 1))
                                    
                                    if to_day > from_day or arr_time < dep_time:
                                        days_diff = max(to_day - from_day, 1)
                                        arr_time += timedelta(days=days_diff)
                                        
                                    duration_hours = (arr_time - dep_time).total_seconds() / 3600.0
                                    api_duration = train_obj.get("duration")
                                    if api_duration:
                                        duration_hours = float(api_duration) / 60.0
                                except Exception:
                                    base_date = datetime.strptime(date, "%Y-%m-%d")
                                    dep_time = base_date.replace(hour=8 + idx)
                                    duration_hours = 14.0
                                    arr_time = dep_time + timedelta(hours=duration_hours)
                                
                                price = round(500 + (duration_hours * 80))
                                options.append(TransportOption(
                                    id=f"tr_{train_num}_{len(options)}",
                                    type=TransportType.TRAIN,
                                    departure=dep_time,
                                    arrival=arr_time,
                                    duration_hours=round(duration_hours, 1),
                                    price=float(price), 
                                    safety_score=8,
                                    comfort_score=7,
                                    provider=train_name
                                ))
                    except httpx.RequestError:
                        print(f"[Warning] RailRadar API failed for {curr_o}-{curr_d}.")
                    except Exception as e:
                        print(f"[Error] Unexpected error in RailRadar API for {curr_o}-{curr_d}: {e}")

            if options:
                # We found trains! Lock in this candidate.
                if "lat" in o_cand:
                    nearest_origin = o_cand
                    _fallback_station_cache[clean_origin.lower()] = o_code
                if "lat" in d_cand:
                    nearest_dest = d_cand
                    _fallback_station_cache[clean_dest.lower()] = d_code
                break # Stop origin candidate loop
                
        if options:
            break # Stop dest candidate loop

    if not options:
        return []

    # --- Save to DB Cache ---
    try:
        conn = await get_db_connection()
        for opt in options:
            if opt.id.endswith("_cached"): continue
            train_num = opt.id.split("_")[1] if len(opt.id.split("_")) > 1 else "UNK"
            train_id = uuid.uuid4().hex
            # Using the actual winning codes
            await conn.execute('''
                INSERT INTO "Train" (id, train_num, train_name, origin, dest, date, dep_time, arr_time, duration_hours, price)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (train_num, origin, dest, date) DO NOTHING
            ''', train_id, train_num, opt.provider, o_code, d_code, date, opt.departure.isoformat(), opt.arrival.isoformat(), opt.duration_hours, opt.price)
        await conn.close()
    except Exception as e:
        print(f"[Warning] Failed to cache trains to DB: {e}")
        
    # --- Post-Process Combo Routes ---
    if nearest_origin or nearest_dest:
        from services.osrm_cab_api import calculate_cab_fare
        
        for opt in options:
            opt.id = f"tr_combo_{opt.id.replace('tr_', '')}"
            added_duration = 0
            added_price = 0
            origin_cab_hours = 0
            
            if nearest_origin:
                # OSRM from origin to nearest station
                o_coords = await get_city_coords(clean_origin)
                fare_data = await calculate_cab_fare(o_coords["lat"], o_coords["lng"], nearest_origin["lat"], nearest_origin["lng"])
                if fare_data["status"] == "success":
                    origin_cab_hours = fare_data["duration_hours"]
                    added_duration += origin_cab_hours
                    added_price += fare_data["fares"].get("sedan", fare_data["distance_km"] * 15)
                opt.provider = f"Cab to {nearest_origin['name']} + {opt.provider}"
                
            if nearest_dest:
                # OSRM from nearest station to dest
                d_coords = await get_city_coords(clean_dest)
                fare_data = await calculate_cab_fare(nearest_dest["lat"], nearest_dest["lng"], d_coords["lat"], d_coords["lng"])
                if fare_data["status"] == "success":
                    added_duration += fare_data["duration_hours"]
                    added_price += fare_data["fares"].get("sedan", fare_data["distance_km"] * 15)
                
                train_leg = opt.provider
                if " + Cab to" in train_leg:
                    train_leg = train_leg.split(" + ")[0]
                train_leg += f" to {nearest_dest['name']}"
                opt.provider = f"{train_leg} + Cab to {clean_dest}"
                
            opt.price_breakdown = {"Train": round(opt.price, 2), "Cab": round(added_price, 2)}
            opt.duration_hours = round(opt.duration_hours + added_duration, 1)
            opt.price = round(opt.price + added_price, 2)
            opt.arrival = opt.arrival + timedelta(hours=added_duration)
            if nearest_origin and origin_cab_hours > 0:
                opt.departure = opt.departure - timedelta(hours=origin_cab_hours)
        
    return sorted(options, key=lambda x: x.price)



async def get_train_route(train_number: str):
    """Fetches the full timetable (stops) of a specific train from RailRadar."""
    api_key = os.getenv("RAILRADAR_API_KEY")
    if not api_key: return {"error": "API key missing"}
    
    url = f"https://api.railradar.in/v1/trains/{train_number}"
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers={"Authorization": f"Bearer {api_key}"}, timeout=10.0)
            return res.json()
    except Exception as e:
        return {"error": str(e)}


async def get_live_train_status(train_number: str, date: str):
    """Fetches the real-time position and delay of a running train."""
    api_key = os.getenv("RAILRADAR_API_KEY")
    if not api_key: return {"error": "API key missing"}
    
    url = f"https://api.railradar.in/v1/trains/{train_number}/live?date={date}"
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers={"Authorization": f"Bearer {api_key}"}, timeout=10.0)
            return res.json()
    except Exception as e:
        return {"error": str(e)}


async def get_station_board(station_code: str):
    """Fetches the live arrivals/departures board for a station in the next 4 hours."""
    api_key = os.getenv("RAILRADAR_API_KEY")
    if not api_key: return {"error": "API key missing"}
    
    # Clean the station code if it's passed as a city name
    code = CITY_TO_STATION.get(station_code, station_code)
    
    url = f"https://api.railradar.in/v1/stations/{code}/trains"
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers={"Authorization": f"Bearer {api_key}"}, timeout=10.0)
            return res.json()
    except Exception as e:
        return {"error": str(e)}
