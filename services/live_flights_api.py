import os
import json
import math
import httpx
import urllib.parse
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import random
from models.entities import TransportOption
from models.enums import TransportType
from services.dgca_pdf_parser import CITY_TO_IATA
from services.db import get_db_connection
import uuid

def _parse_days_of_operation(days_str: str) -> List[int]:
    """Parses a days of operation string into a list of Python weekday integers (0 = Mon, 6 = Sun)."""
    days = []
    days_str = str(days_str).strip()
    if not days_str or days_str.lower() in ['nan', 'none']:
        return [0, 1, 2, 3, 4, 5, 6]
    
    for i in range(1, 8):
        if str(i) in days_str:
            days.append(i - 1)
    return days if days else [0, 1, 2, 3, 4, 5, 6]


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Returns distance in km between two lat/lon coordinates."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def _get_city_coords(city_name: str) -> Optional[Dict[str, float]]:
    """Fetch a city's lat/lon from Nominatim."""
    encoded = urllib.parse.quote(f"{city_name}, India")
    url = f"https://nominatim.openstreetmap.org/search?q={encoded}&format=json&limit=1"
    headers = {"User-Agent": "Tripeasy-FlightBot/1.0"}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, timeout=10.0)
            resp.raise_for_status()
            data = resp.json()
            if data:
                return {"lat": float(data[0]["lat"]), "lon": float(data[0]["lon"])}
    except Exception as e:
        print(f"[Warning] Failed to geocode city '{city_name}': {e}")
    return None


def _get_nearest_airport(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """Find the nearest IATA airport to the given coordinates using airport_coords.json."""
    coords_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "airport_coords.json")
    try:
        with open(coords_path, "r") as f:
            airport_coords = json.load(f)
    except Exception as e:
        print(f"[Warning] Could not load airport_coords.json: {e}")
        return None

    nearest = None
    min_dist = float("inf")
    for iata, info in airport_coords.items():
        dist = _haversine(lat, lon, info["lat"], info["lon"])
        if dist < min_dist:
            min_dist = dist
            nearest = {
                "iata": iata,
                "city": info.get("city", iata),
                "lat": info["lat"],
                "lon": info["lon"],
                "distance_km": dist,
            }
    return nearest


