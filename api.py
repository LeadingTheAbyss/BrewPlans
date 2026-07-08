import asyncio
from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from models.entities import Passenger
from models.state import TripState
from models.enums import Weather
from services.geo_service import geo_lookup
from engines.ranking_engine import rank_transport, rank_places, rank_hotels
from services.routing_engine import optimize_itinerary

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/optimize_itinerary")
async def api_optimize_itinerary(req: Request):
    payload = await req.json()
    places = payload.get("places", [])
    days_count = payload.get("days_count", 1)
    hotel_coords = payload.get("hotel_coords")
    passengers = payload.get("passengers", [])
    arrival_offset_mins = payload.get("arrival_offset_mins", 0)

    return await optimize_itinerary(
        places, days_count, hotel_coords,
        passengers=passengers,
        arrival_offset_mins=arrival_offset_mins
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/debug-db-cache")
async def debug_db_cache():
    try:
        from services.db import get_db_connection
        conn = await get_db_connection()
        try:
            rows = await conn.fetch('SELECT "cacheKey", "expiresAt", "createdAt" FROM "PlaceCache" ORDER BY "createdAt" DESC LIMIT 5')
            return [{"cacheKey": r["cacheKey"], "expiresAt": str(r["expiresAt"]), "createdAt": str(r["createdAt"])} for r in rows]
        finally:
            await conn.close()
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/debug-key")
async def debug_key():
    from services.google_places_api import PLACES_API_KEY
    import os
    return {
        "PLACES_API_KEY_IMPORTED": PLACES_API_KEY, 
        "OS_GETENV": os.getenv("NEXT_PUBLIC_GOOGLE_PLACES_KEY")
    }

@app.post("/api/debug-email")
async def debug_email(req: Request):
    return {"success": True, "message": "Simulated sending email"}

@app.get("/api/clear-cache")
async def clear_cache():
    import os, httpx
    from services.db import get_db_connection
    results = []
    
    # 1. Clear Redis
    UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL")
    UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")
    if UPSTASH_URL and UPSTASH_TOKEN:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    f"{UPSTASH_URL}/pipeline",
                    headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
                    json=[["FLUSHDB"]]
                )
            results.append("Redis FLUSHDB triggered")
        except Exception as e:
            results.append(f"Redis error: {e}")
            
    # 2. Clear Postgres Tables
    try:
        conn = await get_db_connection()
        try:
            await conn.execute('TRUNCATE TABLE "PlaceCache"')
            results.append("Truncated PlaceCache")
        except Exception as e:
            results.append(f"PlaceCache Error: {e}")
            
        try:
            await conn.execute('TRUNCATE TABLE "Hotel"')
            results.append("Truncated Hotel")
        except Exception as e:
            results.append(f"Hotel Error: {e}")
        await conn.close()
    except Exception as e:
        results.append(f"DB error: {e}")
        
    return {"success": True, "results": results}

@app.get("/api/debug-places")
async def debug_places():
    from services.google_places_api import search_google_places
    import traceback
    try:
        res = await search_google_places("Lucknow", max_results=5)
        return {"success": True, "res": res}
    except Exception as e:
        return {"success": False, "error": str(e), "trace": traceback.format_exc()}

@app.get("/api/test-import")
async def test_import():
    from services.live_places_api import search_live_places
    import traceback
    try:
        res = await asyncio.to_thread(search_live_places, "New Delhi")
        return {"count": len(res), "places": [p.name for p in res]}
    except Exception as e:
        return {"error": str(e), "trace": traceback.format_exc()}

from pydantic import BaseModel

class Coord(BaseModel):
    lat: float
    lng: float

class MatrixRequest(BaseModel):
    origins: list[Coord]
    destinations: list[Coord]

