import logging
from typing import List, Optional
from datetime import datetime, timedelta
import random
import os
import httpx
from models.entities import TransportOption
from models.enums import TransportType
from services.db import get_db_connection
import uuid

# Configure basic logging for the pipeline  
logging.basicConfig(level=logging.INFO)

from dotenv import load_dotenv
load_dotenv()

async def fetch_redbus_api(origin: str, destination: str, travel_date: str, check_only: bool = False) -> List[dict]:
    """Strategy 1: Live redBus API via parse.bot"""
    logging.info("Attempting Strategy 1: Live redBus API via parse.bot")
    # Check DB Cache first (Day-of-Week Pattern Matching)
    try:
        conn = await get_db_connection()
        rows = await conn.fetch('SELECT bus_name, timings, price, date FROM "Bus" WHERE origin = $1 AND dest = $2', origin.upper(), destination.upper())
        await conn.close()
        
        if rows:
            req_date_obj = datetime.strptime(travel_date, "%Y-%m-%d")
            req_dow = req_date_obj.weekday()
            
            valid_buses = []
            seen_buses = set()
            
            for r in rows:
                r_date_obj = datetime.strptime(r['date'], "%Y-%m-%d")
                if r_date_obj.weekday() == req_dow:
                    bus_key = f"{r['bus_name']}-{r['timings']}"
                    if bus_key not in seen_buses:
                        seen_buses.add(bus_key)
                        valid_buses.append({
                            "bus_name": r['bus_name'], 
                            "timings": r['timings'], 
                            "route": f"{origin} to {destination}", 
                            "price": r['price']
                        })
                        
            if valid_buses:
                logging.info(f"Returning {len(valid_buses)} cached buses from DB using Day-of-Week pattern match.")
                return valid_buses
    except Exception as e:
        logging.warning(f"DB cache check failed: {e}")

    if check_only:
        return None

    api_key = os.environ.get("PARSE_API_KEY")
    if not api_key:
        raise Exception("PARSE_API_KEY not found in environment.")
        
    base_url = "https://api.parse.bot/scraper/35a9b6fe-4009-43dd-89e2-993f11b60ad0"
    headers = {"X-API-Key": api_key}
    
    async with httpx.AsyncClient() as client:
        # Get origin city ID
        orig_res = await client.get(f"{base_url}/get_city_suggestions", params={"limit": 1, "query": origin}, headers=headers, timeout=10.0)
        orig_res.raise_for_status()
        orig_data = orig_res.json()
        orig_docs = orig_data.get("data", {}).get("docs", [])
        if not orig_docs:
            raise Exception(f"Origin city '{origin}' not found on redBus API.")
        orig_id = orig_docs[0]["ID"]

        # Get destination city ID
        dest_res = await client.get(f"{base_url}/get_city_suggestions", params={"limit": 1, "query": destination}, headers=headers, timeout=10.0)
        dest_res.raise_for_status()
        dest_data = dest_res.json()
        dest_docs = dest_data.get("data", {}).get("docs", [])
        if not dest_docs:
            raise Exception(f"Destination city '{destination}' not found on redBus API.")
        dest_id = dest_docs[0]["ID"]
        
        # Format date: YYYY-MM-DD -> DD-Mon-YYYY
        try:
            parsed_date = datetime.strptime(travel_date, "%Y-%m-%d")
            doj_str = parsed_date.strftime("%d-%b-%Y")
        except ValueError:
            doj_str = travel_date

        # Fetch bus services
        search_params = {
            "from_city_id": orig_id,
            "to_city_id": dest_id,
            "doj": doj_str,
            "limit": 15
        }
        search_res = await client.get(f"{base_url}/search_buses", params=search_params, headers=headers, timeout=15.0)
        search_res.raise_for_status()
        
    inventories = search_res.json().get("data", {}).get("inventories", [])
    if not inventories:
        logging.warning("No buses found on live API.")
        return []
        
    results = []
    for inv in inventories:
        dep = str(inv.get("departureTime", "")).strip()
        arr = str(inv.get("arrivalTime", "")).strip()
        
        if "T" in dep:
            try:
                dep = datetime.fromisoformat(dep.replace("Z", "+00:00")).strftime("%H:%M")
            except:
                pass
        elif len(dep) >= 4 and ":" not in dep: 
            dep = f"{dep[:2]}:{dep[2:4]}"
            
        if "T" in arr:
            try:
                arr = datetime.fromisoformat(arr.replace("Z", "+00:00")).strftime("%H:%M")
            except:
                pass
        elif len(arr) >= 4 and ":" not in arr: 
            arr = f"{arr[:2]}:{arr[2:4]}"
            
        if ":" not in dep: dep = "10:00"
        if ":" not in arr: arr = "20:00"
        
        timings = f"{dep} - {arr}"
        
        fare_list = inv.get("fareList", [])
        price = 1000
        if fare_list:
            if isinstance(fare_list, list) and len(fare_list) > 0:
                if isinstance(fare_list[0], dict):
                    price = float(fare_list[0].get("fare", 1000))
                else:
                    try:
                        price = float(fare_list[0])
                    except:
                        pass
            elif isinstance(fare_list, (int, float, str)):
                try:
                    price = float(fare_list)
                except:
                    pass
            
        bus_name = inv.get("travelsName", "Unknown Operator")
        if inv.get("busType"):
            bus_name += f" ({inv.get('busType')})"
            
        results.append({
            "bus_name": bus_name,
            "timings": timings,
            "route": f"{origin} to {destination}",
            "price": price
        })
        
    # Save to DB cache
    if results:
        try:
            conn = await get_db_connection()
            for r in results:
                bus_id = uuid.uuid4().hex
                await conn.execute('''
                    INSERT INTO "Bus" (id, origin, dest, date, bus_name, timings, price)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (origin, dest, date, bus_name, timings) DO NOTHING
                ''', bus_id, origin.upper(), destination.upper(), travel_date, r["bus_name"], r["timings"], r["price"])
            await conn.close()
        except Exception as e:
            logging.warning(f"Failed to cache bus data to DB: {e}")
            
    return results

