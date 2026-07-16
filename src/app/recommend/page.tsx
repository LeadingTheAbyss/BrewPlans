'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useTripStore } from '@/store/tripStore';
import { useAuthStore } from '@/store/authStore';
import { useBudgetStore } from '@/store/budgetStore';
import { useItineraryStore } from '@/store/itineraryStore';
import { useCacheStore } from '@/store/cacheStore';
import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles, Map, IndianRupee, Plus, Trash2, CalendarDays, SlidersHorizontal, Filter, X, ChevronRight, Compass, Zap, ShieldCheck, Maximize } from 'lucide-react';
import CityAutocomplete from '@/components/CityAutocomplete';
import { motion, AnimatePresence } from 'framer-motion';

const PREFERENCES = [
  { id: 'mountains', label: 'Mountains' },
  { id: 'beaches', label: 'Beaches' },
  { id: 'heritage', label: 'Heritage' },
  { id: 'wildlife', label: 'Wildlife' },
  { id: 'spiritual', label: 'Spiritual' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'food', label: 'Food and Culinary' },
  { id: 'nightlife', label: 'Nightlife' },
];

export default function RecommendPage() {
  const router = useRouter();
  const trip = useTripStore();
  const { user, isLoading, fetchUser } = useAuthStore();
  
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login?redirect=/recommend');
    }
  }, [user, isLoading, router]);
  
  const [form, setForm] = useState({
    passengers: [{ city: '' }],
    budget: '' as any as number,
    days: '' as any as number,
    groupSize: '' as any as number,
    preference: [] as string[]
  });
  const [showCustomVibe, setShowCustomVibe] = useState(false);
  const [customVibe, setCustomVibe] = useState('');
  const [lookalike, setLookalike] = useState('');
  const [constraints, setConstraints] = useState('');

  const [error, setError] = useState('');

  const [loading, setLoading] = useState(false);
  const [rawResults, setRawResults] = useState<any[]>([]);
  
  // Filters State
  const [sortBy, setSortBy] = useState('match');
  const [filterPrimaryOnly, setFilterPrimaryOnly] = useState(false);
  const [destPhotos, setDestPhotos] = useState<Record<string, string | null>>({});
  const [expandedDest, setExpandedDest] = useState<any | null>(null);
  const [hideOverlay, setHideOverlay] = useState(false);
  const [formCollapsed, setFormCollapsed] = useState(false);
  const fetchedNames = React.useRef<Set<string>>(new Set());

  const fetchPhoto = useCallback(async (name: string) => {
    if (fetchedNames.current.has(name)) return; // already fetched or in-flight
    fetchedNames.current.add(name);
    try {
      const res = await fetch(`/api/destination-photo?name=${encodeURIComponent(name)}&_t=${Date.now()}`);
      const data = await res.json();
      setDestPhotos(prev => ({ ...prev, [name]: data.url ?? null }));
    } catch {
      setDestPhotos(prev => ({ ...prev, [name]: null }));
    }
  }, []); // stable — no deps needed, ref handles dedup

  const handleAddPassenger = () => {
    if (form.passengers.length >= 10) return;
    const newPassengers = [...form.passengers, { city: '' }];
    setForm({ 
      ...form, 
      passengers: newPassengers,
      groupSize: Math.max(form.groupSize, newPassengers.length)
    });
  };

  const handleCityChange = (index: number, city: string) => {
    const newPax = [...form.passengers];
    newPax[index].city = city;
    setForm({ ...form, passengers: newPax });
  };

  const handleSearch = async () => {
    setError('');
    
    const validPassengers = form.passengers.filter(p => p.city && p.city.trim() !== '');
    if (validPassengers.length === 0) {
      setError('Please select a Current City.');
      return;
    }

    if (!form.days || form.days <= 0) {
      setError('Please enter a valid Duration (in days).');
      return;
    }

    const finalPreferences = [...form.preference];
    if (showCustomVibe && customVibe.trim() !== '') {
      finalPreferences.push(customVibe.trim());
    }
    if (lookalike.trim() !== '') {
      finalPreferences.push(`Looks like ${lookalike.trim()} (but MUST be in India)`);
    }

    if (finalPreferences.length === 0) {
      setError('Please select at least one Vibe Filter or type a custom one.');
      return;
    }

    setLoading(true);
    setDestPhotos({});
    fetchedNames.current.clear();

    const data = await api.getRecommendations({
      passengers: validPassengers,
      total_budget: form.budget,
      days: form.days,
      group_size: form.groupSize,
      preference: finalPreferences.join(' and '),
      constraints: constraints.trim()
    });
    setFormCollapsed(true);
    setRawResults(data);
    setLoading(false);
  };

  const handleSelectDestination = (destName: string) => {
    useTripStore.getState().reset();
    useBudgetStore.getState().reset();
    useItineraryStore.getState().reset();
    useCacheStore.getState().clearCache();

    trip.setTripDetails({ 
      mode: 'recommend',
      destination: destName.split(',')[0]
    });

    useBudgetStore.getState().setTotalBudget(form.budget);

    if (trip.passengers.length === 0) {
      // Pad passengers to match groupSize: repeat last city for any extra travelers
      const validCities = form.passengers.filter(p => p.city.trim() !== '');
      const paddedPassengers = Array.from({ length: form.groupSize }, (_, i) => ({
        city: (validCities[i] ?? validCities[validCities.length - 1]).city
      }));
      paddedPassengers.forEach((p, i) => {
        trip.addPassenger({
          id: `pax_${Date.now()}_${i}`,
          tripId: 'TRIP_CURRENT',
          name: `Traveler ${i+1}`,
          age: 25,
          gender: 'other',
          pincode: '',
          city: p.city,
          transportPreference: 'any'
        });
      });
    }

    router.push('/plan/setup');
  };

  const numTravelers = Math.max(1, form.groupSize);

  const filteredResults = useMemo(() => {
    let filtered = [...rawResults];
    if (filterPrimaryOnly) filtered = filtered.filter(r => r.isPrimaryMatch);

    filtered.sort((a, b) => {
      if (sortBy === 'price_asc') return (a.budgetEstimate || 0) - (b.budgetEstimate || 0);
      if (sortBy === 'price_desc') return (b.budgetEstimate || 0) - (a.budgetEstimate || 0);
      return (b.matchScore || 0) - (a.matchScore || 0);
    });

    return filtered;
  }, [rawResults, filterPrimaryOnly, sortBy]);

  // Fetch photos whenever filteredResults change
  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      for (let i = 0; i < filteredResults.length; i++) {
        if (!isMounted) break;
        const dest = filteredResults[i];
        if (dest?.name) {
          fetchPhoto(dest.name);
          await new Promise(r => setTimeout(r, 400)); // Stagger by 400ms to avoid API spikes
        }
      }
    };
    fetchAll();
    return () => { isMounted = false; };
  }, [filteredResults, fetchPhoto]);

  return (
    <div className="w-full h-full pb-24">

      <main className="max-w-[1400px] mx-auto px-4 md:px-12 pt-20 flex flex-col gap-24">
        
        {/* Intent Configuration */}
        <AnimatePresence initial={false}>
          {!formCollapsed ? (
        <motion.section
          key="form-full"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          style={{ overflow: 'hidden' }}
          className="flex flex-col xl:flex-row gap-16 items-start pb-24 border-b border-neutral-200 dark:border-neutral-900 transition-colors"
        >
          <div className="flex-1 space-y-6 self-start">
            <h2 className="text-5xl lg:text-7xl font-light tracking-tighter text-neutral-900 dark:text-white transition-colors">Where next?</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-xl font-light transition-colors">Tell us your vibe, and our AI will handle the rest.</p>
          </div>
          
          <div className="flex-[2] flex flex-col md:flex-row flex-wrap gap-10 items-start md:items-end justify-start xl:justify-end w-full">
            <div className="flex flex-col gap-4 w-full md:w-auto">
              <div className="flex justify-between items-center w-full md:w-64">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Current Cities</label>
                {form.passengers.length < 10 && (
                  <button onClick={handleAddPassenger} className="text-[10px] font-bold text-blue-500 hover:text-blue-600 uppercase tracking-widest flex items-center gap-1">
                    <Plus size={12}/> Add
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-3 w-full md:w-64 text-black">
                {form.passengers.map((pax, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <CityAutocomplete 
                        label="" placeholder={`Person ${idx + 1} city...`} 
                        value={pax.city}
                        onChange={(val) => handleCityChange(idx, val)}
                      />
                    </div>
                    {form.passengers.length > 1 && (
                      <button 
                        onClick={() => {
                          const newPax = [...form.passengers];
                          newPax.splice(idx, 1);
                          setForm({ ...form, passengers: newPax });
                        }} 
                        className="text-red-400 hover:text-red-600 transition-colors shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-4 w-full md:w-auto">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Budget limit (Optional)</label>
              <div className="flex items-center gap-3 border-b border-neutral-300 dark:border-neutral-800 pb-3 transition-colors">
                <span className="text-neutral-400 dark:text-neutral-600 font-light text-xl">₹</span>
                <input 
                  type="number" min="1" placeholder="100000" className="w-32 bg-transparent border-none focus:outline-none text-2xl text-neutral-900 dark:text-white font-light placeholder:text-neutral-300 dark:placeholder:text-neutral-800"
                  value={form.budget || ''} onChange={e => {
                    const val = parseInt(e.target.value);
                    setForm({...form, budget: isNaN(val) ? '' as any : Math.max(1, val)});
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 w-full md:w-auto">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Travelers</label>
              <div className="flex items-center gap-3 border-b border-neutral-300 dark:border-neutral-800 pb-3 transition-colors">
                <input 
                  type="number" min={form.passengers.length} max="20" placeholder="1" className="w-16 bg-transparent border-none focus:outline-none text-2xl text-neutral-900 dark:text-white font-light text-center placeholder:text-neutral-300 dark:placeholder:text-neutral-800"
                  value={form.groupSize || ''} onChange={e => {
                    const val = parseInt(e.target.value);
                    const minCount = form.passengers.length;
                    setForm({...form, groupSize: isNaN(val) ? minCount : Math.max(minCount, Math.min(20, val))});
                  }}
                />
                <span className="text-neutral-600 text-sm font-light uppercase tracking-widest">People</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 w-full md:w-auto">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Duration</label>
              <div className="flex items-center gap-3 border-b border-neutral-300 dark:border-neutral-800 pb-3 transition-colors">
                <input 
                  type="number" min="1" placeholder="4" className="w-16 bg-transparent border-none focus:outline-none text-2xl text-neutral-900 dark:text-white font-light text-center placeholder:text-neutral-300 dark:placeholder:text-neutral-800"
                  value={form.days || ''} onChange={e => {
                    const val = parseInt(e.target.value);
                    setForm({...form, days: isNaN(val) ? '' as any : Math.max(1, val)});
                  }}
                />
                <span className="text-neutral-600 text-sm font-light uppercase tracking-widest">Days</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 w-full md:w-auto">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Vibe Filter</label>
              <div className="flex flex-wrap gap-3 max-w-[600px]">
                {PREFERENCES.map(pref => (
                  <button
                    key={pref.id}
                    onClick={() => setForm({ ...form, preference: form.preference.includes(pref.id) ? form.preference.filter(p => p !== pref.id) : [...form.preference, pref.id] })}
                    className={`px-5 py-3 text-[10px] uppercase tracking-widest font-bold transition-all ${form.preference.includes(pref.id) ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-transparent text-neutral-500 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-white'}`}
                  >
                    {pref.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowCustomVibe(!showCustomVibe)}
                  className={`px-5 py-3 text-[10px] uppercase tracking-widest font-bold transition-all ${showCustomVibe ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-transparent text-neutral-500 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-white'}`}
                >
                  Other
                </button>
                
                {showCustomVibe && (
                  <input 
                    type="text" 
                    placeholder="Type your vibe..."
                    value={customVibe}
                    onChange={(e) => setCustomVibe(e.target.value)}
                    className="px-5 py-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white text-xs outline-none focus:border-neutral-500 dark:focus:border-white w-48 transition-colors"
                  />
                )}
              </div>
            </div>

            <div className="flex flex-row items-end gap-10">
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest min-h-[2.5rem] flex items-end">International Lookalike (Optional)</label>
                <div className="flex items-start border-b border-neutral-300 dark:border-neutral-800 pb-2 focus-within:border-neutral-500 dark:focus-within:border-neutral-500 transition-colors">
                  <textarea
                    placeholder="e.g. Switzerland, Maldives..."
                    className="flex-1 bg-transparent border-none focus:outline-none text-xl text-neutral-900 dark:text-white font-light placeholder:text-neutral-300 dark:placeholder:text-neutral-700 resize-none leading-relaxed overflow-y-auto"
                    rows={1}
                    style={{ maxHeight: '9rem' }}
                    value={lookalike}
                    onChange={e => {
                      setLookalike(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 144) + 'px';
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest min-h-[2.5rem] flex items-end">Specific Constraints (Optional)</label>
                <div className="flex items-start border-b border-neutral-300 dark:border-neutral-800 pb-2 focus-within:border-neutral-500 dark:focus-within:border-neutral-500 transition-colors">
                  <textarea
                    placeholder="e.g. No overcrowding, avoid hill stations, etc."
                    className="flex-1 bg-transparent border-none focus:outline-none text-xl text-neutral-900 dark:text-white font-light placeholder:text-neutral-300 dark:placeholder:text-neutral-700 resize-none leading-relaxed overflow-y-auto"
                    rows={1}
                    style={{ maxHeight: '9rem' }}
                    value={constraints}
                    onChange={e => {
                      setConstraints(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 144) + 'px';
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 items-end ml-6">
              {error && (
                <div className="text-red-500 text-[10px] font-bold tracking-widest uppercase bg-red-500/10 px-4 py-2 border border-red-500/20">
                  {error}
                </div>
              )}
              <button 
                onClick={handleSearch} disabled={loading}
                className="bg-blue-600 text-white px-10 py-5 font-bold uppercase tracking-widest text-xs hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center gap-4 w-full justify-center"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Compass size={18} />} 
                {loading ? 'Synthesizing...' : 'Execute'}
              </button>
            </div>
          </div>
        </motion.section>
        ) : (
          <motion.section
            key="form-collapsed"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-between gap-6 py-4 px-6 border border-neutral-200 dark:border-neutral-800 rounded-sm"
          >
            <div className="flex flex-wrap items-center gap-6 text-sm text-neutral-500 dark:text-neutral-400">
              <span className="font-bold text-neutral-900 dark:text-white text-xs uppercase tracking-widest">Your Search</span>
              <span>{form.passengers.map(p => p.city || '?').join(', ')}</span>
              <span>·</span>
              <span>{form.days} days</span>
              <span>·</span>
              <span>{form.groupSize} people</span>
              <span>·</span>
              <span>₹{form.budget?.toLocaleString('en-IN')}</span>
              {constraints && <><span>·</span><span className="italic">{constraints.length > 40 ? constraints.slice(0, 40) + '…' : constraints}</span></>}
            </div>
            <button
              onClick={() => setFormCollapsed(false)}
              className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-blue-500 hover:text-blue-400 border border-blue-500/30 px-4 py-2 transition-colors"
            >
              Edit
            </button>
          </motion.section>
        )}
        </AnimatePresence>

        {/* Results Dashboard */}
        <AnimatePresence mode="wait">
          {rawResults.length > 0 && !loading && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-20"
            >
              <div className="flex justify-between items-end pb-8">
                <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Recommended Itineraries</h2>
                <div className="flex items-center gap-4">
                  <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-[0.2em]">Sort</label>
                  <select 
                    className="bg-transparent border-none text-neutral-300 text-xs font-bold uppercase tracking-widest focus:outline-none cursor-pointer"
                    value={sortBy} onChange={e => setSortBy(e.target.value)}
                  >
                    <option value="match" className="bg-[#111]">Optimal Match</option>
                    <option value="price_asc" className="bg-[#111]">Lowest Cost</option>
                    <option value="price_desc" className="bg-[#111]">Highest Cost</option>
                  </select>
                </div>
              </div>

              {/* Layout Overhaul: Dynamic Presentation */}
              <div className="flex flex-col gap-24">
                
                {/* Hero Block (First Result) */}
                {filteredResults.length > 0 && (
                  <div className="w-full flex flex-col lg:flex-row gap-20 group">
                    <div className="flex-1 space-y-8 lg:space-y-10">
                      <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                        <span className="px-3 py-1.5 lg:px-4 lg:py-2 bg-white text-black text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] whitespace-normal">
                          Primary Recommendation
                        </span>
                        <span className="text-neutral-500 text-xs font-bold tracking-[0.1em] lg:tracking-[0.2em]">
                          {filteredResults[0].matchScore}% Match
                        </span>
                      </div>

                      {/* Mobile Hero Image */}
                      <div className="block lg:hidden w-full h-56 sm:h-72 relative bg-[#0A0A0A] overflow-hidden my-6">
                         {destPhotos[filteredResults[0].name] ? (
                           <div 
                             className="w-full h-full cursor-zoom-in relative group/img"
                             onClick={(e) => {
                               e.stopPropagation();
                               setExpandedDest(filteredResults[0]);
                             }}
                           >
                             <img
                               src={destPhotos[filteredResults[0].name]!}
                               alt={filteredResults[0].name}
                               className="w-full h-full object-cover object-center opacity-90"
                             />
                             <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2 pointer-events-none">
                               <Maximize size={12} className="text-white" />
                               <span className="text-[10px] text-white font-bold uppercase tracking-widest">Tap to expand</span>
                             </div>
                           </div>
                         ) : (
                           <>
                             <div className="absolute inset-0 bg-gradient-to-br from-[#111111] to-[#000000]" />
                             <div className="absolute inset-0 flex items-center justify-center opacity-[0.03]">
                               <Map size={150} />
                             </div>
                           </>
                         )}
                      </div>

                      <div>
                        <h3 className="text-4xl sm:text-5xl lg:text-7xl font-light tracking-tighter text-white leading-none mb-4 break-words">
                          {filteredResults[0].name}
                        </h3>
                        <p className="text-xl font-light text-neutral-500">{filteredResults[0].state}</p>
                      </div>

                      <p className="text-lg font-light leading-relaxed text-neutral-400 max-w-3xl">
                        {filteredResults[0].why}
                      </p>

                      <div className="flex flex-wrap gap-8 lg:gap-16 pt-8 lg:pt-12 mt-8 lg:mt-12 border-t border-neutral-900">
                        <div>
                          <p className="text-[10px] lg:text-xs text-neutral-600 font-bold uppercase tracking-[0.1em] lg:tracking-[0.2em] mb-2 lg:mb-3">Total Est. Budget (Travel Included)</p>
                          <p className="text-3xl lg:text-4xl font-light text-white">₹{filteredResults[0].budgetEstimate?.toLocaleString('en-IN')}</p>
                        </div>
                      </div>

                      <button onClick={() => handleSelectDestination(filteredResults[0].name)} className="mt-8 px-6 py-4 lg:px-10 lg:py-5 bg-white text-black hover:bg-neutral-200 transition-colors font-bold uppercase tracking-widest text-xs lg:text-sm flex items-center justify-center lg:justify-start gap-4 w-full lg:w-max">
                        Initiate Plan <ArrowRight size={18}/>
                      </button>
                    </div>

                    <div className="hidden lg:block flex-[0.8] aspect-square lg:aspect-auto bg-[#0A0A0A] overflow-hidden relative min-h-[400px]">
                       {destPhotos[filteredResults[0].name] ? (
                         <div 
                           className="w-full h-full cursor-zoom-in relative group/img"
                           onClick={(e) => {
                             e.stopPropagation();
                             setExpandedDest(filteredResults[0]);
                           }}
                         >
                           <img
                             src={destPhotos[filteredResults[0].name]!}
                             alt={filteredResults[0].name}
                             className="w-full h-full object-cover object-center opacity-90 group-hover/img:scale-105 transition-transform duration-700"
                           />
                           <div className="absolute bottom-6 right-6 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 pointer-events-none">
                             <Maximize size={14} className="text-white" />
                             <span className="text-xs text-white font-bold uppercase tracking-widest">Click to expand</span>
                           </div>
                         </div>
                       ) : (
                         <>
                           <div className="absolute inset-0 bg-gradient-to-br from-[#111111] to-[#000000]" />
                           <div className="absolute inset-0 flex items-center justify-center opacity-[0.03]">
                             <Map size={300} />
                           </div>
                         </>
                       )}
                    </div>
                  </div>
                )}

                {/* Alternative Rows (List Layout) */}
                <div className="flex flex-col gap-12 pt-20 border-t border-neutral-900">
                  {filteredResults.slice(1).map((dest, i) => (
                    <div key={`${dest.id}-${i}`} className="flex flex-col md:flex-row items-start md:items-center justify-between py-8 md:py-12 group hover:px-4 md:hover:px-8 transition-all duration-500 cursor-zoom-in -mx-4 md:-mx-8 px-4 md:px-0 bg-transparent hover:bg-[#0A0A0A]" onClick={() => setExpandedDest(dest)}>
                      
                      <div className="flex-1 flex items-center gap-4 md:gap-12 w-full">
                        <div className="w-12 md:w-16 text-center shrink-0">
                          <span className="text-neutral-800 font-bold text-2xl md:text-3xl group-hover:text-neutral-600 transition-colors">
                            {String(i + 2).padStart(2, '0')}
                          </span>
                        </div>
                        {/* Thumbnail */}
                        {destPhotos[dest.name] && (
                          <div 
                            className="w-16 h-12 md:w-20 md:h-14 overflow-hidden shrink-0 opacity-60 group-hover:opacity-100 transition-all z-10"
                          >
                            <img src={destPhotos[dest.name]!} alt={dest.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="text-2xl md:text-3xl font-light text-white truncate">{dest.name}</h3>
                          <div className="flex items-center gap-2 mt-1 md:mt-2">
                            <p className="text-sm md:text-base font-light text-neutral-500">{dest.state}</p>
                            <span className="inline-flex items-center gap-1 text-[9px] md:text-[10px] text-neutral-600 font-bold tracking-widest uppercase md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              &bull; <Maximize size={10} className="ml-1" /> Tap to expand
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 px-12 hidden lg:block">
                        <p className="text-base font-light text-neutral-400 line-clamp-2">
                          {dest.why}
                        </p>
                      </div>

                      <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 md:gap-16 text-right pl-0 md:pl-8 mt-6 md:mt-0">
                        <div className="text-left md:text-right">
                          <p className="text-[10px] md:text-xs text-neutral-600 font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] mb-1 md:mb-2">Score</p>
                          <p className="text-xl md:text-2xl font-light text-white">{dest.matchScore}%</p>
                        </div>
                        <div className="text-left md:text-right">
                          <p className="text-[10px] md:text-xs text-neutral-600 font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] mb-1 md:mb-2">Budget</p>
                          <p className="text-xl md:text-2xl font-light text-white">₹{dest.budgetEstimate?.toLocaleString('en-IN')}</p>
                        </div>
                        <div 
                          className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-full border border-neutral-800 group-hover:bg-white group-hover:text-black group-hover:border-white transition-all duration-500 cursor-pointer hover:scale-110 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectDestination(dest.name);
                          }}
                        >
                          <ArrowRight size={20} className="opacity-100 md:opacity-0 md:-translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500"/>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {loading && (
            <div className="py-40 flex flex-col items-center justify-center space-y-12">
              <div className="w-20 h-20 border border-neutral-800 border-t-white rounded-full animate-spin" />
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-[0.2em] animate-pulse">Running location analysis algorithms...</p>
            </div>
          )}
        </AnimatePresence>

      </main>

      {/* Image Expansion Modal */}
      <AnimatePresence>
        {expandedDest && destPhotos[expandedDest.name] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 md:p-12 cursor-zoom-out"
            onClick={() => setExpandedDest(null)}
          >
            <button 
              className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors p-4 z-20"
              onClick={() => setExpandedDest(null)}
            >
              <X size={32} />
            </button>

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-7xl h-full max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-end group cursor-default"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={() => setHideOverlay(true)}
              onMouseUp={() => setHideOverlay(false)}
              onMouseLeave={() => setHideOverlay(false)}
              onTouchStart={() => setHideOverlay(true)}
              onTouchEnd={() => setHideOverlay(false)}
            >
              <img
                src={destPhotos[expandedDest.name]!}
                alt={expandedDest.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              />
              
              {/* Elegant Text Overlay */}
              <div className={`relative z-10 p-6 sm:p-10 md:p-20 bg-gradient-to-t from-black via-black/90 to-transparent transition-opacity duration-300 ${hideOverlay ? 'opacity-0' : 'opacity-100'}`}>
                <div className="max-w-4xl">
                  <div className="flex flex-wrap items-center gap-3 md:gap-6 mb-4 md:mb-6">
                    <span className="px-3 py-1.5 md:px-4 md:py-2 bg-white text-black text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em]">
                      {expandedDest.matchScore}% Match
                    </span>
                    <span className="text-neutral-300 text-xs md:text-sm font-bold tracking-[0.2em] uppercase">
                      {expandedDest.state}
                    </span>
                  </div>
                  <h2 className="text-4xl sm:text-5xl md:text-8xl font-light tracking-tighter text-white mb-4 md:mb-8 break-words">
                    {expandedDest.name}
                  </h2>
                  <p className="text-sm sm:text-base md:text-3xl font-light leading-relaxed text-neutral-300 line-clamp-4 md:line-clamp-none">
                    {expandedDest.why}
                  </p>
                  
                  <div className="flex flex-col md:flex-row gap-6 md:gap-16 mt-6 md:mt-12 pt-6 md:pt-12 border-t border-white/20">
                    <div>
                      <p className="text-[10px] md:text-xs text-neutral-400 font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] mb-2 md:mb-3">Total Est. Budget (Travel Included)</p>
                      <p className="text-3xl md:text-4xl font-light text-white">₹{expandedDest.budgetEstimate?.toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => {
                          setExpandedDest(null);
                          handleSelectDestination(expandedDest.name);
                        }} 
                        className="mt-2 px-6 py-4 md:px-10 bg-white text-black hover:bg-neutral-200 transition-colors font-bold uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-4 w-full md:w-max"
                      >
                        Initiate Plan <ArrowRight size={18}/>
                      </button>
                      <div className="flex items-start gap-2 mt-1">
                        <span className="text-white text-sm md:text-base font-medium mt-[2px] md:mt-[3px]">&bull;</span>
                        <p className="text-sm md:text-base text-white font-medium tracking-wide leading-relaxed">
                          You can find more images and street views when you plan a trip!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
