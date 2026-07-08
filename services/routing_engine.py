"""
routing_engine.py — Full Hybrid OR-Tools TOPTW Solver
Architecture: DBSCAN Spatial Clustering → Demographic Scaling → OR-Tools TOPTW
  with Meal Temporal Pinning, Load Balancing, and Node Dropping.

Based on: "Optimal Architecture for Intelligent Travel Itinerary Planning"
"""

import math
import asyncio
import logging
from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DEPENDENCY GUARD
# ---------------------------------------------------------------------------
_HAS_ORTOOLS = False
_HAS_SKLEARN = False

try:
    from ortools.constraint_solver import routing_enums_pb2
    from ortools.constraint_solver import pywrapcp
    _HAS_ORTOOLS = True
except ImportError:
    log.warning("[Router] OR-Tools not installed. Will use greedy fallback.")

try:
    from sklearn.cluster import DBSCAN
    import numpy as np
    _HAS_SKLEARN = True
except ImportError:
    log.warning("[Router] scikit-learn not installed. DBSCAN disabled.")


# ---------------------------------------------------------------------------
# UTILITIES
# ---------------------------------------------------------------------------

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine great-circle distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def travel_mins_haversine(lat1: float, lon1: float,
                           lat2: float, lon2: float,
                           speed_kmh: float = 25.0) -> int:
    """Urban travel time in minutes via Haversine + urban speed multiplier."""
    dist = haversine_km(lat1, lon1, lat2, lon2)
    return max(5, int((dist / speed_kmh) * 60))


# ---------------------------------------------------------------------------
# DEMOGRAPHIC SCALING
# ---------------------------------------------------------------------------

def compute_fatigue_cap_mins(passengers: List[Dict]) -> int:
    """
    Dynamically scale daily fatigue cap from passenger demographics.
    - Toddlers (age < 6):  5 hrs = 300 min
    - Elderly (age > 70):  6 hrs = 360 min
    - Default:             8 hrs = 480 min
    """
    if not passengers:
        return 480
    ages = [int(p.get("age", 30)) for p in passengers if p.get("age")]
    if not ages:
        return 480
    if any(a < 6 for a in ages):
        return 300
    if any(a > 70 for a in ages):
        return 360
    return 480


def compute_transit_multiplier(passengers: List[Dict]) -> float:
    """Apply 1.25x transit multiplier for groups with mobility constraints."""
    ages = [int(p.get("age", 30)) for p in passengers if p.get("age")]
    if any(a < 6 or a > 70 for a in ages):
        return 1.25
    return 1.0


# ---------------------------------------------------------------------------
# PLACE ENRICHMENT
# ---------------------------------------------------------------------------

FOOD_KEYWORDS = {"restaurant", "cafe", "bar", "bakery", "food",
                  "bistro", "diner", "dhaba", "eatery", "coffee"}

# Meal time windows in minutes from day start (assume day starts at 06:00)
# (tag, earliest_arrival_min, latest_arrival_min)
MEAL_WINDOWS = [
    ("breakfast", 60,  240),   # 07:00 – 10:00
    ("lunch",     360, 480),   # 12:00 – 14:00
    ("dinner",    780, 900),   # 19:00 – 21:00
]


def _is_food(category: str) -> bool:
    cat = (category or "").lower()
    return any(kw in cat for kw in FOOD_KEYWORDS)


def _primary_type(category: str) -> str:
    c = (category or "").lower()
    if any(kw in c for kw in FOOD_KEYWORDS):       return "food"
    if "museum" in c or "gallery" in c:             return "museum"
    if any(kw in c for kw in ("temple", "mosque", "church", "shrine")): return "religious"
    if any(kw in c for kw in ("park", "garden", "lake", "beach")):      return "nature"
    if any(kw in c for kw in ("market", "bazaar", "mall", "shop")):     return "shopping"
    if any(kw in c for kw in ("fort", "palace", "monument", "historical")): return "historical"
    return "attraction"


def _enrich(place: Dict) -> Dict:
    cat = place.get("category", "")
    return {
        "id":           place["id"],
        "lat":          float(place["lat"]),
        "lng":          float(place["lng"]),
        "dur_mins":     int((place.get("visitDurationHours") or 1.5) * 60),
        "is_food":      _is_food(cat),
        "primary_type": _primary_type(cat),
        "rating":       float(place.get("rating") or 4.0),
        "entry_fee":    float(place.get("entryFee") or 0),
    }


# ---------------------------------------------------------------------------
# STAGE 1 — DBSCAN SPATIAL CLUSTERING
# ---------------------------------------------------------------------------

