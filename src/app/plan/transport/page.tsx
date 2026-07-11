'use client';

import React, { useEffect, useState } from 'react';
import { useTripStore } from '@/store/tripStore';
import { useBudgetStore } from '@/store/budgetStore';
import { TransportOption, Passenger } from '@/types/trip';
import { api } from '@/lib/api';
import { Train, Plane, MapPin, Building, Bus, Car, Loader2, IndianRupee, Clock, ShieldCheck, Armchair, ChevronDown, ArrowRight, CheckCircle2, Circle, AlertCircle, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useCacheStore } from '@/store/cacheStore';
import { useFetchQueue } from '@/store/fetchQueueStore';
import { TrainRouteModal, LiveStatusModal, StationBoardModal } from '@/components/ui/TrainModals';

const LoadingScreen = ({ isFinished, onComplete }: { isFinished: boolean, onComplete: () => void }) => {
  const [progress, setProgress] = useState(0);

  // Asymptotic progress logic
  useEffect(() => {
    if (isFinished) {
      setProgress(100);
      const t = setTimeout(onComplete, 800);
      return () => clearTimeout(t);
    }

    const interval = setInterval(() => {
      setProgress(p => {
        const remaining = 99 - p;
        const jump = Math.max(0.8, remaining * 0.08); 
        const next = p + jump;
        return next >= 99 ? 99 : next;
      });
    }, 250);

    return () => clearInterval(interval);
  }, [isFinished, onComplete]);

  return (
    <div className="fixed inset-0 z-[100] w-full h-screen bg-[#1e1424] flex flex-col justify-end items-center pb-16 overflow-hidden select-none">
      {/* Epic Background Illustration */}
      <img 
        src="/images/travel_loading_bg.png" 
        alt="Epic Journey Horizon" 
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

      {/* Title Header (Top Right style alignment) */}
      <div className="absolute top-12 right-12 text-right z-50">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-wider drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] uppercase">
          PlanBro
        </h1>
      </div>

      {/* Gamified UI Loading Container */}
      <div className="w-full max-w-2xl px-6 z-50 flex flex-col items-center">
        <span className="text-xl font-black text-amber-400 tracking-widest uppercase mb-2 animate-pulse drop-shadow">
          Finding Transport Options... {Math.floor(progress)}%
        </span>

        {/* The Track */}
        <div className="relative w-full h-6 bg-black/60 rounded-full border border-white/10 backdrop-blur-sm flex items-center p-1">
          {/* Progress Fill */}
          <motion.div 
            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ ease: "easeInOut" }}
          />
          
          {/* Slider Head (Animated Train) */}
          <motion.div 
            className="absolute top-1/2 -translate-y-1/2 -ml-6 flex items-center z-10"
            style={{ left: `${progress}%` }}
            transition={{ ease: "easeInOut" }}
          >
            {/* Animated Smoke Puffs */}
            <div className="absolute -left-6 -top-4 flex gap-1 pointer-events-none scale-x-[-1]">
              <motion.div 
                animate={{ x: [-2, -15], y: [-5, -15], opacity: [0.8, 0], scale: [0.5, 2] }}
                transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                className="w-2.5 h-2.5 bg-gray-200/80 rounded-full blur-[1px]"
              />
              <motion.div 
                animate={{ x: [-1, -10], y: [-2, -10], opacity: [0.6, 0], scale: [0.6, 1.5] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: 0.3 }}
                className="w-2 h-2 bg-gray-300/60 rounded-full blur-[1px]"
              />
              <motion.div 
                animate={{ x: [0, -8], y: [0, -8], opacity: [0.9, 0], scale: [0.4, 1.8] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: 0.6 }}
                className="w-1.5 h-1.5 bg-white/70 rounded-full blur-[0.5px]"
              />
            </div>
            
            {/* The Train (Flipped horizontally to face right) */}
            <motion.div 
              className="text-4xl scale-x-[-1] filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]"
              animate={{ y: [-1.5, 1.5, -1.5], rotate: [-2, 2, -2] }}
              transition={{ repeat: Infinity, duration: 0.4, ease: "easeInOut" }}
            >
                <Train size={48} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
            </motion.div>
          </motion.div>
        </div>

        {/* Waiting Message */}
        <div className="h-12 mt-4 flex items-center justify-center overflow-hidden">
          <motion.p 
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="text-xs md:text-sm text-gray-300 text-center max-w-lg font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,1)]"
          >
            Searching across multiple sources. This might take a few moments...
          </motion.p>
        </div>
      </div>
    </div>
  );
};