async def _fetch_flights_for_iata(origin_iata: str, dest_iata: str, date: str, check_only: bool) -> List[TransportOption]:
    """Core flight fetcher: NeonDB DGCA first, then FlightAPI fallback. Returns a list (may be empty)."""
    options = []
    try:
        base_date = datetime.strptime(date, "%Y-%m-%d")
        target_weekday = base_date.weekday()
    except ValueError:
        base_date = datetime.now()
        target_weekday = base_date.weekday()

    try:
        conn = await get_db_connection()
        rows = await conn.fetch(
            'SELECT flight_no, origin, dest, airline, freq, dep_time, arr_time FROM "Flight" WHERE origin = $1 AND dest = $2',
            origin_iata.upper(), dest_iata.upper()
        )
        cached_flights = [
            {"flight_no": r['flight_no'], "origin": r['origin'], "dest": r['dest'],
             "airline": r['airline'], "freq": r['freq'], "dep_time": r['dep_time'], "arr_time": r['arr_time']}
            for r in rows
        ]
        await conn.close()
    except Exception as e:
        print(f"[DB Error] Failed to fetch flights from NeonDB: {e}")
        cached_flights = []

    for idx, flight in enumerate(cached_flights):
        if flight["origin"].upper() == origin_iata.upper() and flight["dest"].upper() == dest_iata.upper():
            days_of_op = _parse_days_of_operation(flight["freq"])
            if target_weekday not in days_of_op:
                continue
            dep_time_raw = flight["dep_time"]
            arr_time_raw = flight["arr_time"]
            try:
                if len(dep_time_raw) >= 4 and ':' not in dep_time_raw:
                    dep_time_raw = f"{dep_time_raw[:2]}:{dep_time_raw[2:4]}"
                elif len(dep_time_raw) > 5:
                    dep_time_raw = dep_time_raw[:5]
                if len(arr_time_raw) >= 4 and ':' not in arr_time_raw:
                    arr_time_raw = f"{arr_time_raw[:2]}:{arr_time_raw[2:4]}"
                elif len(arr_time_raw) > 5:
                    arr_time_raw = arr_time_raw[:5]
                dep_dt = datetime.strptime(f"{date} {dep_time_raw}", "%Y-%m-%d %H:%M")
                arr_dt = datetime.strptime(f"{date} {arr_time_raw}", "%Y-%m-%d %H:%M")
                if arr_dt < dep_dt:
                    arr_dt += timedelta(days=1)
                duration_hours = (arr_dt - dep_dt).total_seconds() / 3600.0
            except Exception as e:
                print(f"[DGCA Error] Time parsing failed for {flight['flight_no']}: {e}")
                continue
            price = 3000 + (duration_hours * 1500)
            options.append(TransportOption(
                id=f"dgca_fl_{idx}",
                type=TransportType.FLIGHT,
                departure=dep_dt,
                arrival=arr_dt,
                duration_hours=duration_hours,
                price=float(round(price, -2)),
                safety_score=9,
                comfort_score=8,
                provider=f"{flight['airline']} {flight['flight_no']} *"
            ))

    # Fallback to FlightAPI if NeonDB had nothing
    if not options:
        if check_only:
            return []
        print(f"[API Call] Route {origin_iata} -> {dest_iata} not found in DGCA. Falling back to FlightAPI...")
        api_key = os.environ.get("FLIGHTAPI_KEY", "6a40cc228466d4877c15a08c")
        url = f"https://api.flightapi.io/onewaytrip/{api_key}/{origin_iata}/{dest_iata}/{date}/1/0/0/Economy/USD"
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, timeout=10.0)
                if resp.status_code == 200:
                    data = resp.json()
                    carriers = {c['id']: c.get('name', c.get('display_code', 'Unknown Airline')) for c in data.get('carriers', [])}
                    segments = {s['id']: s for s in data.get('segments', [])}
                    new_flights = []
                    for leg in data.get('legs', []):
                        if leg.get('stop_count', 0) == 0 and leg.get('segment_ids'):
                            segment_id = leg['segment_ids'][0]
                            segment = segments.get(segment_id)
                            if segment:
                                carrier_name = carriers.get(segment.get('marketing_carrier_id'), 'Unknown Airline')
                                flight_no = f"{carrier_name[:2].upper()} {segment.get('marketing_flight_number', '')}".strip()
                                dep_time_full = segment.get('departure', '')
                                arr_time_full = segment.get('arrival', '')
                                if 'T' in dep_time_full and 'T' in arr_time_full:
                                    dep_time = dep_time_full.split('T')[1][:5]
                                    arr_time = arr_time_full.split('T')[1][:5]
                                    new_flights.append({
                                        "flight_no": flight_no,
                                        "origin": origin_iata.upper(),
                                        "dest": dest_iata.upper(),
                                        "airline": carrier_name,
                                        "freq": "1234567",
                                        "arr_time": arr_time,
                                        "dep_time": dep_time
                                    })
                    if new_flights:
                        unique_flights = list({f["flight_no"] + f["dep_time"]: f for f in new_flights}.values())
                        try:
                            conn = await get_db_connection()
                            for flight in unique_flights:
                                flight_id = uuid.uuid4().hex
                                await conn.execute("""
                                    INSERT INTO "Flight" (id, flight_no, origin, dest, airline, freq, dep_time, arr_time)
                                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                                    ON CONFLICT (flight_no, origin, dest, dep_time, arr_time) DO NOTHING
                                """, flight_id, flight["flight_no"], flight["origin"], flight["dest"], flight["airline"], flight["freq"], flight["dep_time"], flight["arr_time"])
                            await conn.close()
                        except Exception as e:
                            print(f"[DB Error] Failed to insert fallback flights into NeonDB: {e}")
                        for idx, flight in enumerate(unique_flights):
                            try:
                                dep_dt = datetime.strptime(f"{date} {flight['dep_time']}", "%Y-%m-%d %H:%M")
                                arr_dt = datetime.strptime(f"{date} {flight['arr_time']}", "%Y-%m-%d %H:%M")
                                if arr_dt < dep_dt:
                                    arr_dt += timedelta(days=1)
                                duration_hours = (arr_dt - dep_dt).total_seconds() / 3600.0
                                price = 3000 + (duration_hours * 1500)
                                options.append(TransportOption(
                                    id=f"dgca_fl_fb_{idx}",
                                    type=TransportType.FLIGHT,
                                    departure=dep_dt,
                                    arrival=arr_dt,
                                    duration_hours=duration_hours,
                                    price=float(round(price, -2)),
                                    safety_score=9,
                                    comfort_score=8,
                                    provider=f"{flight['airline']} {flight['flight_no']} *"
                                ))
                            except Exception as e:
                                print(f"[Fallback Error] Parsing new flight failed: {e}")
        except Exception as e:
            print(f"[API Error] FlightAPI fallback failed: {e}")
    return options

