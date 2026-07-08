'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Plus, Trash2, MapPin, Users, ArrowRight, Sparkles,
  Clock, Car, Bike, Map, ChevronDown, ChevronUp, X, Loader2,
  Zap, Search, GripVertical, Share2, RotateCcw
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getDistanceInKm, calculateCost } from '@/lib/travelCost';
import { detectCategory, smartSortStops, buildTimeline, QuickStop, StopCategory } from '@/lib/quickTripSorter';
import { getAvatarHex } from '@/components/QuickTripMapInner';
import { api } from '@/lib/api';

const QuickTripMapInnerDynamic = dynamic(
  () => import('@/components/QuickTripMapInner'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#111] flex items-center justify-center text-zinc-500 font-medium text-sm">
        Loading Map...
      </div>
    ),
  }
);

// ─── Types ───────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  name: string;
  location: string; // city / neighbourhood they're starting from
  lat?: number;
  lng?: number;
}

interface PlaceResult {
  id: string;
  name: string;
  category: string;
  lat?: number;
  lng?: number;
  rating?: number;
  entryFee?: number;
}

interface ActiveStop extends QuickStop {
  placeResult: PlaceResult;
  customDuration?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
  { label: '1.5 hr', value: 90 },
  { label: '2 hr', value: 120 },
  { label: '3 hr', value: 180 },
];

const TIMESLOT_OPTIONS = [
  { label: 'Morning', value: 'morning' as const },
  { label: 'Afternoon', value: 'afternoon' as const },
  { label: 'Evening', value: 'evening' as const },
];

const CATEGORY_LABELS: Record<StopCategory, string> = {
  ACTIVE: 'Sports / Outdoor',
  FOOD: 'Food & Drinks',
  INDOOR_ENT: 'Entertainment',
  CULTURAL: 'Culture & Heritage',
  SHOPPING: 'Shopping',
  OTHER: 'Other',
};

const CATEGORY_COLORS: Record<StopCategory, string> = {
  ACTIVE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  FOOD: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  INDOOR_ENT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CULTURAL: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  SHOPPING: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  OTHER: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

// Geocode a city name using our backend search
async function geocodeCity(cityName: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const results = await api.searchCity(cityName);
    if (results.length === 0) return null;
    const coords = results[0].osrm_coords;
    if (!coords) return null;
    const [lng, lat] = coords.split(',').map(Number);
    return { lat, lng };
  } catch {
    return null;
  }
}

// ─── Place Search Dropdown ────────────────────────────────────────────────────