const getAirlineLogo = (providerName: string) => {
  if (!providerName) return null;
  const name = providerName.toLowerCase();
  if (name.includes('indigo')) return '/indigo_logo.png';
  if (name.includes('express')) return '/AirIndiaExpress_logo.png';
  if (name.includes('air india')) return '/AirIndia_logo.png';
  if (name.includes('akasa')) return '/AkasaAir_logo.png';
  if (name.includes('alliance')) return '/AllianceAirlines_logo.jpg';
  if (name.includes('spicejet')) return '/SpiceJet_logo.png';
  return null;
};

// Edit these values to tweak the width/height (zoom) of each individual logo!
const getAirlineLogoStyles = (providerName: string) => {
  if (!providerName) return 'w-[100%] h-[100%] scale-100';
  const name = providerName.toLowerCase();
  
  if (name.includes('indigo')) {
    // INDIGO: Increase or decrease scale-100 to change size (e.g., scale-90, scale-110)
    return 'w-[100%] h-[100%] scale-100'; 
  }
  if (name.includes('express')) {
    // AIR INDIA EXPRESS: Very wide logo with lots of white space
    return 'w-[120%] h-[100%] scale-[1.8]';
  }
  if (name.includes('air india')) {
    // AIR INDIA: Needs significant zoom to cut out the massive white borders
    return 'w-[47.5%] h-[120%] scale-[2.5]'; 
  }
  
// DEFAULT for everything else (Akasa, Spicejet, etc.)
  return 'w-[100%] h-[100%] scale-[1.2]'; 
};

const getCabLogo = (providerName: string) => {
  if (!providerName) return null;
  const name = providerName.toLowerCase();
  if (name.includes('hatchback')) return '/Hatchback_logo.jpg';
  if (name.includes('suv')) return '/SUV_logo.jpg';
  if (name.includes('sedan')) return '/sedan_logo.jpg';
  return null;
};

// Edit these values to tweak the zoom of cab images
const getCabLogoStyles = (providerName: string) => {
  if (!providerName) return 'w-[100%] h-[100%] scale-100';
  const name = providerName.toLowerCase();
  
  if (name.includes('hatchback')) return 'w-[120%] h-[100%] scale-120';
  if (name.includes('suv')) return 'w-[100%] h-[100%] scale-100';
  if (name.includes('sedan')) return 'w-[100%] h-[100%] scale-100';
  
  return 'w-[100%] h-[100%] scale-100';
};

