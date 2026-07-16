'use client';

import React, { useState } from 'react';
import { useTripStore } from '@/store/tripStore';
import { useBudgetStore } from '@/store/budgetStore';
import { useItineraryStore } from '@/store/itineraryStore';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import CityAutocomplete from '@/components/CityAutocomplete';
import ModernDateRangePicker from '@/components/ModernDateRangePicker';
import { Plus, Trash2, ArrowRight, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useCacheStore } from '@/store/cacheStore';
import { useFetchQueue } from '@/store/fetchQueueStore';
import { motion } from 'framer-motion';
import AnimatedGlobe from '@/components/AnimatedGlobe';

const TRIP_STYLES = [
  { id: 'family', label: 'Family' },
  { id: 'solo', label: 'Solo' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'luxury', label: 'Luxury' }
];

export default function TripSetupPage() {
  const router = useRouter();
  const trip = useTripStore();
  const budget = useBudgetStore();
  const { user } = useAuthStore();
  const [tripStyle, setTripStyle] = useState('family');
  const [error, setError] = useState('');
  const [savedPassengers, setSavedPassengers] = useState<any[]>([]);

  React.useEffect(() => {
    if (user) {
      fetch('/api/passengers', {
        headers: { 'x-user-id': user.id }
      })
        .then(res => res.json())
        .then(data => {
          if (data.passengers) setSavedPassengers(data.passengers);
        })
        .catch(console.error);
    }
  }, [user]);

  const handleAddPassenger = () => {
    trip.addPassenger({
      id: `pax_${Date.now()}`,
      tripId: 'TRIP_CURRENT',
      name: '',
      age: '' as unknown as number,
      gender: '' as any,
      pincode: '',
      city: '',
      transportPreference: 'any'
    });
  };

  const handleContinue = async () => {
    setError('');
    const validPassengers = trip.passengers.filter(p => p.name.trim() !== '');
    if (validPassengers.length === 0) {
      setError('Please add at least one passenger.');
      return;
    }
    if (!budget.totalBudget || budget.totalBudget <= 0) {
      setError('Please enter a valid total budget for the trip.');
      return;
    }

    if (user) {
      const passengersToSave = validPassengers.filter(p => p.remember);
      if (passengersToSave.length > 0) {
        await Promise.all(passengersToSave.map(p => 
          fetch('/api/passengers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
            body: JSON.stringify({ name: p.name, age: p.age, gender: p.gender, city: p.city })
          }).catch(console.error)
        ));
      }
    }

    const dest = trip.destination;
    
    if (!dest) {
      setError('Please select a destination.');
      return;
    }

    if (trip.passengers.some(p => p.city && p.city.toLowerCase() === dest.toLowerCase())) {
      setError('Source and destination cannot be the same.');
      return;
    }

    router.push('/plan/transport');
  };

  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center p-2 sm:p-4 md:p-8 bg-background transition-colors duration-300" style={{ fontFamily: "'Outfit', sans-serif" }}>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full h-[calc(100vh-4.5rem)] md:h-[min(800px,85vh)] md:max-w-4xl relative flex flex-row shadow-2xl md:shadow-[0_40px_100px_rgba(0,0,0,0.8)] rounded-2xl overflow-hidden border border-border"
      >
        
        {/* Main Configuration Body */}
        <div className="w-[60%] sm:w-[50%] md:w-auto md:flex-1 lg:flex-[1.2] shrink-0 bg-card text-foreground p-3 sm:p-4 md:p-6 lg:p-12 relative border-r border-border transition-colors overflow-y-auto overflow-x-hidden">
          
          <div className="flex justify-between items-center mb-4 md:mb-10">
            <h2 className="text-lg md:text-3xl font-light tracking-tight text-foreground">Trip Details</h2>
          </div>

          <div className="space-y-6 md:space-y-10">
            {/* Row 1: Destination & Dates */}
            <div className="grid grid-cols-2 gap-2 md:gap-8">
              <div className="space-y-1.5 sm:space-y-3 min-w-0">
                <label className="block text-[9px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest truncate">Destination</label>
                <div className="relative text-white z-50">
                  <CityAutocomplete 
                    label="" 
                    placeholder="Where to?" 
                    value={trip.destination} 
                    onChange={(val) => {
                      if (val !== trip.destination) {
                        budget.reset();
                        useItineraryStore.getState().reset();
                        useCacheStore.getState().clearCache();
                        useFetchQueue.getState().clearQueue();
                        trip.setTripDetails({ destination: val, selectedTransports: [], selectedHotel: null });
                      }
                    }} 
                  />
                  {trip.destination && trip.passengers.some(p => p.city && p.city.toLowerCase() === trip.destination.toLowerCase()) && (
                    <div className="absolute top-full mt-1.5 left-0 text-red-500 text-[11px] font-medium flex items-center gap-1.5 bg-red-500/10 px-2 py-1.5 rounded-md backdrop-blur-sm border border-red-500/20 whitespace-nowrap">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>Enter a valid destination (current city and the destination are same for the traveller)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-3 min-w-0">
                <label className="block text-[9px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest truncate">Dates</label>
                <div className="relative text-white z-40">
                  <ModernDateRangePicker 
                    label=""
                    startDate={trip.startDate}
                    endDate={trip.endDate}
                    onChange={(start, end) => trip.setTripDetails({ startDate: start, endDate: end })}
                    minDate={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Budget */}
            <div className="space-y-1.5 sm:space-y-3">
              <label className="block text-[9px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest truncate">Total Budget (INR)</label>
              <div className="flex items-center gap-3 border-b border-border pb-2 hover:border-primary/50 transition-colors">
                <span className="text-xl font-medium text-muted-foreground">₹</span>
                <input 
                  type="text" inputMode="numeric" pattern="[0-9]*" placeholder="100000"
                  value={budget.totalBudget || ''}
                  onChange={(e) => {
                    const cleanStr = e.target.value.replace(/\D/g, '');
                    if (!cleanStr) {
                      budget.setTotalBudget(0);
                    } else {
                      const val = parseInt(cleanStr, 10);
                      budget.setTotalBudget(isNaN(val) ? 0 : val);
                    }
                  }}
                  className="w-full bg-transparent border-none focus:outline-none text-lg font-medium text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {/* Row 3: Passengers */}
            <div className="pt-8 border-t border-neutral-800">
               <div className="flex flex-row justify-between items-center mb-5 gap-2">
                 <label className="block text-[9px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest truncate">Passengers</label>
                 <button onClick={handleAddPassenger} className="text-muted-foreground hover:text-foreground text-[9px] sm:text-[11px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors whitespace-nowrap shrink-0">
                   <Plus size={12}/> Add Passenger
                 </button>
               </div>

               <div className="space-y-4">
                  {trip.passengers.map((pax, i) => (
                    <div key={pax.id} className="relative bg-card border border-border rounded-xl p-5 mb-3 shadow-sm hover:border-primary/40 transition-all">
                      {/* Header */}
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">Passenger {String(i + 1).padStart(2, '0')}</div>
                        {i > 0 && (
                          <button onClick={() => trip.removePassenger(pax.id)} className="text-red-500/50 hover:text-red-500 transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
                            <Trash2 size={12} /> Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Name Input with Autocomplete */}
                        <div className="md:col-span-5 relative">
                          <label className="block text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 truncate">Full Name</label>
                          <input 
                            type="text" placeholder="e.g. John Doe"
                            className="w-full h-10 bg-muted/30 border border-border rounded-lg px-3 text-sm text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50"
                            value={pax.name} 
                            onChange={(e) => trip.updatePassenger(pax.id, { name: e.target.value.replace(/[^a-zA-Z\s]/g, '') })}
                          />
                          {pax.name && [...savedPassengers, ...trip.passengers.filter(p => p.remember && p.id !== pax.id && p.name)]
                            .filter((sp, index, self) => index === self.findIndex((t) => t.name === sp.name))
                            .filter(sp => sp.name.toLowerCase().startsWith(pax.name.toLowerCase()) && sp.name !== pax.name).length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                              {[...savedPassengers, ...trip.passengers.filter(p => p.remember && p.id !== pax.id && p.name)]
                                .filter((sp, index, self) => index === self.findIndex((t) => t.name === sp.name))
                                .filter(sp => sp.name.toLowerCase().startsWith(pax.name.toLowerCase()) && sp.name !== pax.name)
                                .map((sp, idx) => (
                                  <button
                                    key={idx}
                                    className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                                    onClick={() => {
                                      trip.updatePassenger(pax.id, {
                                        name: sp.name,
                                        age: sp.age,
                                        gender: sp.gender as any,
                                        city: sp.city || pax.city
                                      });
                                    }}
                                  >
                                    <div className="font-medium text-foreground">{sp.name}</div>
                                    <div className="text-[10px] text-muted-foreground mt-1 tracking-wide uppercase">{sp.city || 'Unknown City'} • {sp.age}yo • {sp.gender}</div>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>

                        {/* Age Input */}
                        <div className="md:col-span-3">
                          <label className="block text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 truncate">Age</label>
                          <input 
                            type="number" placeholder="Years" min="1" max="120"
                            className="w-full h-10 bg-muted/30 border border-border rounded-lg px-3 text-sm text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50"
                            value={pax.age || ''} 
                            onChange={(e) => {
                              const cleanStr = e.target.value.replace(/\D/g, '');
                              const val = parseInt(cleanStr);
                              trip.updatePassenger(pax.id, { age: isNaN(val) ? '' as any : Math.max(1, val) });
                            }}
                          />
                        </div>

                        {/* Gender Select */}
                        <div className="md:col-span-4">
                          <label className="block text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 truncate">Gender</label>
                          <div className="relative">
                            <select 
                              className="w-full h-10 bg-muted/30 border border-border rounded-lg px-2 sm:px-3 text-xs sm:text-sm text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary transition-all appearance-none"
                              value={pax.gender || ''} 
                              onChange={(e) => trip.updatePassenger(pax.id, { gender: e.target.value as any })}
                            >
                              <option value="" disabled>Select</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* City Input */}
                        <div className="md:col-span-6 relative z-10">
                          <label className="block text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 truncate">Current City</label>
                          <CityAutocomplete 
                            label="" placeholder="Where is this person currently" 
                            value={pax.city || ''} 
                            onChange={(val) => trip.updatePassenger(pax.id, { city: val })} 
                          />
                        </div>

                        {/* Remember Checkbox */}
                        <div className="md:col-span-6 flex items-end pb-2 sm:pl-2">
                           <label className="flex items-center gap-2 cursor-pointer text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors">
                             <input 
                               type="checkbox" 
                               checked={pax.remember || false}
                               onChange={(e) => trip.updatePassenger(pax.id, { remember: e.target.checked })}
                               className="accent-primary w-3.5 h-3.5 rounded-md border-border bg-muted/30 cursor-pointer"
                             />
                             Remember this passenger
                           </label>
                        </div>
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              {error && (
                <div className="mb-4 text-red-400 text-[11px] font-bold uppercase tracking-widest bg-red-500/10 px-4 py-3 rounded-lg shadow-sm backdrop-blur-md text-center">
                  {error}
                </div>
              )}
              <button 
                onClick={handleContinue}
                className="w-full py-3 sm:py-4 bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[9px] sm:text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 sm:gap-2.5 rounded-xl shadow-lg whitespace-nowrap overflow-hidden px-2"
              >
                <span>Continue to Transport</span> <ArrowRight size={14} className="shrink-0"/>
              </button>
            </div>

          </div>
        </div>

        {/* Right Map View (Globe) */}
        <div className="w-[40%] sm:w-[50%] md:w-auto md:flex-1 shrink-0 bg-background relative overflow-hidden flex flex-col transition-colors border-0">
           <AnimatedGlobe passengers={trip.passengers} destination={trip.destination} />
        </div>

      </motion.div>
    </div>
  );
}