async def search_live_flights(origin_city: str, dest_city: str, date: str, check_only: bool = False) -> Optional[List[TransportOption]]:
    """
    Main entry point. Accepts city names (not IATA codes).
    Resolves IATA codes from CITY_TO_IATA. If a city has no direct airport,
    finds the nearest airport and creates a Flight + Cab combo route.
    """
    print(f"\n[API Call] Fetching live flights: {origin_city} -> {dest_city} on {date}...")

    clean_origin = origin_city.upper().strip()
    clean_dest = dest_city.upper().strip()

    origin_iata = CITY_TO_IATA.get(clean_origin)
    dest_iata = CITY_TO_IATA.get(clean_dest)

    nearest_origin = None
    nearest_dest = None

    # Resolve origin if not in CITY_TO_IATA
    if not origin_iata:
        coords = await _get_city_coords(origin_city)
        if coords:
            nearest_origin = _get_nearest_airport(coords["lat"], coords["lon"])
            if nearest_origin:
                origin_iata = nearest_origin["iata"]
                print(f"[Combo] No direct airport for '{origin_city}'. Using nearest: {origin_iata} ({nearest_origin['city']}, {nearest_origin['distance_km']:.0f} km away)")

    # Resolve destination if not in CITY_TO_IATA
    if not dest_iata:
        coords = await _get_city_coords(dest_city)
        if coords:
            nearest_dest = _get_nearest_airport(coords["lat"], coords["lon"])
            if nearest_dest:
                dest_iata = nearest_dest["iata"]
                print(f"[Combo] No direct airport for '{dest_city}'. Using nearest: {dest_iata} ({nearest_dest['city']}, {nearest_dest['distance_km']:.0f} km away)")

    if not origin_iata or not dest_iata:
        print(f"[Warning] Could not resolve airports for '{origin_city}' or '{dest_city}'. No flights available.")
        return [] if not check_only else None

    options = await _fetch_flights_for_iata(origin_iata, dest_iata, date, check_only)

    if check_only and not options:
        return None

    # --- Post-process: bolt on cab leg for combo routes ---
    if options and (nearest_origin or nearest_dest):
        from services.osrm_cab_api import calculate_cab_fare, get_coordinates

        combo_options = []
        for opt in options:
            try:
                cab_duration_hours = 0.0
                cab_price = 0.0
                cab_label = ""

                if nearest_dest:
                    # Cab from destination airport → actual destination city
                    airport_coords = {"lat": nearest_dest["lat"], "lng": nearest_dest["lon"]}
                    dest_coords = await get_coordinates(dest_city)
                    if dest_coords:
                        fare = await calculate_cab_fare(
                            nearest_dest["lat"], nearest_dest["lon"],
                            dest_coords["lat"], dest_coords["lng"]
                        )
                        if fare.get("status") == "success":
                            cab_duration_hours = fare["duration_hours"]
                            cab_price = fare["fares"]["sedan"]
                            cab_label = f"Cab to {dest_city.title()}"

                if nearest_origin:
                    # Cab from actual origin city → origin airport
                    origin_coords = await get_coordinates(origin_city)
                    if origin_coords:
                        fare = await calculate_cab_fare(
                            origin_coords["lat"], origin_coords["lng"],
                            nearest_origin["lat"], nearest_origin["lon"]
                        )
                        if fare.get("status") == "success":
                            cab_duration_hours += fare["duration_hours"]
                            cab_price += fare["fares"]["sedan"]
                            if cab_label:
                                cab_label = f"Cab to {nearest_origin['city']} Airport + {cab_label}"
                            else:
                                cab_label = f"Cab to {nearest_origin['city']} Airport"

                if cab_price > 0:
                    new_arrival = opt.arrival + timedelta(hours=cab_duration_hours)
                    new_duration = opt.duration_hours + cab_duration_hours
                    new_price = opt.price + cab_price
                    provider_parts = [p for p in opt.provider.split(" *") if p]
                    
                    flight_leg = provider_parts[0].strip()
                    if nearest_dest:
                        flight_leg += f" to {nearest_dest['city']}"
                    
                    new_provider = f"{flight_leg} + {cab_label}"

                    combo_options.append(TransportOption(
                        id=f"fl_combo_{opt.id}",
                        type=TransportType.FLIGHT,
                        departure=opt.departure,
                        arrival=new_arrival,
                        duration_hours=new_duration,
                        price=round(new_price, 2),
                        price_breakdown={"Flight": round(opt.price, 2), "Cab": round(cab_price, 2)},
                        safety_score=opt.safety_score,
                        comfort_score=opt.comfort_score,
                        provider=new_provider,
                    ))
                else:
                    combo_options.append(opt)
            except Exception as e:
                print(f"[Combo Error] Could not process cab leg for flight {opt.id}: {e}")
                combo_options.append(opt)

        return sorted(combo_options, key=lambda x: x.price)

    return sorted(options, key=lambda x: x.price)