@app.post("/api/route-matrix")
async def get_route_matrix(req: MatrixRequest):
    import os, httpx, hashlib
    api_key = os.getenv("NEXT_PUBLIC_GOOGLE_PLACES_KEY")
    if not api_key:
        return {"error": "No API key configured"}
        
    origin_str = "|".join([f"{c.lat},{c.lng}" for c in req.origins])
    dest_str = "|".join([f"{c.lat},{c.lng}" for c in req.destinations])
    
    # Generate Cache Key
    cache_key_raw = f"matrix_{origin_str}_{dest_str}"
    cache_key = "matrix_" + hashlib.md5(cache_key_raw.encode()).hexdigest()
    
    # 1. Check DB Cache
    try:
        from services.google_places_api import _db_get, _db_set
        cached = await _db_get(cache_key)
        if cached and len(cached) > 0:
            print("[RouteMatrix] Cache HIT")
            return cached[0]
    except Exception as e:
        print(f"[RouteMatrix] Cache read error: {e}")
    
    # 2. Fetch from Google
    print("[RouteMatrix] Cache MISS - Fetching from Google Maps")
    url = f"https://maps.googleapis.com/maps/api/distancematrix/json?origins={origin_str}&destinations={dest_str}&departure_time=now&traffic_model=best_guess&key={api_key}"
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, timeout=10.0)
            res.raise_for_status()
            data = res.json()
            
            # Save to Cache
            try:
                await _db_set(cache_key, [data])
            except Exception as e:
                print(f"[RouteMatrix] Cache write error: {e}")
                
            return data
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/transport")
async def get_transport(source: str, destination: str, mode: str = "all", check_only: bool = Query(False)):
    # Dummy passenger to satisfy backend requirements
    p1 = Passenger(id="1", name="Dummy", age=25, gender="M", pincode="110001", city=source)
    date = datetime.now() + timedelta(days=10)
    
    options = await rank_transport(source, destination, date, [p1], mode=mode, check_only=check_only)
    if options is None:
        return {"status": "cache_miss"}
        
    has_trains = False
    result = []
    for i, o in enumerate(options):
        rec_score = 100 - (i * 5)
        if rec_score < 50: rec_score = 50
        
        t_type = o.type.value.lower()
        if t_type == "train":
            has_trains = True
            
        result.append({
            "id": o.id,
            "type": t_type,
            "source": source,
            "destination": destination,
            "departure": o.departure.isoformat(),
            "arrival": o.arrival.isoformat(),
            "duration": f"{int(o.duration_hours)}h {int((o.duration_hours % 1) * 60)}m",
            "price": o.price,
            "safetyScore": o.safety_score,
            "recommendationScore": rec_score,
            "provider": getattr(o, "provider", "Unknown")
        })
        
    cross_routes_data = []
    if (mode == "all" or mode == "train" or mode == "flight" or mode == "cross") and not check_only:
        from services.cross_routing_engine import hydrate_cross_route
        cross_res_list = await hydrate_cross_route(source, destination, date, passengers=1)
        
        for cross_res in cross_res_list:
            if cross_res and cross_res.get("status") == "success":
                path_str = " → ".join(cross_res["offline_estimation"]["nodes"])
                dur = cross_res.get("offline_estimation", {}).get("total_estimated_hours", 10)
                price = cross_res.get("total_price", 0)
                
                # Format legs for frontend
                formatted_legs = []
                for leg in cross_res.get("live_legs", []):
                    opt = leg["live_option"]
                    formatted_legs.append({
                        "source": leg["source"],
                        "destination": leg["destination"],
                        "mode": leg["mode"],
                        "provider": getattr(opt, "provider", "Unknown"),
                        "departure": opt.departure.isoformat(),
                        "arrival": opt.arrival.isoformat(),
                        "duration": f"{int(opt.duration_hours)}h {int((opt.duration_hours % 1) * 60)}m",
                        "price": opt.price
                    })
                
                cross_routes_data.append({
                    "id": f"cross-{source}-{destination}-{cross_res_list.index(cross_res)}",
                    "type": "cross",
                    "source": source,
                    "destination": destination,
                    "departure": date.isoformat(),
                    "arrival": (date + timedelta(hours=dur)).isoformat(),
                    "duration": f"{int(dur)}h {int((dur % 1) * 60)}m",
                    "price": price,
                    "safetyScore": 85,
                    "recommendationScore": 95,
                    "provider": f"Connecting Route: {path_str}",
                    "path_str": path_str,
                    "legs": formatted_legs
                })
            
    return {
        "options": result,
        "cross_routes": cross_routes_data
    }

from services.live_trains_api import get_train_route, get_live_train_status, get_station_board

@app.get("/api/trains/{train_number}/route")
async def api_get_train_route(train_number: str):
    return await get_train_route(train_number)

@app.get("/api/trains/{train_number}/live")
async def api_get_live_train_status(train_number: str, date: str):
    return await get_live_train_status(train_number, date)

@app.get("/api/stations/{station_code}/board")
async def api_get_station_board(station_code: str):
    return await get_station_board(station_code)