def dbscan_cluster(enriched: List[Dict],
                   eps_km: float = 3.0,
                   min_pts: int = 2) -> Dict[str, int]:
    """
    Groups POIs into geographic clusters using DBSCAN (haversine metric).
    Noise points are assigned to the nearest cluster centroid.
    Returns: {place_id -> cluster_id (0-indexed)}
    """
    if not _HAS_SKLEARN or len(enriched) < min_pts:
        return {p["id"]: 0 for p in enriched}

    coords = np.array([[p["lat"], p["lng"]] for p in enriched])
    eps_rad = eps_km / 6371.0
    labels = DBSCAN(eps=eps_rad, min_samples=min_pts,
                    metric="haversine").fit(np.radians(coords)).labels_

    cluster_map: Dict[str, int] = {}
    noise_idx: List[int] = []

    for i, p in enumerate(enriched):
        if labels[i] == -1:
            noise_idx.append(i)
        else:
            cluster_map[p["id"]] = int(labels[i])

    unique = sorted(set(cluster_map.values()))
    if not unique:
        return {p["id"]: 0 for p in enriched}

    # Compute centroids
    centroids: Dict[int, Tuple[float, float]] = {}
    for cid in unique:
        members = [enriched[i] for i in range(len(enriched))
                   if enriched[i]["id"] in cluster_map
                   and cluster_map[enriched[i]["id"]] == cid]
        centroids[cid] = (
            sum(m["lat"] for m in members) / len(members),
            sum(m["lng"] for m in members) / len(members),
        )

    # Assign noise to nearest centroid
    for i in noise_idx:
        p = enriched[i]
        best = min(unique, key=lambda c: haversine_km(
            p["lat"], p["lng"], centroids[c][0], centroids[c][1]))
        cluster_map[p["id"]] = best

    # Remap to contiguous 0-based IDs
    remap = {old: new for new, old in enumerate(unique)}
    return {pid: remap[cid] for pid, cid in cluster_map.items()}


def assign_clusters_to_days(cluster_map: Dict[str, int],
                             days_count: int) -> Dict[int, List[int]]:
    """
    Round-robin assignment of clusters to trip days.
    Returns: {cluster_id -> [day_index, ...]} (0-indexed days)
    """
    num_clusters = max(cluster_map.values(), default=0) + 1
    cluster_to_days: Dict[int, List[int]] = defaultdict(list)
    for cid in range(num_clusters):
        day_idx = cid % days_count
        cluster_to_days[cid].append(day_idx)
        # If fewer clusters than days, allow adjacent day too
        if num_clusters < days_count:
            extra = (cid + 1) % days_count
            if extra not in cluster_to_days[cid]:
                cluster_to_days[cid].append(extra)
    return dict(cluster_to_days)


# ---------------------------------------------------------------------------
# STAGE 2 — OR-Tools TOPTW Solver
# ---------------------------------------------------------------------------

def _build_time_matrix(nodes: List[Dict], transit_mult: float) -> List[List[int]]:
    n = len(nodes)
    return [
        [
            0 if i == j else int(travel_mins_haversine(
                nodes[i]["lat"], nodes[i]["lng"],
                nodes[j]["lat"], nodes[j]["lng"]
            ) * transit_mult)
            for j in range(n)
        ]
        for i in range(n)
    ]


