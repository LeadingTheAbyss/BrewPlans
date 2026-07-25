# BrewPlans (Tripal) - Premium Travel Itinerary Planner

## 🎯 What is the Purpose?
BrewPlans (also known as Tripal) is an advanced, full-stack travel itinerary planner designed to remove the friction from planning trips. okInstead of keeping a million tabs open for flights, trains, hotels, and attractions, this platform consolidates everything into a single, seamless, and visually stunning experience.

It takes user preferences—such as source, destination, travel dates, passenger details, and a total budget—and generates a highly optimized, fully ranked itinerary. It intelligently calculates the best transport modes, fetches real-time places of interest, retrieves live images, and even provides AI-driven recommendations based on the travel group's profile.

---

## ✨ What Features Are There?
The project is packed with dynamic, real-time, and interactive features:

1. **Premium 3D Animated Landing Experience:**
   - Utilizes GSAP scroll triggers and Three.js for a highly interactive, parallax-driven 3D airplane flight simulation on the homepage.
2. **Real-Time Transport Aggregation:**
   - Simultaneously fetches and ranks Flights, Trains, Buses, and Cabs using parallel asynchronous requests.
   - Calculates comfort, safety, and recommendation scores for every transport option.
3. **Live Train Tracking & Routes:**
   - Dedicated API routes to fetch live train statuses, station boards, and real-time routes.
4. **Dynamic Place Discovery & Ranking:**
   - Discovers places using live geospatial APIs (like Overpass API).
   - Dynamically ranks places based on real-time factors: Weather (Sunny, Rainy, etc.), Safety scores, and Crowd estimates.
   - Automatically fetches real images for these places concurrently using DuckDuckGo image search.
5. **Smart Hotel Recommendations:**
   - Ranks hotels based on distance to destination clusters, price per night, safety, and comfort.
6. **AI-Powered Recommendations:**
   - Integrates with local LLMs (via Ollama) to generate customized recommendations based on the passenger group (e.g., family vs. solo) and budget constraints.
7. **Interactive Itinerary Builder:**
   - Features a drag-and-drop UI (using `dnd-kit`) to let users manually adjust their travel timelines.
8. **Live Budget Tracking ("The Purse"):**
   - Real-time budget simulation that subtracts transport, place entry fees, and hotel costs from the user's total budget as they plan.

---

## 🛠️ What Technologies Are Used?

The project employs a modern, bleeding-edge tech stack separated into a robust backend and a highly interactive frontend.

### Frontend Technologies:
- **Core Framework:** Next.js (v16.2.9) with App Router, React 19, and TypeScript.
- **Styling & UI:** Tailwind CSS v4, Shadcn UI, and Base UI for highly customizable, accessible components.
- **Animations & 3D:** GSAP (GreenSock) for complex scroll animations and parallax effects, Three.js for rendering the 3D airplane, and Framer Motion for micro-interactions.
- **State Management:** Zustand for global state (like managing "The Purse" and selected trip items).
- **Forms & Validation:** React Hook Form coupled with Zod for strict schema validation.
- **Interactivity:** `@dnd-kit` for drag-and-drop itinerary management, React Query for frontend data fetchinwritg and caching.

### Backend Technologies:
- **Core Framework:** FastAPI (Python) running on Uvicorn for ultra-fast, asynchronous API handling.
- **Concurrency:** Extensive use of Python's `asyncio` (`asyncio.gather`, `asyncio.to_thread`) to parallelize heavy network I/O tasks (like fetching transport and images simultaneously).
- **Database & Caching:** Prisma ORM for database schemas, PostgreSQL (accessed via `asyncpg`), and Upstash Redis for caching live API responses.
- **AI Integration:** Ollama Engine for localized, cost-effective LLM processing.
- **External Data Sources:** Overpass API for geographic data, various live transport APIs, and image scraping services.

---

## 🔧 How Do We Fix It? (Common Architecture & UI Fixes)

During development, several complex issues typically arise that require specific architectural fixes:

### 1. I/O Bottlenecks in the Backend
**The Problem:** Fetching flights, trains, buses, and live place images sequentially takes too long, resulting in severe API latency.
**The Fix:** We completely eliminated sequential blocking by refactoring the backend to use Python's `asyncio.gather()`. This creates a Fan-Out/Fan-In architecture where all external API requests (e.g., fetching 20 place images) are dispatched simultaneously in parallel, dramatically cutting down response times without needing heavy message brokers like Celery.