@app.get("/api/cross_transport")
async def get_cross_transport(source: str, destination: str):
    """
    Finds multi-modal indirect routes (e.g. Train -> Flight) when no direct routes exist.
    """
    from services.cross_routing_engine import hydrate_cross_route
    date = datetime.now() + timedelta(days=10)
    
    result = await hydrate_cross_route(source, destination, date, passengers=1)
    
    if not result:
        return {"status": "error", "message": "No valid cross-routes found."}
        
    return result

@app.get("/api/places")
async def get_places(destination: str, check_only: bool = Query(False)):
    trip = TripState(
        trip_id="T1", mode="direct", passengers=[],
        source_city="Delhi", destination_city=destination,
        start_date=datetime.now(), end_date=datetime.now() + timedelta(days=3),
        total_budget=50000
    )
    places = await rank_places(destination, trip, Weather.SUNNY, check_only=check_only)
    if places is None:
        return {"status": "cache_miss"}
    
    result = []
    from services.google_places_api import get_google_photo_url, fetch_google_place_details_photo, fetch_wikipedia_image, fetch_foursquare_image

    PLACEHOLDER = "/placeholder-place.svg"

    async def _resolve_photo(p):
        if getattr(p, "photo_name", None):
            google_img = get_google_photo_url(p.photo_name)
            if google_img:
                return google_img
        return PLACEHOLDER

    try:
        raw_urls = await asyncio.gather(*[_resolve_photo(p) for p in places], return_exceptions=True)
        photo_urls = [r if not isinstance(r, Exception) else PLACEHOLDER for r in raw_urls]
    except Exception as e:
        print(f"[PlacePhoto] resolution failed: {type(e).__name__}: {e}")
        photo_urls = [PLACEHOLDER] * len(places)

    for i, p in enumerate(places):
        result.append({
            "id": p.id,
            "name": p.name,
            "category": p.category.title() if isinstance(p.category, str) else str(p.category),
            "visitDurationHours": p.visit_duration_hours,
            "entryFee": p.entry_fee,
            "safetyScore": p.safety_score_base,
            "crowdScore": p.crowd_estimate.value,
            "recommendationScore": 90 - i,
            "imageUrl": photo_urls[i],
            "lat": p.coordinates[0],
            "lng": p.coordinates[1]
        })
    return result

from engines.ranking_engine import rank_food

@app.get("/api/food")
async def get_food(destination: str, check_only: bool = Query(False)):
    trip = TripState(
        trip_id="T1", mode="direct", passengers=[],
        source_city="Delhi", destination_city=destination,
        start_date=datetime.now(), end_date=datetime.now() + timedelta(days=3),
        total_budget=50000
    )
    places = await rank_food(destination, trip, Weather.SUNNY, check_only=check_only)
    if places is None:
        return {"status": "cache_miss"}
    
    result = []
    from services.google_places_api import get_google_photo_url, fetch_google_place_details_photo, fetch_wikipedia_image, fetch_foursquare_image

    PLACEHOLDER = "/placeholder-place.svg"

    async def _resolve_photo(p):
        if getattr(p, "photo_name", None):
            google_img = get_google_photo_url(p.photo_name)
            if google_img:
                return google_img
        return PLACEHOLDER

    try:
        raw_urls = await asyncio.gather(*[_resolve_photo(p) for p in places], return_exceptions=True)
        photo_urls = [r if not isinstance(r, Exception) else PLACEHOLDER for r in raw_urls]
    except Exception as e:
        print(f"[FoodPhoto] resolution failed: {type(e).__name__}: {e}")
        photo_urls = [PLACEHOLDER] * len(places)

    for i, p in enumerate(places):
        result.append({
            "id": p.id,
            "name": p.name,
            "category": p.category.title() if isinstance(p.category, str) else str(p.category),
            "visitDurationHours": p.visit_duration_hours,
            "entryFee": p.entry_fee,
            "safetyScore": p.safety_score_base,
            "crowdScore": p.crowd_estimate.value,
            "recommendationScore": 90 - i,
            "imageUrl": photo_urls[i],
            "lat": p.coordinates[0],
            "lng": p.coordinates[1]
        })
    return result

from services.live_places_api import fetch_live_reviews

@app.get("/api/places/reviews")
async def get_place_reviews(location_id: str):
    return await asyncio.to_thread(fetch_live_reviews, location_id)