def _solve_ortools(
    nodes: List[Dict],
    days_count: int,
    fatigue_cap_mins: int,
    transit_mult: float,
    arrival_offset_mins: int = 0,
) -> Dict[str, int]:
    """
    Core OR-Tools TOPTW solver.
    nodes[0] must be the hotel depot.
    Returns {place_id: day_number (1-indexed)}.
    """
    num_nodes = len(nodes)
    if num_nodes <= 1:
        return {}

    time_matrix = _build_time_matrix(nodes, transit_mult)

    manager = pywrapcp.RoutingIndexManager(num_nodes, days_count, 0)
    routing = pywrapcp.RoutingModel(manager)

    # --- Arc cost = travel time + service time at origin node ---
    def time_callback(from_idx, to_idx):
        fn = manager.IndexToNode(from_idx)
        tn = manager.IndexToNode(to_idx)
        return time_matrix[fn][tn] + nodes[fn]["dur_mins"]

    transit_cb = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_cb)

    # --- Time Dimension (fatigue cap per day) ---
    routing.AddDimension(
        transit_cb,
        60,                  # 60-min waiting slack
        fatigue_cap_mins,    # max per vehicle
        True,
        "Time",
    )
    time_dim = routing.GetDimensionOrDie("Time")

    # Arrival offset for Day 1 (e.g. flight arrives at 14:00 → start at 16:00)
    if arrival_offset_mins > 0:
        time_dim.CumulVar(routing.Start(0)).SetRange(
            arrival_offset_mins, arrival_offset_mins)

    # SetGlobalSpanCostCoefficient = anti-greedy load balancer
    # Penalises disparity between busiest and lightest day heavily
    time_dim.SetGlobalSpanCostCoefficient(100)

    # --- Meal Cap Dimension (≤ 3 food POIs per day) ---
    def meal_cb(from_idx):
        return 1 if nodes[manager.IndexToNode(from_idx)]["is_food"] else 0

    meal_cb_idx = routing.RegisterUnaryTransitCallback(meal_cb)
    routing.AddDimension(meal_cb_idx, 0, 3, True, "Meals")

    # --- Meal Temporal Pinning ---
    # Each food node gets a strict arrival time window matching a meal slot
    # Ensures meals are spread across the day, never consecutive
    food_nodes = [i for i, n in enumerate(nodes) if n["is_food"] and i > 0]
    meal_slot_idx = 0
    for fi in food_nodes:
        node_idx = manager.NodeToIndex(fi)
        _, slot_open, slot_close = MEAL_WINDOWS[meal_slot_idx % len(MEAL_WINDOWS)]
        time_dim.CumulVar(node_idx).SetRange(slot_open, slot_close)
        meal_slot_idx += 1

    # --- Counter Dimension (visit count balancing across days) ---
    # Every POI costs 1 visit; depot costs 0
    visit_costs = [0] + [1] * (num_nodes - 1)
    target_visits = max(1, (num_nodes - 1) // days_count)

    routing.AddVectorDimension(visit_costs, num_nodes, True, "Counter")
    counter_dim = routing.GetDimensionOrDie("Counter")

    # Soft bounds: penalise days that deviate from target visit count
    for v in range(days_count):
        end_idx = routing.End(v)
        counter_dim.SetCumulVarSoftLowerBound(end_idx, target_visits, 50_000)
        counter_dim.SetCumulVarSoftUpperBound(end_idx, target_visits + 2, 50_000)

    # --- Node Dropping (AddDisjunction) ---
    # Solver can drop any POI — penalty scales with rating so best places are kept
    for node_i in range(1, num_nodes):
        penalty = int(20_000 * nodes[node_i]["rating"])
        routing.AddDisjunction([manager.NodeToIndex(node_i)], penalty)

    # --- Sequential Category Disjunction ---
    # Extra arc cost for consecutive nodes of the same primary type
    def seq_penalty_cb(from_idx, to_idx):
        fn = manager.IndexToNode(from_idx)
        tn = manager.IndexToNode(to_idx)
        if fn == 0 or tn == 0:
            return 0
        if nodes[fn]["primary_type"] == nodes[tn]["primary_type"]:
            return 500  # minutes penalty — forces solver to interleave types
        return 0

    seq_cb = routing.RegisterTransitCallback(seq_penalty_cb)
    routing.AddDimension(seq_cb, 0, 99_999, True, "SeqPenalty")

    # --- Search Parameters ---
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)
    params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH)
    params.time_limit.seconds = 5

    solution = routing.SolveWithParameters(params)
    if not solution:
        log.warning("[Router] OR-Tools found no solution for this cluster.")
        return {}

    result: Dict[str, int] = {}
    for vehicle_id in range(days_count):
        idx = routing.Start(vehicle_id)
        while not routing.IsEnd(idx):
            node_i = manager.IndexToNode(idx)
            if node_i != 0:
                result[nodes[node_i]["id"]] = vehicle_id + 1
            idx = solution.Value(routing.NextVar(idx))
    return result


# ---------------------------------------------------------------------------
# GREEDY FALLBACK (load-balanced, not sequential)
# ---------------------------------------------------------------------------

def greedy_fallback(places_data: List[Dict],
                    days_count: int,
                    fatigue_cap_hours: float = 8.0) -> Dict[str, int]:
    """
    Round-robin load-balanced greedy scheduler.
    Attractions first (sorted by rating desc), food last to anchor meals.
    """
    enriched = [_enrich(p) for p in places_data]
    enriched.sort(key=lambda p: (p["is_food"], -p["rating"]))

    day_times = [0.0] * days_count
    result: Dict[str, int] = {}

    for p in enriched:
        dur_h = p["dur_mins"] / 60.0
        best_day = min(range(days_count), key=lambda d: day_times[d])
        if day_times[best_day] + dur_h <= fatigue_cap_hours:
            day_times[best_day] += dur_h
            result[p["id"]] = best_day + 1

    return result


# ---------------------------------------------------------------------------
# PUBLIC API
# ---------------------------------------------------------------------------

