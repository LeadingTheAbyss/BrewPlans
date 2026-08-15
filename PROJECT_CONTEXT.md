# PROJECT_CONTEXT.md

## 1. Project Overview
BrewPlans is a comprehensive, unified travel planning platform designed to simplify the chaotic process of organizing trips with friends or family. It eliminates the need to cross-reference multiple tabs for flights, trains, cabs, hotels, and tourist attractions by aggregating these into a single, cohesive interface. The core problem it solves is the fragmentation and miscommunication in group travel planning by providing real-time data, AI-driven recommendations based on "vibes" or preferences, and a mathematically optimized daily itinerary planner. Currently, it appears to be in a polished production-ready MVP stage, featuring robust engineering optimizations and a highly visual user experience.

## 2. Tech Stack
- **Frontend Framework**: Next.js 16.2.9 (App Router) with React 19.2.4
- **Styling**: Tailwind CSS v4, `shadcn/ui` (v4.11.0)
- **State Management**: Zustand (v5.0.14) for global client-side state
- **Animations/Visuals**: GSAP (3.15.0), Framer Motion (12.40.0), Three.js (0.184.0), React-Globe.gl, Leaflet
- **Backend Framework**: FastAPI (Python 3.x)
- **Database**: PostgreSQL hosted on NeonDB
- **ORM**: Prisma (v6.0.0)
- **Caching**: Upstash Redis, NeonDB table caching
- **Auth Provider**: Google OAuth with Stateful Database Tokens (Custom UUID session implementation)
- **Hosting/Deployment**: Vercel (Frontend) and Render (Backend API)
- **Package Managers/Build Tools**: `npm` for Node packages, `pip` for Python, `next build`
- **AI/ML Models**: Groq Inference Engine running `openai/gpt-oss-120b` for trip recommendations

## 3. Architecture
- **High-Level System Diagram**: 
  Client (Next.js/React) ↔ Frontend API Routes / Server Actions ↔ FastAPI Backend (`api.py`) ↔ External Services / PostgreSQL / Redis.
- **Service/Module Responsibilities**:
  - `api.py`: The core FastAPI application that routes requests for optimization, AI recommendations, live transport APIs, and manages WebSocket connections for collaborative planning.
  - `routing_engine.py`: Runs an ALNS PC-VRPTW optimization solver to schedule daily itineraries based on distances and fatigue constraints.
  - `ranking_engine.py`: Scores and sorts transport, places, and hotels based on dynamic trip criteria (safety, cost, duration).
  - `ollama_engine.py`: Constructs LLM prompts for Groq and parses JSON responses to generate AI trip recommendations.
- **Service Communication**: Primarily REST HTTP requests between the Next.js client and FastAPI server, with direct DB queries via Prisma on the Node side. Real-time collaborative planning uses WebSockets (`/api/ws/plan/{plan_id}`).
- **Repository Structure**: Monorepo structure containing both the Next.js application (`src/app`) and the FastAPI application (root Python files and `services/`, `engines/`, `models/` directories).
- **Request Lifecycle (Recommend a Trip)**:
  1. User submits preferences (passengers, budget, days, vibe) via Next.js UI.
  2. Next.js fetches from FastAPI `/api/recommendations`.
  3. FastAPI calls `ollama_engine.py` (`recommend` function).
  4. Prompt is built injecting constraints and sent to Groq API.
  5. LLM responds with JSON containing exactly 10 matched destinations.
  6. Backend parses, calculates estimated fallback budgets, clamps to user maximums, and returns to Frontend.
  7. Frontend receives data and updates Zustand `tripStore`, rendering the recommendations grid.

## 4. Folder & File Structure
- `src/`: Next.js frontend code.
  - `src/app/`: Next.js App Router pages (`/plan`, `/recommend`, `/quick-trip`, `/profile`, `/pnr`).
  - `src/components/`: Reusable React components (`VisualJourneyMap.tsx`, `AnimatedGlobe.tsx`, `CinematicLoader.tsx`).
  - `src/store/`: Zustand state stores (`authStore.ts`, `itineraryStore.ts`, `tripStore.ts`, `budgetStore.ts`).
  - `src/lib/`: Frontend utilities and helpers.
