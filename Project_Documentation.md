# 📄 Project Documentation: PlanBro (Tripal)

## 1. Executive Summary

**Project Name:** PlanBro (Tripal)  
**Project Summary:** PlanBro is a premium, full-stack travel itinerary planner designed to remove the friction from planning trips. By consolidating flights, trains, buses, cabs, hotels, and attractions into one unified platform, it provides an optimized, fully ranked itinerary. The platform intelligently calculates transport modes, discovers real-time places of interest, and delivers AI-driven recommendations based on group profiles and budgets.  
**Tech Stack:**  
- **Frontend:** Next.js (v16.2.9) App Router, React 19, TypeScript, Tailwind CSS v4, Shadcn UI, GSAP, Three.js, Zustand, React Query, @dnd-kit.
- **Backend:** FastAPI (Python), Uvicorn, Asyncio.
- **Database & Caching:** PostgreSQL (via asyncpg), Prisma ORM, Upstash Redis.
- **AI & External APIs:** Ollama Engine (local LLMs), Google Places API (REST), Overpass API, Nominatim, OSRM, DuckDuckGo image scraping.

---

## 2. Problem Statement & Project Goals

### Problem Statement
Modern travel planning is highly fragmented. Users typically juggle multiple tabs across different websites to book flights, track train statuses, reserve hotels, and discover local attractions. This manual process is time-consuming, disjointed, and makes it difficult to maintain a unified budget or realistic schedule.

### Project Goals
- **Consolidation:** Unify the entire travel planning experience into a single intuitive interface.
- **Real-Time Intelligence:** Provide live transport data, realistic transit times, and dynamic ranking of accommodations and places.
- **Automation:** Use a smart bucket-scheduling algorithm and LLM-assisted profiling to generate highly realistic itineraries automatically.
- **Visual Excellence:** Deliver a premium user experience utilizing 3D assets, parallax animations, and seamless drag-and-drop planning.

### Target Users
- **Solo Travelers:** Looking for quick, optimized, and safe routes.
- **Families/Groups:** Requiring complex passenger grouping, budget constraints, and multi-room hotel scaling.
- **Budget-Conscious Planners:** Needing real-time expense tracking across all travel components.

---

## 3. Core Features & User Flow

### Core Features
| Feature | Description |
|---|---|
| **Premium 3D Landing** | GSAP and Three.js powered interactive 3D airplane flight simulation. |
| **Real-Time Transport** | Parallel fetching of Flights, Trains, Buses, and Cabs with comfort/safety rankings. |
| **Smart Itinerary Builder** | Frontend time-bucket algorithm with `dnd-kit` for drag-and-drop scheduling. |
| **Dynamic Place Discovery** | Live geospatial queries to discover and rank tourist spots, incorporating weather and crowd estimates. |
| **"The Purse" (Live Budget)** | Real-time budget simulation tracking transport, hotel, and entry fee costs. |
| **AI Recommendations** | Localized LLM (Ollama) generating customized travel profiles and descriptive suggestions. |
| **Passenger Grouping** | Intelligent UI stacking of passengers sharing the same starting city and transport mode. |

### User Journey Flowchart (Textual Representation)
```text
[ Landing Page ] 
      │ (3D Experience)
      ▼
[ Travel Preferences Input ] 
  (Source, Dest, Dates, Passengers, Total Budget)
      │
      ▼
[ Real-Time Data Aggregation (Backend Fan-Out) ]
  ├── Fetch Transport (Flights, Trains, Buses, Cabs)
  ├── Fetch Hotels (SerpAPI + Proxies)
  └── Fetch Places (Google Places / Overpass)
      │
      ▼
[ Smart AI Profiling (Ollama) ]
      │ (Generates custom travel profile based on passengers & budget)
      ▼
[ Interactive Planner UI ]
  ├── Drag-and-Drop Timeline (Zustand State)
  ├── Real-time Map (Haversine Distance tracking)
  └── Live "Purse" (Budget Deduction)
      │
      ▼
[ Review & Save ]
  (Saves to DB via Prisma, generates final itinerary)
```

---

## 4. Frontend Architecture

### Core Technologies & State Management
- **Next.js & React 19:** Utilizes the App Router for server-side rendering (SSR) where beneficial, and Client Components for highly interactive elements.
- **Zustand:** Acts as an in-browser shared database. Key stores include:
  - `itineraryStore.ts`: Manages the step-by-step timeline, dragged places, and travel buffers.
  - `tripStore.ts`: Manages selected transport, passenger profiles, and the live budget.
- **React Query:** Handles data fetching, caching, and synchronization for API calls.

