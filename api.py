import asyncio
from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta

from models.entities import Passenger
from models.state import TripState
from models.enums import Weather
from services.geo_service import geo_lookup
from engines.ranking_engine import rank_transport, rank_places, rank_hotels

app = FastAPI()

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

@app.get("/api/transport")
async def get_transport(source: str, destination: str, mode: str = "all", check_only: bool = Query(False)):
    # Dummy passenger to satisfy backend requirements
    p1 = Passenger(id="1", name="Dummy", age=25, gender="M", pincode="110001", city=source)
    date = datetime.now() + timedelta(days=10)
    
    options = await rank_transport(source, destination, date, [p1], mode=mode, check_only=check_only)
    if options is None:
        return {"status": "cache_miss"}
        
    result = []
    for i, o in enumerate(options):
        rec_score = 100 - (i * 5)
        if rec_score < 50: rec_score = 50
            
        result.append({
            "id": o.id,
            "type": o.type.value.lower(),
            "source": source,
            "destination": destination,
            "price": o.price,
            "duration": f"{int(o.duration_hours)}h {int((o.duration_hours % 1)*60)}m",
            "departure": o.departure.strftime("%b %d, %H:%M"),
            "arrival": o.arrival.strftime("%b %d, %H:%M"),
            "comfortScore": o.comfort_score,
            "safetyScore": o.safety_score,
            "recommendationScore": rec_score,
            "provider": o.provider
        })
    return result

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
                
        ta_image = await fetch_foursquare_image(p.name, p.coordinates[0], p.coordinates[1])
        if ta_image:
            return ta_image
        wiki = await fetch_wikipedia_image(p.name + " " + destination)
        if wiki:
            return wiki
        return PLACEHOLDER

    try:
        photo_urls = await asyncio.gather(*[_resolve_photo(p) for p in places])
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

        ta_image = await fetch_foursquare_image(p.name, p.coordinates[0], p.coordinates[1])
        if ta_image:
            return ta_image
        wiki = await fetch_wikipedia_image(p.name + " " + destination)
        if wiki:
            return wiki
        return PLACEHOLDER

    try:
        photo_urls = await asyncio.gather(*[_resolve_photo(p) for p in places])
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
        photo_urls = await asyncio.gather(*[_resolve_photo(h) for h in hotels])
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
    group_size = preferences.get("group_size", len(passengers) or 1)
    
    return await asyncio.to_thread(get_ai_recommendations, passengers, total_budget, days, preference, group_size)


import requests
from typing import List, Dict, Any

def _fetch_photon_cities(q: str) -> List[Dict[str, Any]]:
    if not q or len(q) < 2:
        return []

    url = "https://photon.komoot.io/api/?osm_tag=place:city&osm_tag=place:town"
    params = {
        "q": f"{q} India",
        "limit": 5
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=3.0)
        response.raise_for_status()
        data = response.json()
        
        results = []
        features = data.get("features", [])
        
        if not features:
            print(f"[Debug] Photon returned no features for query: '{q}'")
            
        for feature in features:
            props = feature.get("properties", {})
            geom = feature.get("geometry", {})
            
            name = props.get("name", "Unknown")
            
            state = props.get("state")
            if not state:
                state = props.get("county", "")
            
            formatted_name = f"{name}, {state}" if state else name
            
            coords = geom.get("coordinates", [])
            osrm_coords = ""
            if len(coords) == 2:
                osrm_coords = f"{coords[0]},{coords[1]}"
                
            results.append({
                "name": name,
                "state": state,
                "formatted_name": formatted_name,
                "osrm_coords": osrm_coords
            })
            
        return results
        
    except Exception as e:
        print(f"[Error] Failed to fetch city autocomplete from Photon API: {str(e)}")
        
        # Local Fallback for top Indian cities if Photon goes down
        q_lower = q.lower()
        fallback_cities = [
            {"name": "New Delhi", "state": "Delhi", "osrm_coords": "77.2090,28.6139"},
            {"name": "Mumbai", "state": "Maharashtra", "osrm_coords": "72.8777,19.0760"},
            {"name": "Bangalore", "state": "Karnataka", "osrm_coords": "77.5946,12.9716"},
            {"name": "Hyderabad", "state": "Telangana", "osrm_coords": "78.4747,17.3616"},
            {"name": "Chennai", "state": "Tamil Nadu", "osrm_coords": "80.2707,13.0827"},
            {"name": "Kolkata", "state": "West Bengal", "osrm_coords": "88.3639,22.5726"},
            {"name": "Lucknow", "state": "Uttar Pradesh", "osrm_coords": "80.9462,26.8467"},
            {"name": "Jaipur", "state": "Rajasthan", "osrm_coords": "75.7873,26.9124"},
            {"name": "Pune", "state": "Maharashtra", "osrm_coords": "73.8567,18.5204"},
            {"name": "Ahmedabad", "state": "Gujarat", "osrm_coords": "72.5714,23.0225"},
        ]
        
        matched_cities = [c for c in fallback_cities if q_lower in c["name"].lower()]
        
        if matched_cities:
            return [{
                "name": c["name"],
                "state": c["state"],
                "formatted_name": f"{c['name']}, {c['state']}",
                "osrm_coords": c["osrm_coords"]
            } for c in matched_cities]
            
        return [{
            "name": f"Error: Network issue",
            "state": "API Error",
            "formatted_name": f"Error: Connection to mapping service failed",
            "osrm_coords": ""
        }]

@app.get("/api/search-city")
async def search_city(q: str = "") -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_fetch_photon_cities, q)

import subprocess

@app.get("/api/git-login")
def get_git_login():
    try:
        res = subprocess.run(['git', 'log', '-p', 'src/app/login/page.tsx'], capture_output=True, text=True)
        return {"content": res.stdout}
    except Exception as e:
        return {"error": str(e)}

import os
@app.get("/api/find-logo")
def find_logo():
    import glob
    files = glob.glob("**/*logo*", recursive=True)
    return {"files": files}

import shutil
@app.get("/api/move-logos")
def move_logos():
    try:
        import os
        if os.path.exists('small_logo.png'):
            shutil.move('small_logo.png', 'src/app/icon.png')
        
        if os.path.exists('large_logo.png'):
            shutil.move('large_logo.png', 'public/large_logo.png')

        if os.path.exists('src/app/favicon.ico'):
            os.remove('src/app/favicon.ico')

        return {"status": "Success"}
    except Exception as e:
        return {"error": str(e)}