- `prisma/`: Contains `schema.prisma` for PostgreSQL database schema and migrations.
- `services/`: Python modules for fetching and parsing external API data (`live_flights_api.py`, `live_trains_api.py`, `google_places_api.py`, `routing_engine.py`).
- `engines/`: Core logic engines for ranking, routing, and AI integration (`ollama_engine.py`, `ranking_engine.py`, `safety_engine.py`).
- `models/`: Python Pydantic or Data class definitions (`entities.py`, `state.py`, `enums.py`).
- `data/`: Local static data (e.g. `schedules.json` for trains).
- **Naming Conventions**: PascalCase for React components (`LeafletMap.tsx`), snake_case for Python modules and backend logic (`routing_engine.py`), camelCase for TypeScript utilities and Zustand stores (`tripStore.ts`).

## 5. Data Models & Schema
**Core Tables (PostgreSQL)**:
- `User`: `id`, `email`, `name`, `picture`, various `apiCalls` counters (rate limiting), `lastApiCallDate`. 1:Many with `Session`, `TripHistory`, `SavedPassenger`.
- `Session`: `id`, `userId`, `token` (Opaque UUID), `expiresAt`. Ensures stateful authentication.
- `Flight`, `Bus`, `Train`, `Hotel`: Caching tables for live transport and accommodation searches. Fields include standard descriptors (`origin`, `dest`, `price`, `arr_time`, `rating`). Uniquely indexed by composite keys to avoid duplication.
- `PlaceCache`: Stores raw JSON from Google Places API (using `cacheKey`) to save on expensive API calls.
- `TripHistory`: Stores JSON snapshots of generated itineraries for users.
- `DailyUserStat`, `DailySystemStat`, `TelemetryLog`, `SystemAnomaly`: Robust logging tables for analytics, API cost estimation, latency spikes, and funnel tracking.
- `Article`: Schema for blog posts containing rich media and itinerary metadata.
- **Relationships**: Mostly 1:Many (User -> Sessions/Histories). Transit tables (`TransitRoute`, `TransitStop`, `TransitTrip`, `TransitStopTime`) follow standard GTFS relational structures.
- **Indexes**: Strategic indexes on `userId`, `cacheKey`, `createdAt`, `endpoint`, and composite unique constraints on transport modes to ensure upsert integrity.
- **Design Tradeoffs**: Storing `stateJson` in `AppState` and `snapshot` in `TripHistory` as raw JSON strings/JSONB. This denormalization trades queryability of individual itinerary items for speed and ease of saving/loading complex Zustand store states.

## 6. API Surface
- **FastAPI Endpoints**:
  - `POST /api/optimize_itinerary`: Accepts places, day count, passengers; returns mathematically optimized daily clusters.
  - `GET /api/transport`: Fetches routes (flights, trains, cabs, buses) between `source` and `destination`. Handles `check_only` for cache polling.
  - `GET /api/places`, `GET /api/food`, `GET /api/hotels`: Fetches and ranks points of interest using Google Places/SerpAPI, heavily leveraging PostgreSQL/Redis caching.
  - `POST /api/recommendations`: Triggers LLM generation for trip ideas based on a "vibe" and constraints.
  - `GET /api/search-city`: Autocomplete city search blending Ola Maps API and Open-Meteo as fallback.
  - `WS /api/ws/plan/{plan_id}`: WebSocket endpoint for real-time collaborative drag-and-drop itinerary planning (max 15 users).
- **External Third-Party APIs**:
  - *Google Places API*: Primary POI and photo data (Production, expensive, heavily cached).
  - *Groq (openai/gpt-oss-120b)*: AI Recommendations. Handled with a robust 9-key rotation fallback mechanism.
  - *SerpAPI (Google Hotels)*: Hotel pricing and availability.
  - *RailRadar*: Live train schedules and routes.
  - *Parse.bot*: Scraping redBus for bus schedules (Production, somewhat flaky for long trips).
  - *OSRM*: Used for distance calculation and cab pricing estimates.
  - *Ola Maps / Open-Meteo*: City autocompletion and geocoding.

## 7. Core Business Logic
1. **Itinerary Optimization Solver (`routing_engine.py`)**: 
   An ALNS (Adaptive Large Neighborhood Search) PC-VRPTW (Prize-Collecting Vehicle Routing Problem with Time Windows) metaheuristic solver. It clusters places geographically and temporally. 
   - *Clever feature*: It dynamically calculates a `fatigue_cap_mins` based on passenger demographics (e.g., Toddlers get 300 mins, Adults 480 mins). It applies soft time windows for meals (Breakfast 7-10am, etc.) and penalizes "time warps" or exceeding fatigue caps. It runs strictly under 500ms for UI responsiveness.