### UI/UX, Animations, and Math
- **GSAP & Three.js:** Complex scroll triggers require explicit z-index management (`position: relative`, `z-50`) to prevent stacking context washouts (e.g., parallax sky overlapping text).
- **Tailwind CSS v4 & Shadcn:** Utilized for rapid, accessible component styling. Inline styles are strategically used to bypass Tailwind for GSAP animated elements.
- **Global Locale Scaling:** Strict use of `'en-IN'` locale formatting for large numbers (Lakhs/Crores). Room calculations dynamically scale based on passenger count (`Math.ceil(paxCount / 3)`).
- **HMR Stability:** Spread props and fallback states (`passengers || []`) ensure Hot Module Replacement does not crash the development server when array structures change.

---

## 5. Backend Architecture & Connectivity

### API Design & Concurrency
The backend is built on **FastAPI**, serving high-performance, asynchronous REST endpoints. 
- **Fan-Out/Fan-In Architecture:** To eliminate I/O bottlenecks, the backend uses `asyncio.gather()` to fetch flights, trains, buses, and place images simultaneously. This parallel execution cuts response times drastically without requiring a heavy message broker like Celery.
- **Connection Pooling:** To prevent TCP Socket Exhaustion (WinError 10055), a shared `requests.Session()` is used for synchronous third-party calls, and a singleton `httpx.AsyncClient` is used for Redis, enforcing HTTP Keep-Alive.

### Frontend-Backend Connectivity
- Data is strictly transmitted via JSON payloads.
- The frontend Next.js server proxies sensitive requests (like image fetching) to bypass CORS and 403 Forbidden errors from third-party APIs.
- Next.js acts as the presentation layer, requesting aggregated, ranked data from the Python FastAPI backend.

### Caching Strategy
A triple-layered caching system is employed to maximize speed and minimize API costs (especially for Google Places API):
1. **Upstash Redis (Fast Cache):** Transient, highly requested data.
2. **PostgreSQL (Persistent Cache):** Handled via Prisma (e.g., `PlaceCache`, `PnrCache`).
3. **External API (Fallback):** Only triggered if TTL expires or data is missing.

*Cache Flow:*
```text
Request Data -> Check Redis 
   ├── [HIT] -> Return Data 
   └── [MISS] -> Check PostgreSQL (Prisma)
        ├── [HIT] -> Populate Redis -> Return Data
        └── [MISS] -> Call External API -> Save Postgres -> Save Redis -> Return Data
```

---

## 6. Database Design & Schema

The PostgreSQL database is managed via Prisma ORM. It captures user data, trip histories, cached responses, and transport schedules.

### Key Entities
- **User / Session / DailyUserStat:** Handles authentication, rate-limiting (e.g., `apiCallsFlights`), and daily metric tracking.
- **TripHistory:** Stores snapshotted JSONs of finalized itineraries.
- **Flight / Train / Bus / Hotel:** Aggregates and caches transport/accommodation options. Each has unique composite keys to prevent duplicate entries (e.g., `@@unique([hotel_id, city, check_in_date, check_out_date])`).
- **Transit Data (GTFS-like):** Models like `TransitStop`, `TransitRoute`, `TransitTrip`, and `TransitStopTime` handle underlying map routing and schedule topologies.
- **PlaceCache / Landmark:** Stores resolved points of interest and raw JSON responses from Google Places API to minimize expensive network calls.

### Entity Relationship Diagram (Textual)
```text
[User] 1 ----- * [Session]
  |
  +--- 1 ----- * [TripHistory]
  |
  +--- 1 ----- * [SavedPassenger]
  |
  +--- 1 ----- * [DailyUserStat]

[TransitRoute] 1 ----- * [TransitTrip]
[TransitCalendar] 1 -- * [TransitTrip]
[TransitTrip] 1 ------ * [TransitStopTime] * ------ 1 [TransitStop]
```

---

## 7. API Endpoints & Request/Response Flow (Assumed/Inferred)

### Core Flows
1. **`POST /api/v1/search/transport`**
   - **Inputs:** `origin`, `destination`, `date`, `passengers`.
   - **Logic:** `asyncio.gather()` triggers parallel scrapers for flights, trains, and buses. Applies comfort/safety scoring.
   - **Outputs:** Grouped JSON array of ranked transport modes.
2. **`GET /api/v1/places/discover`**
   - **Inputs:** `city`, `preferences` (nature, history), `lat/lon`.
   - **Logic:** Checks Redis -> Postgres `PlaceCache` -> Google Places API (requesting specific `fieldMask` like `location`, `rating`, `primaryType`).
   - **Outputs:** Ranked list of places.