@app.get("/api/hotels")
async def get_hotels(destination: str, check_only: bool = Query(False)):
    trip = TripState(
        trip_id="T1", mode="direct", passengers=[],
        source_city="Delhi", destination_city=destination,
        start_date=datetime.now(), end_date=datetime.now() + timedelta(days=3),
        total_budget=50000
    )
    hotels = await rank_hotels(destination, trip, check_only=check_only)
    if hotels is None:
        return {"status": "cache_miss"}
    
    result = []
    from services.google_places_api import get_google_photo_url, fetch_google_place_details_photo, fetch_wikipedia_image, fetch_foursquare_image

    # Placeholder served from public/ — no external request
    PLACEHOLDER = "/placeholder-place.svg"

    async def _resolve_photo(h):
        if getattr(h, "photo_name", None):
            if h.photo_name.startswith("http"):
                return h.photo_name
            google_img = get_google_photo_url(h.photo_name)
            if google_img:
                return google_img

        from services.google_places_api import search_google_places
        if check_only:
            return PLACEHOLDER
            
        places_res = await search_google_places(f"{h.name} {destination}", max_results=1)
        if places_res:
            photos = places_res[0].get("photos", [])
            if photos:
                p_name = photos[0].get("name")
                if p_name:
                    google_img = get_google_photo_url(p_name)
                    if google_img:
                        return google_img
        
        return PLACEHOLDER

    try:
        raw_urls = await asyncio.gather(*[_resolve_photo(h) for h in hotels], return_exceptions=True)
        photo_urls = [r if not isinstance(r, Exception) else PLACEHOLDER for r in raw_urls]
    except Exception as e:
        print(f"[HotelPhoto] resolution failed: {type(e).__name__}: {e}")
        photo_urls = [PLACEHOLDER] * len(hotels)

    for i, h in enumerate(hotels):
        maps_url = (
            f"https://www.google.com/maps/search/?api=1"
            f"&query={h.coordinates[0]},{h.coordinates[1]}"
            f"&query_place_id={h.id}"
        )
        result.append({
            "id": h.id,
            "name": h.name,
            "address": getattr(h, "address", None),
            "coordinates": h.coordinates,
            "pricePerNight": h.price_per_night,
            "distanceToCluster": 2.5,
            "safetyScore": h.safety_score,
            "comfortScore": h.comfort_score,
            "recommendationScore": 90 - i,
            "rating": h.rating,
            "imageUrl": photo_urls[i],
            "mapsUrl": maps_url,
            "lat": h.coordinates[0],
            "lng": h.coordinates[1]
        })
    return result

from engines.ollama_engine import recommend as get_ai_recommendations

@app.post("/api/recommendations")
async def get_recommendations(preferences: dict):
    passengers = preferences.get("passengers", [])
    total_budget = preferences.get("total_budget", 50000)
    days = preferences.get("days", 3)
    preference = preferences.get("preference", "any")
    
    return await asyncio.to_thread(get_ai_recommendations, passengers, total_budget, days, preference)


import requests
from typing import List, Dict, Any

def _fetch_photon_cities(q: str) -> List[Dict[str, Any]]:
    if not q or len(q) < 2:
        return []

    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {
        "name": q,
        "count": 15,
        "language": "en",
        "format": "json"
    }
    
    try:
        response = requests.get(url, params=params, timeout=2.0)
        response.raise_for_status()
        data = response.json()
        
        results = []
        features = data.get("results", [])
        
        for feature in features:
            if feature.get("country") != "India":
                continue
                
            # Strictly filter out low-population towns to prevent spamming the dropdown
            # with multiple tiny villages of the same name (e.g. 7 different "Jaipur"s).
            pop = feature.get("population", 0)
            if pop < 25000:
                continue
                
            city_name = feature.get("name")
            state_name = feature.get("admin1", "")
            
            if not city_name:
                continue
                
            display = f"{city_name}"
            if state_name:
                display += f", {state_name}"
                
            results.append({
                "name": city_name,
                "display": display,
                "state": state_name,
                "lat": feature.get("latitude"),
                "lng": feature.get("longitude")
            })
            
        # Deduplicate by display name while preserving order
        seen = set()
        deduped = []
        for r in results:
            if r["display"] not in seen:
                seen.add(r["display"])
                deduped.append(r)
                
        return deduped
    except Exception as e:
        print(f"[Warning] Failed to fetch open-meteo cities: {e}")
        return []

@app.get("/api/search-city")
async def api_search_city(q: str = Query(..., min_length=2)):
    return await asyncio.to_thread(_fetch_photon_cities, q)