2. **Cross-Routing / Multi-Modal Transport (`cross_routing_engine.py`)**:
   If direct transport fails, it calculates multi-leg journeys (e.g., Train then Flight) to connect obscure cities.
3. **LLM Prompt Engineering (`ollama_engine.py`)**: 
   Translates user preferences into explicit prompt constraints. It calculates realistic cost floors using hardcoded category baselines (e.g. mountains=2500/day) to prevent the LLM from hallucinating impossibly cheap budgets.
4. **Ranking Engine (`ranking_engine.py`)**:
   Scores transport options mathematically: `Score = (20 - duration) * 2 + (10000 - price)/1000 + safety_score * 2`. It actively penalizes bus travel by -20 points if elderly passengers are detected.

## 7A. UI/UX Implementation Detail
- **Cinematic Interactions**: The app employs GSAP and Framer motion heavily. `HeroPlane.tsx` and `AnimatedGlobe.tsx` (using `react-globe.gl` and `three.js`) provide immediate visual "wow" factor on load. 
- **Interactive Maps**: `VisualJourneyMap.tsx` and `AnimatedJourneyMap.tsx` utilize `react-leaflet` to draw dynamic pathing (contrails/routes) between destinations.
- **Collaborative Drag-and-Drop**: WebSockets are tied into `@dnd-kit` to allow multiple users in a room to drag and drop itinerary items between days simultaneously (`itineraryStore.ts` syncs this state).
- **State Management**: Extensively uses Zustand slices (`itineraryStore`, `budgetStore`, `tripStore`). The state is divided logically (local component state for UI toggles, global Zustand for trip data, server state managed via `react-query` or custom fetch wrappers).
- **Design System**: Built on `shadcn/ui` with Tailwind CSS, utilizing a specific color palette defined in `globals.css` with seamless dark mode support (`next-themes`).

## 7B. AI/ML Implementation Deep Dive
- **Provider & Model**: Groq inference engine running `openai/gpt-oss-120b` (via `/api/recommendations`). Chosen for its strict JSON adherence and reasoning capabilities over smaller models.
- **Prompt Engineering**: The prompt (`ollama_engine.py`) dynamically injects "guidance rules" (e.g., injecting specific cities based on regex matches for keywords like "veg" or "mountains"). It strictly forces the model to return exactly 10 destinations in India (excluding foreign lookalikes) and forces a specific JSON schema.
- **Error Handling/Resilience**: Because Groq rate limits are aggressive, `ollama_engine.py` implements a 9-key round-robin rotation (`GROQ_API_KEY_1` to `9`). If a 429 error occurs, it instantly falls back to the next key. If all fail, it returns a safe fallback JSON object so the UI doesn't crash.
- **Evaluation**: The LLM outputs are post-processed; budgets are clamped to the user's hard limit, and city names are deduplicated to ensure 10 distinct results.

## 7C. What Makes This Project Impressive
- **[Engineering] Custom ALNS PC-VRPTW Solver in Python**: Implementing a Simulated Annealing routing algorithm that calculates dynamic fatigue limits based on the age of travelers, applies soft meal-time windows, and runs in under 500ms is highly sophisticated compared to standard CRUD apps.
- **[Engineering] Multi-Tiered Caching Strategy**: The app uses an intelligent waterfall: Upstash Redis -> NeonDB caching tables -> External APIs. This is a robust approach to heavily limit API costs (especially for Google Places) and decrease latency.
- **[Product/UX] Real-Time Multiplayer Itinerary Planning**: Implementing WebSocket-driven synchronization with `@dnd-kit` so multiple users can concurrently drag and drop places across an itinerary timeline is extremely difficult to get right without race conditions.
- **[AI/Engineering] Groq API Key Round-Robin**: A highly pragmatic, hacker-style solution to circumvent free-tier rate limits on Groq by catching 429 errors and silently rolling over through 9 different API keys, ensuring high uptime for the AI features.
- **[UX Polish] 3D and Canvas Data Visualization**: Utilizing WebGL via `three.js` and custom Canvas/SVG implementations for contrails and globes makes the app feel premium and cinematic rather than a standard form-based booking site.