export default function TransportPage() {
  const router = useRouter();
  const trip = useTripStore();
  const budget = useBudgetStore();
  
  // Global stores for queue and cache
  const fetchQueue = useFetchQueue();
  const cache = useCacheStore();
  const cachedData = cache.cache;
  const [sortBy, setSortBy] = useState<Record<string, 'recommended' | 'cheapest' | 'fastest' | 'earliest'>>({});

  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [liveModalOpen, setLiveModalOpen] = useState(false);
  const [stationBoardOpen, setStationBoardOpen] = useState(false);
  const [activeTrainId, setActiveTrainId] = useState('');
  
  // Track active transport tab per passenger
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});

  const handleAccordionClick = (pax: Passenger, type: string) => {
    if (!pax.city) {
      alert(`Please go back to Setup and enter a starting city for ${pax.name || 'this passenger'}`);
      return;
    }
    
    const destination = trip.destination || 'Unknown';
    const key = `${pax.id}-${pax.city}-${destination}-${type}-v6`;
    const isActive = activeTabs[pax.id] === type;

    // Toggle tab
    setActiveTabs({ ...activeTabs, [pax.id]: isActive ? '' : type });
    
    if (!isActive) {
      const data = useCacheStore.getState().cache[key];
      const task = useFetchQueue.getState().tasks.find(t => t.id === key);
      
      // If no valid data is cached, and it's not currently loading, trigger a live fetch!
      if (!data && (!task || task.status === 'idle' || task.status === 'cache_miss' || task.status === 'error')) {
        useFetchQueue.getState().enqueueTask({ id: key, category: 'transport', subType: type, paxId: pax.id, priority: 0, isLive: true });
        useFetchQueue.getState().bumpPriority(key);
      } else if (task && task.status === 'loading') {
        // If it was already loading in the background, jump it to the top so we don't wait
        useFetchQueue.getState().bumpPriority(key);
      }
    }
  };

  // Handle transport selection
  const handleSelectTransport = (paxId: string, option: TransportOption) => {
    const currentPax = trip.passengers.find(p => p.id === paxId);
    const existingSelection = trip.selectedTransports.find(t => t.passengerId === paxId);
    
    // If clicking the currently selected option, deselect it
    if (existingSelection && existingSelection.transportOptionId === option.id) {
      budget.refundExpense('transport', existingSelection.cost);
      trip.deselectTransport(paxId);
      budget.recalcBudget();
      return;
    }

    // Otherwise, select the new one (refunding the old one if it exists)
    if (existingSelection) {
      budget.refundExpense('transport', existingSelection.cost);
    }
    trip.selectTransport(paxId, option);
    budget.addExpense('transport', option.price);
    
    // Automatically apply this choice to other passengers from the SAME origin who have NOT selected any transport yet
    if (currentPax && currentPax.city) {
      const othersWithNoSelection = trip.passengers.filter(p => 
        p.id !== paxId && 
        p.city === currentPax.city && 
        !trip.selectedTransports.find(t => t.passengerId === p.id)
      );

      othersWithNoSelection.forEach(p => {
        trip.selectTransport(p.id, option);
        budget.addExpense('transport', option.price);
      });
    }

    budget.recalcBudget();
  };

  const getTransportIcon = (type: string) => {
    if (type === 'flight') return <Plane className="text-blue-500 shrink-0" size={20} />;
    if (type === 'train') return <Train className="text-orange-500 shrink-0" size={20} />;
    if (type === 'cab' || type === 'car') return <Car className="text-purple-500 shrink-0" size={20} />;
    if (type === 'cross') return <MapPin className="text-amber-500 shrink-0" size={20} />;
    return <Bus className="text-green-500 shrink-0" size={20} />;
  };

  const parseDuration = (dur: string) => {
    const hMatch = dur.match(/(\d+)h/);
    const mMatch = dur.match(/(\d+)m/);
    return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0);
  };

  const parseTime = (time: string) => {
    const timePart = time.includes(', ') ? time.split(', ')[1] : time;
    if (!timePart) return 0;
    const [h, m] = timePart.split(':').map(Number);
    return h * 60 + m;
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <div className="min-h-screen bg-background pt-10 px-4 transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-12 pb-24 text-foreground">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-end"
        >
          <div>
            <h1 className="text-3xl font-bold mb-2">Transport Options</h1>
            <p className="text-muted-foreground">Select how everyone is getting to <span className="font-semibold text-foreground">{trip.destination || 'the destination'}</span>.</p>
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {trip.passengers.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-8 border-2 border-dashed border-border rounded-xl text-center text-muted-foreground"
            >
              No passengers added yet. Please go back to Setup.
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-10"
            >
              {trip.passengers.map((pax) => {
                const selectedTransportId = trip.selectedTransports.find(t => t.passengerId === pax.id)?.transportOptionId;

                return (
                  <motion.section 
                    variants={itemVariants}
                    key={pax.id} 
                    className="bg-card p-6 rounded-2xl border border-border shadow-lg transition-colors"
                  >
                    <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{pax.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {pax.city || 'Unknown Origin'} → {trip.destination}
                        </p>
                      </div>
                      {pax.transportPreference && pax.transportPreference !== 'any' && (
                        <div className="text-sm font-medium bg-muted text-muted-foreground px-3 py-1 rounded-full border border-border">
                          Prefers: {pax.transportPreference}
                        </div>
                      )}
                    </div>

                        {/* Accordion Sections for Transport Types */}
                    <div className="space-y-4">
                      {['flight', 'train', 'cross', 'bus', 'cab'].map((type) => {
                        const destination = trip.destination || 'Unknown';
                        const key = `${pax.id}-${pax.city}-${destination}-${type}-v6`;
                        const isFetched = cachedData[key] !== undefined;
                        const task = fetchQueue.tasks.find(t => t.id === key);
                        const isLoading = task?.status === 'loading';

                        const rawData = cachedData[key] || {};
                        const rawOptions = rawData.options || (Array.isArray(rawData) ? rawData : []);
                        const crossRoutes = rawData.cross_routes || [];
                        const typeOptionsRaw = type === 'cross' ? crossRoutes : rawOptions.filter((o: any) => o.type === type || (type === 'cab' && o.type === 'car'));
                        
                        const currentSort = sortBy[key] || '';
                        let typeOptions = [...typeOptionsRaw];
                        if (currentSort === 'cheapest') {
                          typeOptions.sort((a, b) => a.price - b.price);
                        } else if (currentSort === 'fastest') {
                          typeOptions.sort((a, b) => parseDuration(a.duration) - parseDuration(b.duration));
                        } else if (currentSort === 'earliest') {
                          typeOptions.sort((a, b) => parseTime(a.departure) - parseTime(b.departure));
                        }
                        
                        const currentActive = activeTabs[pax.id] ?? '';
                        const isActive = currentActive === type && (isFetched ? typeOptions.length > 0 : true);
                        
                        return (
                          <div key={type} className={`border-2 border-border rounded-xl overflow-hidden bg-card transition-all ${isFetched && typeOptions.length === 0 ? 'opacity-60' : ''}`}>
                            {/* Accordion Header */}
                            <button
                              onClick={() => handleAccordionClick(pax, type)}
                              disabled={isFetched && typeOptions.length === 0}
                              className={`w-full px-6 py-4 flex items-center justify-between font-bold transition-colors ${
                                isActive 
                                  ? 'bg-primary/10 text-primary' 
                                  : (isFetched && typeOptions.length === 0 ? 'bg-muted/30 text-muted-foreground cursor-not-allowed' : 'hover:bg-muted/50 text-foreground')
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {getTransportIcon(type)}
                                <span className="capitalize text-lg">{type === 'bus' ? 'buses' : type === 'cross' ? 'connecting routes' : `${type}s`}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-sm px-3 py-1 rounded-full border ${isFetched && typeOptions.length === 0 ? 'bg-muted/50 border-transparent text-muted-foreground' : 'bg-background border-border'} ${isLoading ? 'animate-pulse text-primary' : ''}`}>
                                  {isLoading ? 'Searching...' : (!isFetched ? 'Click to search' : (typeOptions.length === 0 ? `No ${type === 'bus' ? 'buses' : type === 'cross' ? 'connecting routes' : type + 's'} available` : `${typeOptions.length} Options`))}
                                </span>
                                {(!isFetched || typeOptions.length > 0) && (
                                  <motion.div
                                    animate={{ rotate: isActive ? 180 : 0 }}
                                    className="text-muted-foreground"
                                  >
                                    ▼
                                  </motion.div>
                                )}
                              </div>
                            </button>
                            
                            {/* Accordion Content */}
                            <AnimatePresence initial={false}>
                              {isActive && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-4 space-y-3 bg-muted/20 border-t-2 border-border">
                                    {isLoading ? (
                                      <div className="flex items-center justify-center p-8 text-muted-foreground font-medium">
                                        <Loader2 className="animate-spin mr-3 shrink-0" size={20} /> Searching live {type === 'bus' ? 'buses' : type === 'cross' ? 'connecting routes' : type + 's'}...
                                      </div>
                                    ) : (
                                      <>
                                        {typeOptions.length > 0 && (
                                          <div className="flex justify-end mb-2">
                                            <select 
                                              className="p-1.5 border border-border rounded-lg bg-background outline-none focus:border-primary text-xs font-medium text-foreground cursor-pointer shadow-sm transition-colors"
                                              value={currentSort}
                                              onChange={(e) => setSortBy({ ...sortBy, [key]: e.target.value as any })}
                                            >
                                              <option value="" disabled>Select here</option>
                                              <option value="cheapest">Cheapest First</option>
                                              <option value="fastest">Fastest First</option>
                                              <option value="earliest">Earliest Departure</option>
                                            </select>
                                          </div>
                                        )}
                                        {typeOptions.map((opt, idx) => {
                                          const isSelected = selectedTransportId === opt.id;
                                          return (
                                            <motion.div 
                                              initial={{ opacity: 0, x: -10 }}
                                              animate={{ opacity: 1, x: 0 }}
                                              transition={{ delay: idx * 0.05 }}
                                              key={opt.id}
                                              onClick={() => handleSelectTransport(pax.id, opt)}
                                              whileHover={{ scale: 1.01 }}
                                              whileTap={{ scale: 0.99 }}
                                              className={`
                                                relative flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-colors bg-card
                                                ${isSelected 
                                                  ? 'border-primary bg-primary/10 shadow-sm' 
                                                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                                }
                                              `}
                                            >
                                  <div className="flex items-center gap-4">
                                    {isSelected ? (
                                      <CheckCircle2 className="text-primary shrink-0" size={24} />
                                    ) : (
                                      <Circle className="text-muted-foreground/50 shrink-0" size={24} />
                                    )}
                                    
                                    {opt.type === 'flight' && getAirlineLogo(opt.provider) ? (
                                      <div className="bg-white rounded-lg shadow-sm border border-border flex items-center justify-center overflow-hidden shrink-0" style={{ width: '100px', height: '60px' }}>
                                        <img 
                                          src={getAirlineLogo(opt.provider)!} 
                                          alt={opt.provider} 
                                          className={`object-contain mix-blend-multiply ${getAirlineLogoStyles(opt.provider)}`}
                                          style={{ imageRendering: 'high-quality' }}
                                        />
                                      </div>
                                    ) : (opt.type === 'cab' || opt.type === 'car') && getCabLogo(opt.provider) ? (
                                      <div className="bg-white rounded-lg shadow-sm border border-border flex items-center justify-center overflow-hidden shrink-0" style={{ width: '100px', height: '60px' }}>
                                        <img 
                                          src={getCabLogo(opt.provider)!} 
                                          alt={opt.provider} 
                                          className={`object-contain mix-blend-multiply ${getCabLogoStyles(opt.provider)}`}
                                          style={{ imageRendering: 'high-quality' }}
                                        />
                                      </div>
                                    ) : (
                                      <div className="bg-background rounded-lg shadow-sm border border-border flex items-center justify-center shrink-0" style={{ width: '56px', height: '56px' }}>
                                        {getTransportIcon(opt.type)}
                                      </div>
                                    )}

                                    <div>
                                      <div className="flex items-center gap-3">
                                        <span className="font-bold uppercase tracking-wider text-sm">
                                          {opt.type === 'flight' ? (opt.provider || '').split('*')[0].trim() : (opt.provider || opt.type)}
                                        </span>
                                        {opt.type !== 'cross' && isSelected && (
                                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground ml-2 bg-muted/30 px-3 py-1 rounded-full border border-border/50">
                                            <span className="font-bold uppercase truncate max-w-[50px] text-foreground/80">{pax.city}</span>
                                            <div className="relative w-16 h-3 flex items-center justify-center">
                                              <div className="absolute inset-x-0 border-t border-dashed border-primary/40 top-1/2 -translate-y-1/2"></div>
                                              <motion.div
                                                initial={{ left: "0%", opacity: 0 }}
                                                animate={{ left: ["0%", "20%", "80%", "100%"], opacity: [0, 1, 1, 0] }}
                                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                                              >
                                                {opt.type === 'flight' ? (
                                                  <Plane size={12} className="text-primary rotate-45" fill="currentColor" />
                                                ) : opt.type === 'train' ? (
                                                  <Train size={12} className="text-primary" />
                                                ) : opt.type === 'bus' ? (
                                                  <Bus size={12} className="text-primary" />
                                                ) : (
                                                  <Car size={12} className="text-primary" />
                                                )}
                                              </motion.div>
                                            </div>
                                            <span className="font-bold uppercase truncate max-w-[50px] text-foreground/80">{trip.destination}</span>
                                          </div>
                                        )}
                                      </div>
                                      {(!(opt.type !== 'cross' && isSelected)) && opt.type !== 'cross' && (
                                        <div className="text-sm text-muted-foreground mt-1">
                                          {String(opt.departure).includes('T') ? String(opt.departure).split('T')[1].slice(0,5) : opt.departure} <ArrowRight className="inline mx-1" size={14}/> {String(opt.arrival).includes('T') ? String(opt.arrival).split('T')[1].slice(0,5) : opt.arrival} ({opt.duration})
                                        </div>
                                      )}
                                        
                                        {opt.type === 'train' && opt.id.startsWith('tr_') && (
                                          <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                                            <button 
                                              onClick={() => {
                                                setActiveTrainId(opt.id.split('_')[1]);
                                                setRouteModalOpen(true);
                                              }}
                                              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-muted text-foreground hover:bg-primary hover:text-primary-foreground transition-colors border border-border"
                                            >
                                              View Route
                                            </button>
                                            <button 
                                              onClick={() => {
                                                setActiveTrainId(opt.id.split('_')[1]);
                                                setLiveModalOpen(true);
                                              }}
                                              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
                                            >
                                              Live Status
                                            </button>
                                          </div>
                                        )}
                                        {opt.type === 'cross' && opt.legs && (
                                          <div className="mt-3 space-y-2 border-t border-border pt-3 w-full" onClick={(e) => e.stopPropagation()}>
                                            {opt.legs.map((leg: any, lIdx: number) => (
                                              <div key={lIdx} className="flex justify-between items-center text-xs bg-background/50 p-2 rounded-lg border border-border">
                                                <div className="flex items-center gap-2">
                                                  <div className="scale-75 origin-left">{getTransportIcon(leg.mode)}</div>
                                                  <span className="font-semibold text-foreground/80">{leg.source} → {leg.destination}</span>
                                                </div>
                                                <div className="text-muted-foreground flex gap-3 text-right">
                                                  <span>{leg.provider}</span>
                                                  <span className="font-medium">₹{leg.price}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                  </div>

                                  <div className="text-right">
                                    <div className="text-xl font-bold text-foreground">₹{opt.price.toLocaleString('en-IN')}</div>
                                    {opt.type === 'flight' && (
                                      <div className="text-[10px] text-muted-foreground mt-1 text-right">
                                        * These prices are tentative.
                                      </div>
                                    )}
                                  </div>
                                            </motion.div>
                                          );
                                        })}
                                      </>
                                    )}
                                  </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                  </motion.section>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* CONTINUATION */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex justify-between items-center pt-8 border-t border-border"
        >
          <button 
            onClick={() => router.push('/plan/setup')}
            className="text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            ← Back to Setup
          </button>
          <motion.button 
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/plan/places')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"
          >
            Discover Places <ArrowRight size={20} />
          </motion.button>
        </motion.div>
      </div>

      {/* Prompt removed as requested */}

      <TrainRouteModal 
        isOpen={routeModalOpen} 
        onClose={() => setRouteModalOpen(false)} 
        trainNumber={activeTrainId} 
      />
      <LiveStatusModal 
        isOpen={liveModalOpen} 
        onClose={() => setLiveModalOpen(false)} 
        trainNumber={activeTrainId} 
      />
      <StationBoardModal 
        isOpen={stationBoardOpen} 
        onClose={() => setStationBoardOpen(false)} 
        stationCode={trip.destination}
        stationName={trip.destination}
      />
    </div>
  );
}