3. **`POST /api/v1/ai/profile`**
   - **Inputs:** Passenger demographics, budget.
   - **Logic:** Routes to local Ollama LLM.
   - **Outputs:** Textual travel persona and recommendations.

---

## 8. Error Handling & Fallbacks

Robust fault tolerance is critical as third-party APIs are volatile:
- **Cabs (Nominatim/OSRM):** If geocoding fails, the backend intercepts the failure and falls back to a realistic mathematical estimate (e.g., assuming a 350km average distance, calculating standard tolls and driver allowances) ensuring UI continuity.
- **Buses:** Empty data from scrapers gracefully returns empty arrays instead of populating the UI with fake dummy data.
- **Hotels:** Proxy image endpoints strip strict headers; if thumbnails expire, the backend defaults to the `original_image` permanent URL.
- **Map Plotting:** The `CityAutocomplete` strictly awaits a fully resolved API response before updating global coordinates, preventing map tearing or infinite re-renders.

---

## 9. Data Validation & State Management

- **Data Validation:** Zod schemas integrated with React Hook Form ensure all user inputs (budgets, dates, ages) are strictly typed and validated before reaching the FastAPI backend.
- **State Sync (Infinite Render Prevention):** To prevent React infinite render loops during state hydration (e.g., when the itinerary store calculates commute times), raw array references are never used as dependency arrays. Instead, they are serialized into stable scalar strings (e.g., `places.map(p => p.id).join(',')`).

---

## 10. Module Breakdown

### 1. Transport Module
- **Purpose:** Provide ranked A-to-B transit options.
- **Dependencies:** RedBus scraper, IRCTC (Trains), Flight aggregators, OSRM.
- **Edge Cases:** API rate limits (handles via fallback math for cabs/buses).

### 2. Places & Itinerary Module
- **Purpose:** Time-bucket scheduling algorithm ensuring realistic daily pacing.
- **Logic (Smart Bucket-Scheduling):** 
  - Iterates over user-selected places.
  - Adds `visitDurationHours` + `travelTimeHours`.
  - Enforces a strict 8-hour fatigue cap per day.
  - Overflows remaining places to subsequent days or alerts the user if days run out.

### 3. The Purse Module
- **Purpose:** Live financial simulation.
- **Logic:** Dynamically subtracts costs (transport × pax, hotel × rooms, entry fees × pax) from the initial budget state.

---

## 11. Testing, Security & Scalability

### Security
- **Image Proxying:** Next.js `/api/proxy-image` masks origin requests, bypassing 3rd-party hotlinking prevention and CORS without exposing client IPs.
- **Legal Obfuscation:** White-labeled terms of service generalize raw data providers as "third-party aggregators" to maintain a premium facade.

### Performance & Scalability
- **TCP Optimization:** Global singleton HTTP clients prevent `TIME_WAIT` socket exhaustion.
- **Database Indexing:** Prisma schema indexes frequently queried fields (e.g., `@@unique([flight_no, origin, dest, dep_time, arr_time])` and `@@index([name])` on Landmarks) to maintain query speed as cache sizes grow.
- **Testing Strategy:** The `test_cabs.py`, `test_hotels.py`, and `test_opt.py` scripts form the basis of a suite to validate scraper reliability and math fallback logic. 

---

## 12. Conclusion & Review

### Summary of Architecture
PlanBro successfully decouples a highly interactive, state-heavy React frontend from a concurrent, I/O bound Python backend. By utilizing Zustand for transient state and Prisma/Redis for persistent caching, it achieves near-instantaneous UI feedback even when relying on slow external APIs.

### Technical Strengths
- **Fan-Out Concurrency:** `asyncio.gather()` drastically reduces wait times for parallel data streams.
- **Resilient Fallbacks:** Deterministic math fallbacks ensure the UI never breaks when external APIs fail.
- **Client-Side Compute:** Offloading the complex Time-Bucket Scheduling algorithm to the frontend (Zustand) reduces backend server load significantly.
- **Visual Polish:** Advanced GSAP/Three.js integration elevated by precise z-index and state management.

### Possible Improvements
- **Microservices:** Decouple the transport scrapers into independent serverless functions or microservices to scale them separately from the main FastAPI server.
- **WebSockets:** Implement WebSockets for live train tracking updates instead of REST polling.
- **Message Queue:** Integrate Redis Queue (RQ) or Celery for extremely long-running tasks like bulk itinerary PDF generation.

### What Makes This Project Strong
PlanBro is exceptionally strong because it prioritizes **graceful degradation**. It recognizes that external travel APIs are inherently flaky. Instead of passing errors to the user, it implements robust caching, intelligent proxying, and mathematical fallbacks to guarantee a seamless, premium experience regardless of upstream network conditions.
