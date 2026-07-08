// Smart activity ordering for Quick Trip
// Decides the best order to do a list of ad-hoc stops in a single day.

export type StopCategory = 'ACTIVE' | 'FOOD' | 'INDOOR_ENT' | 'CULTURAL' | 'SHOPPING' | 'OTHER';

export interface QuickStop {
  id: string;
  name: string;
  category: StopCategory;
  lat?: number;
  lng?: number;
  durationMins: number;
  /** For cinema/events: user picks a slot. Overrides smart ordering for this stop. */
  timeslot?: 'morning' | 'afternoon' | 'evening';
  placeData?: any;
}

/**
 * Each category has a preferred time window (hour in 24h).
 * Lower = earlier in the day.
 */
const CATEGORY_PREFERENCE: Record<StopCategory, number> = {
  ACTIVE:      8,   // Sports / outdoor — morning when energy is high
  CULTURAL:    9,   // Temples, monuments — cooler morning
  FOOD:        12,  // Lunch/dinner windows; will be re-adjusted based on neighbours
  INDOOR_ENT:  14,  // Cinema, bowling, museums — afternoon
  SHOPPING:    16,  // Markets, malls — afternoon/evening
  OTHER:       11,  // Default mid-morning
};

const TIMESLOT_HOUR: Record<string, number> = {
  morning:   9,
  afternoon: 14,
  evening:   19,
};

/**
 * Detect category from a raw place category string (from Google Places / our backend).
 */
export function detectCategory(rawCategory: string): StopCategory {
  const c = rawCategory.toLowerCase();
  if (/sport|gym|football|cricket|badminton|pool|bowling|fitness|yoga|park|ground/.test(c)) return 'ACTIVE';
  if (/restaurant|food|cafe|dhaba|biryani|bar|pub|bakery|dessert|sweet|snack|pizza|burger|tea|chai/.test(c)) return 'FOOD';
  if (/cinema|movie|theatre|pvr|inox|imax|multiplex|escape room|laser/.test(c)) return 'INDOOR_ENT';
  if (/temple|church|mosque|monument|museum|fort|palace|heritage|gallery|culture|historical/.test(c)) return 'CULTURAL';
  if (/mall|market|shop|store|bazaar|emporium/.test(c)) return 'SHOPPING';
  return 'OTHER';
}

/**
 * Greedy sort: fixed-timeslot stops anchor the schedule;
 * remaining stops sorted by category preference hour.
 * Ties broken by distance from previous stop (nearest-neighbour).
 */
export function smartSortStops(stops: QuickStop[]): QuickStop[] {
  if (stops.length <= 1) return stops;

  // Separate fixed (timeslot) vs. flexible
  const fixed = stops
    .filter(s => s.timeslot)
    .sort((a, b) => TIMESLOT_HOUR[a.timeslot!] - TIMESLOT_HOUR[b.timeslot!]);

  const flexible = stops.filter(s => !s.timeslot);

  // Sort flexible by category preference
  const sortedFlexible = [...flexible].sort((a, b) =>
    CATEGORY_PREFERENCE[a.category] - CATEGORY_PREFERENCE[b.category]
  );

  // Merge: insert fixed stops at the right position
  const result: QuickStop[] = [];
  let fixedIdx = 0;

  for (const stop of sortedFlexible) {
    // Insert any fixed stops that should come before this flexible stop
    while (
      fixedIdx < fixed.length &&
      TIMESLOT_HOUR[fixed[fixedIdx].timeslot!] <= CATEGORY_PREFERENCE[stop.category]
    ) {
      result.push(fixed[fixedIdx++]);
    }
    result.push(stop);
  }

  // Append remaining fixed stops
  while (fixedIdx < fixed.length) {
    result.push(fixed[fixedIdx++]);
  }

  // Adjust FOOD: if there are multiple food stops, spread them across lunch (13:00) and dinner (20:00) windows
  const foodStops = result.filter(s => s.category === 'FOOD');
  if (foodStops.length >= 2) {
    // Move the last food stop to end of order (dinner)
    const lastFood = result.lastIndexOf(foodStops[foodStops.length - 1]);
    const dinner = result.splice(lastFood, 1)[0];
    result.push(dinner);
  }

  return result;
}

/**
 * Given the sorted stops and a start time (default 9:00 AM),
 * compute each stop's arrival time and departure time.
 */
export function buildTimeline(
  stops: QuickStop[],
  travelMinsPerLeg: number[],
  startHour = 9
): Array<{ stop: QuickStop; arrivalTime: string; departureTime: string }> {
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const base = new Date();
  base.setHours(startHour, 0, 0, 0);
  let cursor = new Date(base);

  return stops.map((stop, i) => {
    // Add travel from previous stop
    if (i > 0) {
      const travelMins = travelMinsPerLeg[i - 1] || 10;
      cursor = new Date(cursor.getTime() + travelMins * 60000);
    }

    const arrival = new Date(cursor);
    cursor = new Date(cursor.getTime() + stop.durationMins * 60000);
    const departure = new Date(cursor);

    return {
      stop,
      arrivalTime: formatTime(arrival),
      departureTime: formatTime(departure),
    };
  });
}
