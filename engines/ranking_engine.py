from typing import List
from datetime import datetime, timedelta
from models.entities import Passenger, TransportOption, Place, Hotel
from models.enums import TransportType, Weather, CrowdLevel
from models.state import TripState
from data.mock_db import MOCK_PLACES_DB, MOCK_HOTEL_DB
from engines.safety_engine import calculate_safety_score
from services.live_places_api import search_live_places
from services.live_hotels_api import search_live_hotels
from services.live_flights_api import search_live_flights
from services.live_trains_api import search_live_trains
from services.osrm_cab_api import search_live_cabs

async def rank_transport(source: str, dest: str, date: datetime, passengers: List[Passenger], mode: str = "all") -> List[TransportOption]:
    import asyncio
    from services.dgca_pdf_parser import CITY_TO_IATA
    origin_iata = CITY_TO_IATA.get(source.upper())
    dest_iata = CITY_TO_IATA.get(dest.upper())
    
    from services.live_bus_api import search_live_buses

    async def fetch_flights_safely():
        if origin_iata and dest_iata:
            return await search_live_flights(origin_iata, dest_iata, date.strftime("%Y-%m-%d"))
        return []

    async def empty_result():
        return []

    t_flight = fetch_flights_safely() if mode in ["all", "flight"] else empty_result()
    t_train = search_live_trains(source, dest, date.strftime("%Y-%m-%d")) if mode in ["all", "train"] else empty_result()
    t_cab = search_live_cabs(source, dest, date.strftime("%Y-%m-%d")) if mode in ["all", "cab"] else empty_result()
    t_bus = search_live_buses(source, dest, date.strftime("%Y-%m-%d")) if mode in ["all", "bus"] else empty_result()

    results = await asyncio.gather(t_flight, t_train, t_cab, t_bus)
    
    live_flights, live_trains, live_cabs, live_buses = results
    transports = live_flights + live_trains + live_cabs + live_buses
    
    def transport_score(t: TransportOption):
        score = 0
        has_elderly = any(p.age > 60 for p in passengers)
        if has_elderly and t.type == TransportType.BUS:
            score -= 20 # Heavily penalize buses for elderly
        score += (20 - t.duration_hours) * 2
        score += (10000 - t.price) / 1000
        score += t.safety_score * 2
        return score
from typing import List
from datetime import datetime, timedelta
from models.entities import Passenger, TransportOption, Place, Hotel
from models.enums import TransportType, Weather, CrowdLevel
from models.state import TripState
from data.mock_db import MOCK_PLACES_DB, MOCK_HOTEL_DB
from engines.safety_engine import calculate_safety_score
from services.live_places_api import search_live_places
from services.live_hotels_api import search_live_hotels
from services.live_flights_api import search_live_flights
from services.live_trains_api import search_live_trains
from services.osrm_cab_api import search_live_cabs

async def rank_transport(source: str, dest: str, date: datetime, passengers: List[Passenger], mode: str = "all") -> List[TransportOption]:
    import asyncio
    from services.dgca_pdf_parser import CITY_TO_IATA
    origin_iata = CITY_TO_IATA.get(source.upper())
    dest_iata = CITY_TO_IATA.get(dest.upper())
    
    from services.live_bus_api import search_live_buses

    async def fetch_flights_safely():
        if origin_iata and dest_iata:
            return await search_live_flights(origin_iata, dest_iata, date.strftime("%Y-%m-%d"))
        return []

    async def empty_result():
        return []

    t_flight = fetch_flights_safely() if mode in ["all", "flight"] else empty_result()
    t_train = search_live_trains(source, dest, date.strftime("%Y-%m-%d")) if mode in ["all", "train"] else empty_result()
    t_cab = search_live_cabs(source, dest, date.strftime("%Y-%m-%d")) if mode in ["all", "cab"] else empty_result()
    t_bus = search_live_buses(source, dest, date.strftime("%Y-%m-%d")) if mode in ["all", "bus"] else empty_result()

    results = await asyncio.gather(t_flight, t_train, t_cab, t_bus)
    
    live_flights, live_trains, live_cabs, live_buses = results
    transports = live_flights + live_trains + live_cabs + live_buses
    
    def transport_score(t: TransportOption):
        score = 0
        has_elderly = any(p.age > 60 for p in passengers)
        if has_elderly and t.type == TransportType.BUS:
            score -= 20 # Heavily penalize buses for elderly
        score += (20 - t.duration_hours) * 2
        score += (10000 - t.price) / 1000
        score += t.safety_score * 2
        return score
        
    transports.sort(key=transport_score, reverse=True)
    return transports

from services.google_places_api import search_google_places

async def rank_places(city: str, trip: TripState, weather: Weather) -> List[Place]:
    query = f"Top tourist attractions in {city}"
    # Fetch exactly 30 places
    raw_places = await search_google_places(query, max_results=30)
    
    places = []
    if raw_places:
        print(f"[Debug] First raw place: {raw_places[0]}")
    for i, p in enumerate(raw_places):
        location = p.get("location", {})
        lat = location.get("latitude", 0.0)
        lng = location.get("longitude", 0.0)
        
        place_id = p.get("id", f"p{i}_{city}")
        photo_name = None
        photos = p.get("photos", [])
        if photos:
            photo_name = photos[0].get("name") or None
            
        places.append(
            Place(
                id=place_id,
                photo_name=photo_name,
                name=p.get("displayName", {}).get("text", "Unknown Place"),
                category=(p.get("primaryType") or "tourist_attraction").replace("_", " ").title(),
                coordinates=(lat, lng),
                entry_fee=0,
                visit_duration_hours=2,
                safe_hours=(6, 20),
                crowd_estimate=CrowdLevel.HIGH if p.get("userRatingCount", 0) > 5000 else CrowdLevel.MEDIUM,
                family_friendly=True,
                safety_score_base=9,
                weather_sensitive=False,
                bad_weather_types=[]
            )
        )
    return places

async def rank_food(city: str, trip: TripState, weather: Weather) -> List[Place]:
    query = f"Best popular restaurants in {city}"
    # Fetch exactly 15 restaurants
    raw_places = await search_google_places(query, max_results=15)
    
    places = []
    for i, p in enumerate(raw_places):
        location = p.get("location", {})
        lat = location.get("latitude", 0.0)
        lng = location.get("longitude", 0.0)
        
        place_id = p.get("id", f"f{i}_{city}")
        photo_name = None
        photos = p.get("photos", [])
        if photos:
            photo_name = photos[0].get("name") or None
            
        places.append(
            Place(
                id=place_id,
                photo_name=photo_name,
                name=p.get("displayName", {}).get("text", "Unknown Restaurant"),
                category=(p.get("primaryType") or "restaurant").replace("_", " ").title(),
                coordinates=(lat, lng),
                entry_fee=0,
                visit_duration_hours=1.5,
                safe_hours=(8, 23),
                crowd_estimate=CrowdLevel.MEDIUM,
                family_friendly=True,
                safety_score_base=9,
                weather_sensitive=False,
                bad_weather_types=[]
            )
        )
    return places

async def rank_hotels(city: str, trip: TripState) -> List[Hotel]:
    # Use real live hotels api
    check_in = trip.start_date.strftime("%Y-%m-%d") if trip and trip.start_date else None
    check_out = trip.end_date.strftime("%Y-%m-%d") if trip and trip.end_date else None
    
    hotels = await search_live_hotels(city, check_in_date=check_in, check_out_date=check_out)
    return hotels