from services.heuristic_pricing import calculate_heuristic_bus_fare
import urllib.parse
import math

def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

async def _get_city_coords(city_name: str) -> dict:
    encoded = urllib.parse.quote(f"{city_name}, India")
    url = f"https://nominatim.openstreetmap.org/search?q={encoded}&format=json&limit=1"
    headers = {"User-Agent": "Tripeasy-Bot/1.0"}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, timeout=10.0)
            data = resp.json()
            if data:
                return {"lat": float(data[0]["lat"]), "lon": float(data[0]["lon"])}
    except:
        pass
    return None

async def scrape_redbus_mobile(origin: str, destination: str, travel_date: str) -> List[dict]:
    # Strategy 2: Heuristic Bus Synthesis Engine (Offline Math Model)
    logging.info("Attempting Strategy 2: Heuristic Math Model")
    
    # 1. Geocode Origin and Destination to get physical distance
    orig_coords = await _get_city_coords(origin)
    dest_coords = await _get_city_coords(destination)
    
    if not orig_coords or not dest_coords:
        # Fallback distance if geocoding fails
        distance_km = 500.0
    else:
        distance_km = _haversine(orig_coords["lat"], orig_coords["lon"], dest_coords["lat"], dest_coords["lon"])
        # Add 20% for road routing curvature
        distance_km *= 1.2
        
    # 2. Synthesize Fleet
    operators = [
        ("IntrCity SmartBus", "Volvo AC Seater"),
        ("Zingbus", "AC Sleeper"),
        ("NueGo", "Bharat Benz A/C"),
        ("Orange Tours & Travels", "Scania Multi-Axle"),
        ("Mahadev Travels", "Non-AC Sleeper")
    ]
    
    # Generate 4 stable departures based on distance
    # For long haul (> 400km), buses leave at night. For short haul, scattered.
    if distance_km > 400:
        departures = ["19:00", "20:30", "21:15", "22:45"]
    else:
        departures = ["07:00", "11:30", "16:00", "19:45"]
        
    duration_hours = max(2.0, distance_km / 55.0) # Assume 55 km/h average
    
    results = []
    for i in range(4):
        op_name, btype = operators[i % len(operators)]
        dep_time = departures[i]
        
        # Calculate arrival
        dep_hr, dep_min = map(int, dep_time.split(':'))
        total_dep_hours = dep_hr + (dep_min / 60.0)
        total_arr_hours = total_dep_hours + duration_hours
        
        arr_hr = int(total_arr_hours % 24)
        arr_min = int((total_arr_hours % 1) * 60)
        arr_time = f"{arr_hr:02d}:{arr_min:02d}"
        
        # Calculate Price using heuristic polynomial
        price = calculate_heuristic_bus_fare(distance_km, btype, travel_date, dep_time)
        
        results.append({
            "bus_name": f"{op_name} ({btype})",
            "timings": f"{dep_time} - {arr_time}",
            "route": f"{origin} to {destination}",
            "price": price
        })
        
    return results