## 8. Auth & Security
- **Auth Flow**: Google OAuth is used. Instead of issuing a Stateless JWT, the backend issues an Opaque Token (a secure random UUID) stored in the `Session` table on NeonDB and sent to the client as an HTTP-only secure cookie (`brewplans_session`).
- **Security Posture**: Highly secure session management (allows instant revocation of compromised accounts). 
- **Gaps/Shortcuts**: The presence of `GROQ_API_KEY_1` through `9` and multiple `PARSE_API_KEY`s in `.env` suggests free-tier abuse/shortcuts typical of a hackathon or bootstrapped MVP.

## 9. Environment Variables & Config
- `DATABASE_URL`: Connection string to NeonDB.
- `UPSTASH_REDIS_REST_URL` & `TOKEN`: Upstash Redis connection.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Google OAuth.
- `NEXT_PUBLIC_GOOGLE_PLACES_KEY`: Client and server-side Google Places fetching.
- `SERPAPI_HOTELS_KEY` (1-6): Rotated SerpAPI keys for Google Hotels.
- `RAILRADAR_API_KEY` (1-8): Rotated keys for train data.
- `PARSE_API_KEY` (1-7): Rotated keys for RedBus scraping.
- `GROQ_API_KEY_` (1-9): Rotated keys for Llama AI requests.
- `OLA_MAPS_API_KEY`: For city autocomplete.
- `R2_*` variables: Cloudflare R2 bucket for image uploads/storage.

## 10. Third-Party Integrations & Dependencies
- **Groq**: Production AI inference. Highly reliable via key rotation.
- **Google Places API**: Production POI data. Expensive, aggressively cached.
- **SerpAPI (Google Hotels)**: Production, but limited by free tier.
- **RailRadar**: Live train data. Reliable.
- **Parse.bot**: Scrapes redBus. Acknowledged in README as flaky for long trips.
- **OSRM**: Open source routing, reliable for cab pricing math.
- **Open-Meteo**: Fallback geocoding if Ola Maps fails.

## 11. Known Issues, Tech Debt & Shortcuts
- **Free-Tier Key Juggling**: The reliance on massive arrays of free-tier keys (SerpAPI, RailRadar, Groq, Parse) is fragile and will break under sustained, real-world scaling.
- **Inaccurate Flights**: Flight data relies on hardcoded DGCA schedules rather than live pricing, meaning flight prices are estimates, not bookable fares.
- **Bus Scraper Flakiness**: Parse.bot fails on longer bus routes.
- **Hotel Limitations**: Unable to fetch accurate check-in/out times or room occupancy limits from SerpAPI, forcing a hardcoded assumption of 3 people per room max.

## 12. Testing & Quality
- **Testing**: Extremely limited automated testing. The codebase contains root-level Python test scripts (`test_api.py`, `test_hotels.py`, `test_recommend.py`) which appear to be manual, one-off sanity checks rather than an automated `pytest` or `jest` suite. No CI/CD testing pipeline is evident.
- **Linting**: Standard ESLint (`eslint.config.mjs`) and TypeScript type-checking setup for Next.js.

## 13. Deployment & Infra
- **Frontend**: Deployed on Vercel (benefits from Next.js serverless functions and edge caching).
- **Backend**: Deployed on Render (hosts the FastAPI Python server).
- **Database**: NeonDB (Serverless Postgres) scales compute to zero when inactive. Upstash for serverless Redis.
- **State**: No explicit CI/CD pipelines defined beyond Vercel's default GitHub integration.

## 14. Roadmap / Next Steps
- **API Migration**: Transition away from hacky rotating free-tier API keys to enterprise APIs (e.g., Amadeus for flights, official IRCTC API) to improve reliability.
- **Scaling Backend**: The stateless FastAPI backend will require a load balancer to distribute traffic if user count surges.
- **Database Expansion**: Caching table sizes will grow rapidly with user searches, requiring storage scaling on NeonDB.

## 15. Glossary
- **ALNS PC-VRPTW**: Adaptive Large Neighborhood Search / Prize-Collecting Vehicle Routing Problem with Time Windows. The algorithm used to schedule the trip itinerary.
- **Opaque Tokens**: Stateful database tokens (UUIDs) used instead of standard JWTs for better security and revocability.
- **DGCA**: Directorate General of Civil Aviation. Their static schedule data is used as a fallback for flight routing.
- **DBSCAN**: Density-Based Spatial Clustering of Applications with Noise (mentioned in README as the former spatial clustering algorithm, now upgraded to ALNS).
