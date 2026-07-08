import os
import httpx
import time
from collections import deque
from typing import List, Optional
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
    """Dynamically fetch coordinates using Nominatim API."""
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

async def get_nearest_station(lat: float, lon: float) -> dict:
    import json
    import os
    stations_file = os.path.join("data", "stations.json")
    if not os.path.exists(stations_file):
        return None
        
    nearest = None
    min_dist = float('inf')
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
                        if dist < min_dist and props.get("code"):
                            min_dist = dist
                            nearest = {
                                "code": props.get("code"),
                                "name": props.get("name"),
                                "lat": s_lat,
                                "lng": s_lon,
                                "distance_km": dist
                            }
    except Exception as e:
        print(f"[Warning] Error finding nearest station: {e}")
    return nearest


async def search_live_trains(origin_city: str, dest_city: str, date: str, check_only: bool = False) -> Optional[List[TransportOption]]:
    print(f"\n[API Call] Fetching live trains (via IRCTC RapidAPI): {origin_city} -> {dest_city} on {date}...")
    
    # Strip any states from formatted names (e.g. "Lucknow, Uttar Pradesh" -> "Lucknow")
    clean_origin = origin_city.split(",")[0].strip()
    clean_dest = dest_city.split(",")[0].strip()
    
    if check_only:
        return None
        
    origin_code = await get_station_code(clean_origin)
    dest_code = await get_station_code(clean_dest)
    
    nearest_origin = None
    nearest_dest = None
    
    if not origin_code:
        coords = await get_city_coords(clean_origin)
        if coords:
            nearest_origin = await get_nearest_station(coords["lat"], coords["lng"])
            if nearest_origin:
                origin_code = nearest_origin["code"]
                
    if not dest_code:
        coords = await get_city_coords(clean_dest)
        if coords:
            nearest_dest = await get_nearest_station(coords["lat"], coords["lng"])
            if nearest_dest:
                dest_code = nearest_dest["code"]

    if not origin_code or not dest_code:
        print(f"[Warning] Could not resolve station codes for {clean_origin} -> {clean_dest}")
        return []
        
    # --- Check DB Cache ---
    options = []
    try:
        conn = await get_db_connection()
        rows = await conn.fetch('SELECT train_num, train_name, dep_time, arr_time, duration_hours, price FROM "Train" WHERE origin = $1 AND dest = $2 AND date = $3', origin_code, dest_code, date)
        await conn.close()
        
        if rows:
            print("[Cache Hit] Returning trains from NeonDB.")
            for idx, r in enumerate(rows):
                options.append(TransportOption(
                    id=f"tr_{r['train_num']}_{idx}_cached",
                    type=TransportType.TRAIN,
                    departure=datetime.fromisoformat(r['dep_time']),
                    arrival=datetime.fromisoformat(r['arr_time']),
                    duration_hours=float(r['duration_hours']),
                    price=float(r['price']),
                    safety_score=8,
                    comfort_score=7,
                    provider=r['train_name']
                ))
    except Exception as e:
        print(f"[Warning] Train DB cache check failed: {e}")
    # --- End DB Cache Check ---
    
    if not options:
            nearest_dest = await get_nearest_station(coords["lat"], coords["lng"])
            if nearest_dest:
                dest_code = nearest_dest["code"]
    
    if not origin_code or not dest_code:
        print(f"[Warning] Could not dynamically map {clean_origin} or {clean_dest} to a station code.")
        return []

    api_key = os.getenv("RAILRADAR_API_KEY")
    if not api_key:
        print("[Warning] No RAILRADAR_API_KEY found in .env.")
        return []

    # 1. Determine station combinations to check (max 3 to avoid rate limit)
    origins = STATION_CLUSTERS.get(clean_origin, [origin_code])
    dests = STATION_CLUSTERS.get(clean_dest, [dest_code])
    
    combinations = []
    for o in origins:
        for d in dests:
            combinations.append((o, d))
            
    # Strictly limit to 3 requests so we don't blow the 10 req/min limit instantly
    combinations = combinations[:3]
    
    options = []
    seen_trains = set()
    
    for (o_code, d_code) in combinations:
        # Enforce Rate Limiting per request
        current_time = time.time()
        while _request_timestamps and current_time - _request_timestamps[0] > 60:
            _request_timestamps.popleft()
            
        if len(_request_timestamps) >= MAX_REQUESTS_PER_MINUTE:
            print("[Warning] Rate limit exceeded (10 req/min) during cluster search. Stopping further fetches.")
            break
            
        _request_timestamps.append(current_time)

        # 2. Fetch from RailRadar
        url = f"https://api.railradar.in/v1/trains/between/{o_code}/{d_code}?date={date}"
        headers = {
            "Authorization": f"Bearer {api_key}"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=15.0)
                response.raise_for_status()
                json_resp = response.json()
                
                if not json_resp.get("success"):
                    continue
                    
                data_obj = json_resp.get("data", {})
                if isinstance(data_obj, list):
                    train_list = data_obj
                else:
                    train_list = data_obj.get("trains", [])
                
                for idx, train_obj in enumerate(train_list):
                    train_info = train_obj.get("train", {})
                    from_info = train_obj.get("from", {})
                    to_info = train_obj.get("to", {})

                    train_num = train_info.get("number", f"T{idx}")
                    train_name = train_info.get("name", f"Train {train_num}")
                    
                    if train_name in seen_trains:
                        continue
                    seen_trains.add(train_name)
                    
                    if len(options) >= 20: # Expanded max limit since we're clustering
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
            print(f"[Warning] RailRadar API connection failed for {o_code}-{d_code}. Using fallback.")
        except Exception as e:
            print(f"[Error] Unexpected error in RailRadar API for {o_code}-{d_code}: {e}")
            
    if not options:
        return []

    # --- Save to DB Cache ---
    try:
        conn = await get_db_connection()
        for opt in options:
            if opt.id.endswith("_cached"): continue
            train_num = opt.id.split("_")[1] if len(opt.id.split("_")) > 1 else "UNK"
            train_id = uuid.uuid4().hex
            await conn.execute('''
                INSERT INTO "Train" (id, train_num, train_name, origin, dest, date, dep_time, arr_time, duration_hours, price)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (train_num, origin, dest, date) DO NOTHING
            ''', train_id, train_num, opt.provider, origin_code, dest_code, date, opt.departure.isoformat(), opt.arrival.isoformat(), opt.duration_hours, opt.price)
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
            
            if nearest_origin:
                # OSRM from origin to nearest station
                o_coords = await get_city_coords(clean_origin)
                fare_data = await calculate_cab_fare(o_coords["lat"], o_coords["lng"], nearest_origin["lat"], nearest_origin["lng"])
                if fare_data["status"] == "success":
                    added_duration += fare_data["duration_hours"]
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
            if nearest_origin:
                opt.departure = opt.departure - timedelta(hours=added_duration) # shift departure back for initial cab ride
        
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