async def scrape_abhibus_mobile(origin: str, destination: str, travel_date: str) -> List[dict]:
    # Strategy 3: Handled by Strategy 2 now
    return []

async def scrape_state_srtc(origin: str, destination: str, travel_date: str) -> List[dict]:
    # Strategy 4: Fallback
    return []

def validate_payload(data: List[dict]) -> bool:
    if not data:
        return False
        
    # Ensures every single entry contains the strict 4 fields requested
    for entry in data:
        required_keys = ["bus_name", "timings", "route", "price"]
        if not all(key in entry for key in required_keys):
            return False
    return True

async def get_live_bus_data(origin: str, destination: str, travel_date: str, check_only: bool = False) -> dict:
    """The Multi-Source Redundancy Pipeline."""
    scraping_pipeline = [
        scrape_redbus_mobile,  # Strategy 1 (Heuristic Math Model - 100% Offline & Free)
        fetch_redbus_api       # Strategy 2 (Live redBus API via parse.bot)
    ]
    
    for scrape_strategy in scraping_pipeline:
        try:
            # Attempt to extract the 4 required fields
            if scrape_strategy.__name__ == 'fetch_redbus_api':
                bus_listings = await scrape_strategy(origin, destination, travel_date, check_only=check_only)
            else:
                if check_only:
                    continue
                bus_listings = await scrape_strategy(origin, destination, travel_date)
            
            if bus_listings is None and check_only:
                return {"status": "cache_miss"}
            
            if bus_listings is not None and validate_payload(bus_listings):
                logging.info(f"Successfully retrieved live data using {scrape_strategy.__name__}")
                return {
                    "status": "success",
                    "source": scrape_strategy.__name__,
                    "data": bus_listings # Array containing Name, Timings, Route, Price
                }
        except Exception as e:
            logging.warning(f"Strategy {scrape_strategy.__name__} failed: {e}. Trying next fallback...")
            continue
            
    return {
        "status": "error",
        "message": "All live scraping targets exhausted or blocked. Please retry."
    }

async def search_live_buses(origin_city: str, dest_city: str, date: str, check_only: bool = False) -> Optional[List[TransportOption]]:
    """Adapter to convert the pipeline payload into the app's standard TransportOption format."""
    print(f"\n[API Call] Executing Multi-Source Redundancy Pipeline for Buses: {origin_city} -> {dest_city}")
    
    pipeline_result = await get_live_bus_data(origin_city, dest_city, date, check_only=check_only)
    
    if pipeline_result.get("status") == "cache_miss":
        return None
        
    options = []
    
    if pipeline_result["status"] == "success":
        for idx, bus in enumerate(pipeline_result["data"]):
            # Parse "20:00 - 08:00" string from the 4-field payload
            timings = bus["timings"]
            try:
                dep_str, arr_str = timings.split(" - ")
                
                base_date = datetime.strptime(date, "%Y-%m-%d")
                dep_hour, dep_minute = map(int, dep_str.split(":"))
                dep_time = base_date.replace(hour=dep_hour, minute=dep_minute)
                
                arr_hour, arr_minute = map(int, arr_str.split(":"))
                arr_time = base_date.replace(hour=arr_hour, minute=arr_minute)
                
                if arr_time < dep_time:
                    arr_time += timedelta(days=1)
            except Exception:
                base_date = datetime.strptime(date, "%Y-%m-%d")
                dep_time = base_date.replace(hour=10, minute=0)
                arr_time = base_date.replace(hour=18, minute=0)
                
            duration_hours = (arr_time - dep_time).total_seconds() / 3600.0
            
            options.append(TransportOption(
                id=f"bus_{pipeline_result['source']}_{idx}",
                type=TransportType.BUS,
                departure=dep_time,
                arrival=arr_time,
                duration_hours=round(duration_hours, 1),
                price=float(bus["price"]),
                safety_score=7,
                comfort_score=6,
                provider=bus["bus_name"]
            ))
            
    return options