### 2. GSAP Parallax Stacking Contexts (Z-Index Issues)
**The Problem:** Complex scroll animations often result in elements washing out or hiding behind others. For example, a parallax sky background with clouds might render *in front of* the main text, making the text invisible.
**The Fix:** GSAP `transform` animations create new CSS stacking contexts. To fix this, you must explicitly force the text containers to jump out of the local stacking context by using `position: relative` combined with a high `z-index` (e.g., `z-50`). Furthermore, forcing text colors via inline styles (`style={{ color: 'black' }}`) ensures they bypass any conflicting CSS frameworks or dark-mode overrides (like Shadcn's ThemeProvider or browser extensions like Dark Reader).

### 3. Tailwind v4 and Dynamic Overrides
**The Problem:** Tailwind arbitrary values (like `text-[#151515]`) sometimes conflict with global CSS files or Next.js themes.
**The Fix:** For critical UI elements in GSAP animations, bypassing the CSS compiler using raw inline React styles is the most foolproof method. Always ensure `globals.css` uses `@layer base` properly to avoid specificity wars.

### 4. React Infinite Render Loops
**The Problem:** Updating global state inside a `useEffect` based on a fetched result (e.g. updating the itinerary store with commute times) causes the parent component to re-render. This re-render creates fresh array references for child props (like `places`). If the child's `useMemo` or `useEffect` depends on the raw array reference, it interprets it as a "new" change, triggers a re-fetch, and falls into a flashing infinite loop.
**The Fix:** Never use raw array or object references as dependencies if they are derived on each render. Instead, serialize the contents into stable scalar keys (e.g. `const placesKey = places.map(p => p.id).join(',')`) and depend on those string keys. This ensures `useMemo` holds the same reference across unrelated re-renders.

### 5. Smart Itinerary & Zustand State Sync
**The Architecture:** The backend LLM (Ollama) is **strictly** used for generating high-level text recommendations and descriptive profiles. The actual step-by-step timeline scheduling is handled entirely on the client-side via **Zustand stores** (e.g., `itineraryStore.ts` and `tripStore.ts`). Zustand acts as an in-browser shared database that instantly syncs data between unmounted/mounted pages (like setup -> review) without prop drilling, and it persists the user's progress to local storage.
**Smart Arrival Logic:** To make the itinerary highly realistic, the Visual Journey Map dynamically reads the user's selected inbound transport (flight/train/bus) from the Zustand trip store. On Day 1, instead of starting at a hardcoded 9:00 AM, it calculates the timeline start time based on the exact transport arrival time + a 2-hour buffer for hotel check-in and rest.
### 6. Passenger Grouping & HMR Stability
**The Problem:** Hot Module Replacement (HMR) in Next.js can crash the Webpack dev server if a child component's prop signature is structurally changed (e.g., from `passenger={pax}` to `passengers={[pax]}`) while the parent page hasn't yet recompiled. This throws an `Uncaught TypeError: undefined is not iterable` and breaks the fast refresh cycle.
**The Fix:** We implemented defensive fallback logic inside child components (`passengers || []`) and spread props (`{...props}`) to safely gracefully degrade if it temporarily receives old prop structures during a hot-reload cycle. 
**Passenger Grouping Feature:** In the Review UI, we now use memoized mapping to group passengers who share the exact same starting city and transport mode into a single unified `MemberTravelCard`, joining their names and stacking their avatars to heavily declutter the UI.

### 7. Global Locale & Math Scaling
**The Problem:** Default JavaScript `.toLocaleString()` outputs numbers in the Western/Million format (e.g., `100,000`), and basic itinerary math often assumes costs are flat rates instead of per-passenger or per-room rates.
**The Fix:** 
- **Indian Locale:** We explicitly pass `'en-IN'` to all `toLocaleString()` calls across the entire App Shell, review cards, and planner pages to render large numbers in the Lakh/Crore format (e.g., `1,00,000`).
- **Group Math:** Food entry fees are now correctly multiplied by the `passengers.length`. For hotels, we automatically enforce a standard `3 people = 1 room` rule using `Math.ceil(paxCount / 3)` and multiply `pricePerNight * rooms * nights` so that the UI correctly scales real-world hotel costs.

### 8. Backend Fault Tolerance (Buses, Cabs, Hotels, Map)
**The Problem:** Third-party APIs (like SerpAPI, Nominatim, OSRM) frequently fail, rate-limit (403 Forbidden), or return empty coordinates, completely breaking the frontend rendering.
**The Fix:**
- **Hotels:** SerpAPI proxy image thumbnails expire quickly and throw 403s. We switched to pulling the `original_image` node, which provides the permanent, direct source URL for hotel photos.
- **Cabs:** If the Nominatim geocoder fails to resolve a city (like "Patiala") and OSRM crashes, the Python backend intercepts the failure and falls back to a realistic "2026 Cab Math" standard (e.g., assuming an average 350km distance and calculating tolls/driver allowance) so cabs *always* gracefully render in the UI.
- **Buses:** Removed hardcoded dummy buses from the RedBus scraping pipeline. Now, if the live scraper genuinely finds zero buses, it accurately returns an empty array instead of polluting the UI with fake data.
- **Interactive Map:** The Haversine distance formula was moved directly into the Hotel frontend, allowing it to dynamically average the exact distance from each hotel to the specific GPS coordinates of the user's selected places in the `itineraryStore`. Furthermore, the `CityAutocomplete` was detached from firing map updates on every keystroke, forcing the globe to only update after the city is 100% resolved from the API dropdown.

### 9. Bypassing Third-Party Image Hotlinking (CORS/403)
**The Problem:** Direct fetching of hotel images from external Online Travel Agencies (OTAs) like Expedia and Booking.com often fails on the frontend due to strict CORS policies and `Referer` / `User-Agent` checks, resulting in broken image placeholders.
**The Fix:** We implemented a server-side proxy route in Next.js (`/api/proxy-image`). The Python backend routes all sensitive third-party image URLs to this Next.js endpoint, which then fetches the image using a generic User-Agent and streams the raw byte buffer directly to the client, effectively masking the origin and bypassing 403 Forbidden errors.

### 10. Preventing TCP Socket Exhaustion (WinError 10055)
**The Problem:** High-concurrency operations, such as typing in the `CityAutocomplete` (which fired multiple API requests) and Redis caching (which opened a new connection for every GET/SET), resulted in thousands of transient sockets left in the `TIME_WAIT` state, eventually exhausting available TCP ports and crashing Uvicorn.
**The Fix:** We implemented global connection pooling across the Python backend. Synchronous requests (like Open-Meteo city searches and Ola Maps) now use a shared `requests.Session()`, while asynchronous Redis calls utilize a singleton `httpx.AsyncClient`. This enforces HTTP Keep-Alive, drastically reducing overhead and completely eliminating socket leakage.

### 11. Google Places API Integration & Extracted Info
**The Architecture:** The app uses the New Google Places API (REST) via `services/google_places_api.py`. To aggressively minimize costs and maximize speed, it uses a triple-layered caching system: `Redis (Fast Cache) -> PostgreSQL (Persistent Cache) -> Google API`.
**Data Retrieved:** When fetching places of interest, the API strictly requests the following fields via a `fieldMask`:
- `id`: Google Place ID (ChIJ...)
- `displayName`: The official name of the place
- `formattedAddress`: The full physical address
- `rating`: Star rating out of 5.0
- `userRatingCount`: The total number of reviews (used for our Bayesian weighted ranking)
- `photos`: specifically the `photo_reference` which is later resolved to a Google Image URL
- `location`: Exact GPS Latitude and Longitude (used for map plotting and Haversine distance calculations)
- `primaryType`: The category (museum, park, restaurant, historical_landmark)
- `priceLevel`: Helps categorize budget constraints

### 12. Smart Itinerary Bucket-Scheduling Algorithm
**The Architecture:** The "Smart Itinerary" feature (`autoSchedule` in `itineraryStore.ts`) operates strictly on the frontend. It is NOT powered by Ollama. 
**The Logic:** It acts as a **Time-Bucket Scheduling Algorithm**:
1. **Gathers Unassigned Places:** Looks at the global bag of user-selected places and filters out already scheduled ones.
2. **Calculates Total Time:** Calculates `placeTime` by adding `visitDurationHours` + `travelTimeHours`.
3. **The 8-Hour Rule (Fatigue Cap):** Treats each trip day as a chronologically ordered bucket with a strict 8-hour limit to prevent physical exhaustion.
4. **Greedy Packing:** Drops places into Day 1 until adding the next place would push the schedule past 8 hours, at which point it automatically overflows into Day 2.
5. **Force-Packing:** If the user selects too many places and runs out of days entirely, it forces the remaining places into the final day and triggers a UI warning state: `"This day is getting too packed (>8 hours)"`.

### 13. Component Uniformity & Legal Obfuscation
**The UI Push:** We iteratively unified the design language across the application. For instance, the Hotel cards on the `/plan/hotels` route were completely overhauled to match the premium, responsive row-column layout of the `/plan/review` cards, exposing critical data like `SafetyScore` and `ComfortScore` immediately. 
**The Legal Push:** To maintain a highly premium and somewhat white-labeled feel, the Privacy Policy and Terms of Service documents dynamically describe data flow without explicitly naming raw infrastructure providers (like Google, SerpApi, Ola, Open-Meteo, and IRCTC), instead referring to them as "third-party data partners, transport operators, and booking aggregators."

### 14. Quick Trip Architecture & Smart Timelines
**The Feature:** We introduced "Quick Trip", a single-page, hyper-fast itinerary generator strictly designed for 1-day city visits and group meetups.
**The Architecture:** 
- It bypasses the multi-step wizard and instead uses a localized state to instantly calculate commuting logic. 
- It features an **Intelligent Timeline Builder** that takes a base arrival time and sequentially loops through an array of custom `Stops`. For each stop, it calculates the exact travel time (using Ola Maps distance + average city speeds) and adds it to the user's selected stop duration (e.g., 60 mins for a park), chaining them chronologically.
- A dynamic Leaflet map (`QuickTripMapInner`) plots all members, a central meeting point, and the ordered stops using customized SVG markers.

### 15. Universal Share Links & State Hydration
**The Problem:** Users wanted to share their exact trip itinerary with friends who don't have an account, but the entire app's logic lived inside the local browser memory (Zustand).
**The Fix:** 
- We refactored `/api/trips/[id]/route.ts` to allow public `GET` access for shared trip IDs.
- Whenever a user clicks "Share Plan", the frontend packages the entire `tripStore`, `itineraryStore`, and `budgetStore` (or local Quick Trip state) into a massive JSON `snapshot` and saves it to the PostgreSQL database.
- It generates a Universal Link (e.g., `?id=xyz`). When a guest opens this link, the page detects the query parameter, fetches the snapshot from the backend, and perfectly **hydrates** the Zustand stores, instantly recreating the exact UI state for the guest without requiring authentication.

### 16. High-Performance PDF Generation Pipeline
**The Problem:** The client-side PDF export (using `html-to-image` and `jspdf`) was generating colossal 350MB+ PDF files that crashed browsers, and the embedded Leaflet maps were rendering completely distorted.
**The Fix:**
- **Map Distortion Fix:** Leaflet uses hardware-accelerated 3D CSS transforms (`translate3d`) by default, which the HTML canvas renderer cannot parse. We bypassed this by setting `L.Browser.any3d = false` right before map initialization, forcing Leaflet to use standard 2D `top/left` positioning, which snapshots perfectly.
- **Size Bottleneck Fix:** Capturing the DOM as raw 3x scale PNGs caused the massive file sizes. We switched the pipeline to `.toJpeg()` with an 80% quality factor, reduced the pixel ratio to 2x, and used jsPDF's `FAST` compression algorithm. This reduced the 350MB files to just ~3MB with zero noticeable loss in visual clarity.
- **Hidden Render Container:** To ensure the map tiles and external images are fully loaded before capture, we render a pristine, print-ready version of the itinerary in an absolute hidden `#pdf-content` container off-screen.

### 17. UI Polish & API Resilience
- **Toast Notifications:** Replaced jarring browser `alert()` popups with sleek, Framer Motion animated Toast notifications (green tickboxes) globally for actions like copying links.
- **RailRadar API Fallbacks:** Fixed live train failures (e.g., `LKO-JP`) by expanding the `STATION_CLUSTERS` dictionary (mapping Jaipur to both `JP` and `JAI`) and dynamically increasing the fallback loop limit. If the RailRadar API rejects a specific station code combination, the backend aggressively retries alternate station codes until it successfully returns live trains.