async def optimize_itinerary(
    places_data: List[Dict],
    days_count: int,
    hotel_coords: Optional[Tuple[float, float]] = None,
    passengers: Optional[List[Dict]] = None,
    arrival_offset_mins: int = 0,
) -> Dict:
    """
    Main entry point. Returns {"assignments": {place_id: day_number (1-indexed)}}.

    Full pipeline:
      1. Compute demographic fatigue cap & transit multiplier
      2. Enrich POI data
      3. DBSCAN spatial clustering
      4. OR-Tools TOPTW per cluster with:
         - Meal temporal pinning
         - Load balancing (SetGlobalSpanCostCoefficient)
         - Counter dimension (visit count balancing)
         - Node dropping (AddDisjunction with rating penalty)
         - Sequential type disjunction penalty
      5. Greedy load-balanced fallback for dropped nodes
    """
    passengers = passengers or []

    if not places_data:
        return {"assignments": {}}

    fatigue_cap_mins = compute_fatigue_cap_mins(passengers)
    transit_mult = compute_transit_multiplier(passengers)

    log.info(
        f"[Router] Optimizing {len(places_data)} places across {days_count} days. "
        f"Cap={fatigue_cap_mins}min, TransitMult={transit_mult:.2f}"
    )

    enriched = [_enrich(p) for p in places_data]

    # --- No OR-Tools: load-balanced greedy ---
    if not _HAS_ORTOOLS:
        assignments = await asyncio.to_thread(
            greedy_fallback, places_data, days_count, fatigue_cap_mins / 60.0)
        return {"assignments": assignments}

    # --- Depot ---
    if hotel_coords:
        depot_lat, depot_lng = float(hotel_coords[0]), float(hotel_coords[1])
    else:
        depot_lat = sum(p["lat"] for p in enriched) / len(enriched)
        depot_lng = sum(p["lng"] for p in enriched) / len(enriched)

    depot = {
        "id": "__depot__", "lat": depot_lat, "lng": depot_lng,
        "dur_mins": 0, "is_food": False, "primary_type": "depot",
        "rating": 5.0, "entry_fee": 0.0,
    }

    all_assignments: Dict[str, int] = {}

    # --- DBSCAN Stage ---
    if _HAS_SKLEARN and len(enriched) >= 5:
        cluster_map = await asyncio.to_thread(dbscan_cluster, enriched)
        cluster_to_days = assign_clusters_to_days(cluster_map, days_count)
        num_clusters = max(cluster_map.values(), default=0) + 1

        log.info(f"[Router] DBSCAN: {num_clusters} clusters detected.")

        for cid in range(num_clusters):
            cluster_places = [p for p in enriched
                              if cluster_map.get(p["id"]) == cid]
            if not cluster_places:
                continue

            candidate_days = cluster_to_days.get(cid, [cid % days_count])
            nodes = [depot] + cluster_places

            cluster_result = await asyncio.to_thread(
                _solve_ortools,
                nodes,
                len(candidate_days),
                fatigue_cap_mins,
                transit_mult,
                arrival_offset_mins if cid == 0 else 0,
            )

            for pid, vehicle_day in cluster_result.items():
                actual_day = candidate_days[(vehicle_day - 1) % len(candidate_days)] + 1
                all_assignments[pid] = actual_day

    else:
        # --- Global solve (few POIs or no sklearn) ---
        nodes = [depot] + enriched
        all_assignments = await asyncio.to_thread(
            _solve_ortools,
            nodes,
            days_count,
            fatigue_cap_mins,
            transit_mult,
            arrival_offset_mins,
        )

    # --- Greedy fill for solver-dropped nodes ---
    dropped = [p for p in enriched if p["id"] not in all_assignments]
    if dropped:
        log.info(f"[Router] {len(dropped)} nodes dropped — greedy fill.")
        day_load: Dict[int, float] = defaultdict(float)
        for pid, d in all_assignments.items():
            place = next((p for p in enriched if p["id"] == pid), None)
            if place:
                day_load[d] += place["dur_mins"] / 60.0

        dropped.sort(key=lambda p: -p["rating"])
        cap_h = fatigue_cap_mins / 60.0
        for p in dropped:
            dur_h = p["dur_mins"] / 60.0
            best_day = min(range(1, days_count + 1), key=lambda d: day_load[d])
            if day_load[best_day] + dur_h <= cap_h:
                all_assignments[p["id"]] = best_day
                day_load[best_day] += dur_h

    log.info(f"[Router] Done. {len(all_assignments)}/{len(places_data)} assigned.")
    return {"assignments": all_assignments}