function PlaceSearchBox({
  city,
  onSelect,
}: {
  city: string;
  onSelect: (place: PlaceResult) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await api.olaSearch(query, city);
        setResults(data.slice(0, 10));
        setIsOpen(true);
      } catch (err) {}
      finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [query, city]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (e.target.value.length >= 3) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelect = (place: PlaceResult) => {
    onSelect(place);
    setQuery('');
    setIsOpen(false);
    setResults([]);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 focus-within:border-emerald-500/60 transition-colors">
        <Search size={15} className="text-zinc-500 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder={city ? `Search places in ${city}…` : 'Enter city first'}
          disabled={!city}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
        />
        {loading && <Loader2 size={14} className="text-zinc-500 animate-spin shrink-0" />}
      </div>

      {isOpen && query.length >= 3 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {results.length > 0 ? (
            results.map(place => {
              const cat = detectCategory(place.category || '');
              return (
                <button
                  key={place.id}
                  onClick={() => handleSelect(place)}
                  className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0 flex items-center gap-3"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${cat === 'FOOD' ? 'bg-amber-400' : cat === 'ACTIVE' ? 'bg-orange-400' : cat === 'INDOOR_ENT' ? 'bg-blue-400' : 'bg-green-400'}`} />
                  <div>
                    <div className="text-sm font-medium text-white">{place.name}</div>
                    <div className="text-xs text-zinc-500 capitalize">{place.category}</div>
                  </div>
                </button>
              );
            })
          ) : (
            !loading && (
              <div className="px-4 py-3 text-sm text-zinc-500 text-center">
                No places found matching "{query}" in this area.
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuickTripPage() {
  const router = useRouter();
  const { user, fetchUser } = useAuthStore();

  useEffect(() => { fetchUser(); }, [fetchUser]);

  // Redirect to login if not logged in
  useEffect(() => {
    if (user === null) {
      // Give it a moment to hydrate
      const t = setTimeout(() => {
        if (!useAuthStore.getState().user) {
          router.push('/login?redirect=/quick-trip');
        }
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [user, router]);

  // ── State ──
  const [city, setCity] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<{ name: string; state: string }[]>([]);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const cityWrapperRef = useRef<HTMLDivElement>(null);

  const [members, setMembers] = useState<Member[]>([
    { id: 'member-1', name: '', location: '' },
    { id: 'member-2', name: '', location: '' },
  ]);

  const [meetAtSomeone, setMeetAtSomeone] = useState(false);
  const [meetingMemberId, setMeetingMemberId] = useState<string>('member-1');

  const [stops, setStops] = useState<ActiveStop[]>([]);
  const [autoSorted, setAutoSorted] = useState(false);

  // ── City Autocomplete ──
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cityWrapperRef.current && !cityWrapperRef.current.contains(e.target as Node)) {
        setCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (cityQuery.length < 2) { setCityResults([]); return; }
    const t = setTimeout(async () => {
      const results = await api.searchCity(cityQuery);
      setCityResults(results.slice(0, 6));
      setCityDropdownOpen(true);
    }, 400);
    return () => clearTimeout(t);
  }, [cityQuery]);

  const selectCity = (name: string) => {
    setCity(name);
    setCityQuery(name);
    setCityDropdownOpen(false);
  };

  // ── Members ──
  const addMember = () => {
    setMembers(prev => [...prev, { id: `member-${Date.now()}`, name: '', location: '' }]);
  };

  const removeMember = (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
    if (meetingMemberId === id) setMeetingMemberId(members[0]?.id || '');
  };

  const updateMember = (id: string, field: keyof Member, value: string) => {
    setMembers(prev => prev.map(m => {
      if (m.id === id) {
        const updated: any = { ...m, [field]: value };
        if (field === 'location') {
          updated.lat = undefined;
          updated.lng = undefined;
        }
        return updated;
      }
      return m;
    }));
  };

  // ── Stops ──
  const handleAddStop = useCallback((place: PlaceResult) => {
    const cat = detectCategory(place.category || '');
    const isEvent = cat === 'INDOOR_ENT';
    const newStop: ActiveStop = {
      id: `stop-${Date.now()}`,
      name: place.name,
      category: cat,
      lat: place.lat,
      lng: place.lng,
      durationMins: isEvent ? 150 : 60,
      timeslot: isEvent ? 'afternoon' : undefined,
      placeResult: place,
    };
    setStops(prev => [...prev, newStop]);
    setAutoSorted(false);
  }, []);

  const removeStop = (id: string) => setStops(prev => prev.filter(s => s.id !== id));

  const updateStopDuration = (id: string, mins: number) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, durationMins: mins } : s));
  };

  const updateStopTimeslot = (id: string, timeslot: 'morning' | 'afternoon' | 'evening' | undefined) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, timeslot } : s));
  };

  const handleSmartSort = () => {
    setStops(prev => smartSortStops(prev) as ActiveStop[]);
    setAutoSorted(true);
  };

  // ── Geocoding members ──
  useEffect(() => {
    const timers = members.map(m => {
      if (m.location && m.location.length >= 3 && !m.lat && city) {
        return setTimeout(async () => {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(m.location + ', ' + city)}&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) {
              setMembers(prev => prev.map(pm => pm.id === m.id ? { ...pm, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : pm));
            }
          } catch (e) {}
        }, 1000);
      }
      return null;
    });
    return () => timers.forEach(t => t && clearTimeout(t));
  }, [members.map(m => m.location).join(','), members.map(m => m.lat).join(','), city]);

  // ── Map data ──
  const meetingMember = meetAtSomeone ? members.find(m => m.id === meetingMemberId) : null;

  const memberPins = useMemo(() => members
    .filter(m => m.name && m.lat && m.lng)
    .map(m => ({
      name: m.name,
      lat: m.lat!,
      lng: m.lng!,
      color: getAvatarHex(m.name),
    })), [members]);

  const meetingPin = useMemo(() => {
    if (!meetAtSomeone || !meetingMember?.lat) return null;
    return {
      name: `${meetingMember.name.split(' ')[0]}'s place`,
      lat: meetingMember.lat!,
      lng: meetingMember.lng!,
    };
  }, [meetAtSomeone, meetingMember]);

  const stopPins = useMemo(() => stops
    .filter(s => s.lat && s.lng)
    .map((s, i) => ({
      id: s.id,
      name: s.name,
      lat: s.lat!,
      lng: s.lng!,
      label: i + 1,
    })), [stops]);

  // ── Timeline computation ──
  const paxCount = members.filter(m => m.name).length;

  const { timelineItems, totalCost } = useMemo(() => {
    // Build journey: (meeting point if chosen) → stops
    const journeyPoints = [
      ...(meetingPin ? [{ lat: meetingPin.lat, lng: meetingPin.lng, name: meetingPin.name, durationMins: 15 }] : []),
      ...stops.filter(s => s.lat && s.lng),
    ];

    if (journeyPoints.length === 0) return { timelineItems: [], totalCost: 0 };

    const travelMins: number[] = [];
    for (let i = 0; i < journeyPoints.length - 1; i++) {
      const dist = getDistanceInKm(
        journeyPoints[i].lat!, journeyPoints[i].lng!,
        journeyPoints[i + 1].lat!, journeyPoints[i + 1].lng!,
      );
      travelMins.push(Math.max(5, Math.round(dist * 2)));
    }

    const builtItems = buildTimeline(journeyPoints as any, travelMins, 9);

    let total = 0;
    const enriched = builtItems.map((item, i) => {
      let commute = null;
      let travelDistanceStr = '';
      if (i < travelMins.length) {
        const dist = getDistanceInKm(
          journeyPoints[i].lat!, journeyPoints[i].lng!,
          journeyPoints[i + 1].lat!, journeyPoints[i + 1].lng!,
        );
        commute = calculateCost(dist, travelMins[i], paxCount || 1);
        travelDistanceStr = dist.toFixed(1);
        total += commute.cost;
      }
      return { ...item, commute, travelMins: travelMins[i] || 0, travelDistanceStr };
    });

    return { timelineItems: enriched, totalCost: total };
  }, [stops, meetingPin, paxCount]);

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // ── Share ──
  const handleShare = () => {
    const allPoints = [
      ...memberPins.map(m => `${m.lat},${m.lng}`),
      ...stopPins.map(s => `${s.lat},${s.lng}`),
    ];
    if (allPoints.length < 2) { alert('Add at least 2 locations first!'); return; }
    const [origin, ...rest] = allPoints;
    const destination = rest[rest.length - 1];
    const waypoints = rest.slice(0, -1).join('|');
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    if (navigator.share) {
      navigator.share({ title: `Quick Trip Plan`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert('Google Maps route link copied to clipboard!');
    }
  };

  const hasEnoughData = stopPins.length >= 1;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0d0d0d] sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-zinc-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-1"
          >
            ← Back
          </button>
          <div className="w-px h-4 bg-zinc-800" />
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-emerald-400" />
            <span className="font-bold text-base tracking-tight">Quick Trip</span>
          </div>
          <div className="text-xs text-zinc-600 hidden sm:block">Plan a hangout in 60 seconds</div>
        </div>
        <button
          onClick={handleShare}
          disabled={!hasEnoughData}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-bold rounded-xl transition-all"
        >
          <Share2 size={14} />
          Share Plan
        </button>
      </div>

      {/* ── Body: two-column layout ── */}
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-60px)]">

        {/* ════ LEFT: Wizard ════ */}
        <div className="w-full lg:w-[420px] flex flex-col overflow-y-auto border-r border-zinc-800 shrink-0">
          <div className="p-5 space-y-6">

            {/* Section 1: City */}
            <section>
              <SectionHeader icon={<MapPin size={14} />} label="City" number={1} />
              <div className="mt-3 relative" ref={cityWrapperRef}>
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 focus-within:border-emerald-500/60 transition-colors">
                  <Search size={15} className="text-zinc-500 shrink-0" />
                  <input
                    type="text"
                    value={cityQuery}
                    onChange={e => { setCityQuery(e.target.value); setCity(''); }}
                    onFocus={() => { if (cityResults.length > 0) setCityDropdownOpen(true); }}
                    placeholder="Which city are you hanging out in?"
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                  {city && <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
                </div>
                {cityDropdownOpen && cityResults.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
                    {cityResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => selectCity(r.name)}
                        className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0 flex items-center gap-2"
                      >
                        <MapPin size={12} className="text-zinc-500 shrink-0" />
                        <span className="text-sm text-white">{r.name}</span>
                        <span className="text-xs text-zinc-500 truncate">({r.state})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Section 2: The Crew */}
            <section>
              <SectionHeader icon={<Users size={14} />} label="The Crew" number={2} />
              <div className="mt-3 space-y-3">
                {members.map((m, i) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    index={i}
                    onUpdate={updateMember}
                    onRemove={members.length > 2 ? () => removeMember(m.id) : undefined}
                  />
                ))}
                <button
                  onClick={addMember}
                  className="w-full py-2.5 border border-dashed border-zinc-700 rounded-xl text-sm text-zinc-500 hover:text-white hover:border-zinc-500 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  Add Person
                </button>

                {/* Meeting point toggle */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-300">
                      Meet at someone's place first?
                    </span>
                    <button
                      onClick={() => setMeetAtSomeone(v => !v)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${meetAtSomeone ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${meetAtSomeone ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                  {meetAtSomeone && (
                    <div className="mt-3 pt-3 border-t border-zinc-800">
                      <label className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-2 block">Whose place?</label>
                      <div className="flex flex-wrap gap-2">
                        {members.filter(m => m.name).map(m => (
                          <button
                            key={m.id}
                            onClick={() => setMeetingMemberId(m.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${meetingMemberId === m.id ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                          >
                            {m.name || `Person ${members.indexOf(m) + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Section 3: Places */}
            <section>
              <div className="flex items-center justify-between">
                <SectionHeader icon={<Map size={14} />} label="Places to Visit" number={3} />
                {stops.length >= 2 && (
                  <button
                    onClick={handleSmartSort}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${autoSorted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                  >
                    <Sparkles size={12} />
                    {autoSorted ? 'Smart Sorted' : 'Auto-Sort'}
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-3">
                <PlaceSearchBox city={city} onSelect={handleAddStop} />

                {stops.length === 0 && (
                  <div className="text-center py-8 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-xl">
                    Search for a place above to add it to your plan
                  </div>
                )}

                {stops.map((stop, i) => (
                  <StopCard
                    key={stop.id}
                    stop={stop}
                    index={i}
                    onRemove={() => removeStop(stop.id)}
                    onDurationChange={(mins) => updateStopDuration(stop.id, mins)}
                    onTimeslotChange={(ts) => updateStopTimeslot(stop.id, ts)}
                  />
                ))}
              </div>
            </section>

          </div>
        </div>

        {/* ════ RIGHT: Live Preview ════ */}
        <div className="hidden lg:flex flex-col flex-1 bg-[#0a0a0a] overflow-hidden">
          {/* Map */}
          <div className="h-[42%] w-full border-b border-zinc-800 relative shrink-0">
            {memberPins.length === 0 && stopPins.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 gap-3">
                <MapPin size={32} className="opacity-30" />
                <p className="text-sm font-medium">Your route will appear here</p>
                <p className="text-xs text-zinc-600">Add people and places to get started</p>
              </div>
            ) : (
              <QuickTripMapInnerDynamic
                members={memberPins}
                meetingPoint={meetingPin}
                stops={stopPins}
              />
            )}
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto">
            {/* Stats bar */}
            {hasEnoughData && (
              <div className="flex items-center gap-6 px-6 py-3 border-b border-zinc-800 bg-zinc-900/60 text-xs font-medium text-zinc-400">
                <div className="flex items-center gap-2">
                  <Map size={13} className="text-zinc-600" />
                  <span>{stops.length} {stops.length === 1 ? 'stop' : 'stops'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={13} className="text-zinc-600" />
                  <span>{paxCount || '?'} people</span>
                </div>
                <div className="flex items-center gap-2">
                  <Car size={13} className="text-zinc-600" />
                  <span className="text-emerald-400 font-bold">₹{totalCost} est. travel</span>
                </div>
              </div>
            )}

            <div className="p-6">
              {!hasEnoughData ? (
                <div className="text-center py-16 text-zinc-700">
                  <Clock size={28} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Your timeline will appear here</p>
                  <p className="text-xs mt-1 text-zinc-600">Add at least one place to generate a plan</p>
                </div>
              ) : (
                <div className="space-y-0">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
                    Today's Journey · Starting 9:00 AM
                  </h3>

                  {/* Member convergence section */}
                  {memberPins.length > 1 && meetingPin && (
                    <div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Everyone Converges</p>
                      <div className="flex flex-wrap gap-2">
                        {memberPins.map((m, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-zinc-800 rounded-full px-2.5 py-1">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                              style={{ backgroundColor: m.color }}
                            >
                              {getInitials(m.name)}
                            </div>
                            <span className="text-xs text-zinc-300">{m.name.split(' ')[0]}</span>
                          </div>
                        ))}
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <ArrowRight size={12} />
                          <span className="font-medium text-amber-400">{meetingPin.name}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  {timelineItems.map((item, idx) => (
                    <div key={idx} className="relative group">
                      {/* Connector */}
                      {idx < timelineItems.length - 1 && (
                        <div className="absolute top-6 left-[62px] bottom-[-24px] w-px bg-zinc-800 group-hover:bg-zinc-700 transition-colors z-0" />
                      )}

                      {/* Stop row */}
                      <div className="flex items-start gap-4 relative z-10">
                        <div className="w-16 pt-1 text-xs text-zinc-500 text-right shrink-0">{item.arrivalTime}</div>
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold shrink-0 z-10 mt-0.5">
                          {idx + 1}
                        </div>
                        <div className="flex-1 pb-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-zinc-200 text-sm">{item.stop.name}</h4>
                              <div className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${CATEGORY_COLORS[(item.stop as ActiveStop).category || 'OTHER']}`}>
                                {CATEGORY_LABELS[(item.stop as ActiveStop).category || 'OTHER']}
                              </div>
                            </div>
                            <span className="text-xs text-zinc-600 ml-2 shrink-0">{formatDuration(item.stop.durationMins)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Travel segment */}
                      {item.commute && idx < timelineItems.length - 1 && (
                        <div className="flex items-center justify-between relative z-10 ml-[84px] pb-6 text-xs text-zinc-500">
                          <div className="flex items-center gap-3">
                            <div className="bg-[#0a0a0a] py-1">
                              {item.commute.type === 'bike'
                                ? <Bike size={13} className="text-blue-400" />
                                : <Car size={13} className="text-green-400" />
                              }
                            </div>
                            <div className="flex flex-col">
                              <span>{formatDuration(item.travelMins)} ({item.travelDistanceStr || (item.commute.cost > 0 ? (item.commute.cost / 7).toFixed(1) : '2.0')} km)</span>
                              <span className="text-[10px] text-zinc-600">Recommended: {item.commute.type === 'bike' ? 'Bike Ride' : 'Cab'}</span>
                            </div>
                          </div>
                          <div className="font-medium text-zinc-400 bg-zinc-900 px-2 py-1 rounded text-xs">
                            ₹{item.commute.cost}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, label, number }: { icon: React.ReactNode; label: string; number: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-[10px] font-bold shrink-0">
        {number}
      </div>
      <div className="flex items-center gap-1.5 text-zinc-400">
        {icon}
        <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      </div>
    </div>
  );
}

function MemberRow({
  member, index, onUpdate, onRemove,
}: {
  member: Member;
  index: number;
  onUpdate: (id: string, field: keyof Member, value: string) => void;
  onRemove?: () => void;
}) {
  const color = member.name ? getAvatarHex(member.name) : '#52525b';
  const initials = member.name ? (member.name.trim().split(/\s+/).length === 1
    ? member.name.substring(0, 2).toUpperCase()
    : (member.name.split(' ')[0][0] + member.name.split(' ').slice(-1)[0][0]).toUpperCase()) : '?';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
        <input
          type="text"
          placeholder={`Person ${index + 1}'s name`}
          value={member.name}
          onChange={e => onUpdate(member.id, 'name', e.target.value)}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
        />
        {onRemove && (
          <button onClick={onRemove} className="text-zinc-700 hover:text-red-500 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
        <MapPin size={12} className={member.lat ? "text-emerald-400" : "text-zinc-600"} />
        <input
          type="text"
          placeholder="Starting from (neighbourhood / area)"
          value={member.location}
          onChange={e => onUpdate(member.id, 'location', e.target.value)}
          className="flex-1 bg-transparent text-xs text-zinc-400 placeholder:text-zinc-700 focus:outline-none"
        />
        {member.location && !member.lat && (
          <Loader2 size={12} className="text-zinc-500 animate-spin shrink-0" />
        )}
      </div>
    </div>
  );
}

function StopCard({
  stop, index, onRemove, onDurationChange, onTimeslotChange,
}: {
  stop: ActiveStop;
  index: number;
  onRemove: () => void;
  onDurationChange: (mins: number) => void;
  onTimeslotChange: (ts: 'morning' | 'afternoon' | 'evening' | undefined) => void;
}) {
  const isEvent = stop.category === 'INDOOR_ENT';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-white truncate">{stop.name}</div>
          <div className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${CATEGORY_COLORS[stop.category]}`}>
            {CATEGORY_LABELS[stop.category]}
          </div>
        </div>
        <button onClick={onRemove} className="text-zinc-700 hover:text-red-500 transition-colors shrink-0">
          <X size={14} />
        </button>
      </div>

      {/* Duration or Timeslot */}
      <div className="pt-2 border-t border-zinc-800">
        {isEvent ? (
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-1.5 block">Show time</label>
            <div className="flex gap-1.5">
              {TIMESLOT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onTimeslotChange(stop.timeslot === opt.value ? undefined : opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${stop.timeslot === opt.value ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-1.5 block">Duration</label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onDurationChange(opt.value)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${stop.durationMins === opt.value ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
