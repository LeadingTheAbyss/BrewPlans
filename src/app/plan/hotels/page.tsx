'use client';

import React, { useEffect, useState } from 'react';
import { useTripStore } from '@/store/tripStore';
import { useBudgetStore } from '@/store/budgetStore';
import { useCacheStore } from '@/store/cacheStore';
import { Hotel } from '@/types/trip';
import { api } from '@/lib/api';
import { ArrowRight, CheckCircle2, Circle, AlertCircle, MapPin, ShieldCheck, Star, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StreetWalkModal } from '@/components/StreetWalkModal';

export default function HotelsPage() {
  const router = useRouter();
  const trip = useTripStore();
  const budget = useBudgetStore();

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'best' | 'closest' | 'budget'>('best');
  const [activeStreetWalk, setActiveStreetWalk] = useState<Hotel | null>(null);

  // Calculate nights
  const calculateNights = () => {
    if (!trip.startDate || !trip.endDate) return 3; // default fallback
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  };

  const nights = calculateNights();

  useEffect(() => {
    const fetchHotels = async () => {
      setLoading(true);
      const cached = useCacheStore.getState().getCache('hotels');
      if (cached) {
        setHotels(cached);
        setLoading(false);
        return;
      }

      const data = await api.getHotels(trip.destination);
      useCacheStore.getState().setCache('hotels', data);
      setHotels(data);
      setLoading(false);
    };
    if (trip.destination) fetchHotels();
    else setLoading(false);
  }, [trip.destination]);

  const handleSelectHotel = (hotel: Hotel) => {
    // Toggle off if already selected
    if (trip.selectedHotel?.id === hotel.id) {
      budget.removeExpense('hotel', hotel.pricePerNight * nights);
      trip.setHotel(null);
      budget.recalcBudget();
      return;
    }

    // Remove old hotel cost if exists
    if (trip.selectedHotel) {
      budget.removeExpense('hotel', trip.selectedHotel.pricePerNight * nights);
    }

    const hotelWithNights = { ...hotel, nights: nights };

    // Set new hotel
    trip.setHotel(hotelWithNights);

    // Charge new hotel
    budget.addExpense('hotel', hotel.pricePerNight * nights);

    budget.recalcBudget();
  };

  return (
    <div className="min-h-screen bg-background pt-10 px-4 text-foreground transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-12 pb-24">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold mb-2">Hotel Selection</h1>
            <p className="text-muted-foreground">
              Where will you stay for {nights} nights in {trip.destination || 'the destination'}?
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground animate-pulse">
            Clustering places and finding best hotels...
          </div>
        ) : hotels.length === 0 ? (
          <div className="p-8 border-2 border-dashed border-border rounded-xl text-center text-muted-foreground">
            No hotels found. Go back to Setup and enter a destination.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-2 text-sm">
              <button
                onClick={() => setSortBy('best')}
                className={`${sortBy === 'best' ? 'bg-primary/20 text-primary border-primary/50' : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'} font-medium px-4 py-2 rounded-lg border transition-colors`}
              >
                Best Overall
              </button>
              <button
                onClick={() => setSortBy('closest')}
                className={`${sortBy === 'closest' ? 'bg-primary/20 text-primary border-primary/50' : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'} font-medium px-4 py-2 rounded-lg border transition-colors`}
              >
                Closest to Places
              </button>
              <button
                onClick={() => setSortBy('budget')}
                className={`${sortBy === 'budget' ? 'bg-primary/20 text-primary border-primary/50' : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'} font-medium px-4 py-2 rounded-lg border transition-colors`}
              >
                Budget
              </button>
            </div>

            <div className="space-y-4">
              {(() => {
                let sortedHotels = [...hotels];
                if (sortBy === 'closest') {
                  sortedHotels.sort((a, b) => a.distanceToCluster - b.distanceToCluster);
                } else if (sortBy === 'budget') {
                  sortedHotels.sort((a, b) => a.pricePerNight - b.pricePerNight);
                } else {
                  sortedHotels.sort((a, b) => b.rating - a.rating);
                }

                return sortedHotels.map((hotel) => {
                  const isSelected = trip.selectedHotel?.id === hotel.id;
                  const totalCost = hotel.pricePerNight * nights;
                  const remainingAfter = budget.remaining + (isSelected ? 0 : (trip.selectedHotel ? (trip.selectedHotel.pricePerNight * nights) : 0)) - totalCost;

                  return (
                    <div
                      key={hotel.id}
                      onClick={() => handleSelectHotel(hotel)}
                      className={`
                        relative flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all duration-300
                        ${isSelected
                          ? 'border-primary bg-primary/5 shadow-[0_0_0_1px_currentColor] text-primary'
                          : 'border-border/60 bg-card hover:border-foreground/20 hover:bg-muted/30'
                        }
                      `}
                    >
                      {isSelected && (
                        <div className="absolute -top-2.5 -right-2.5 bg-background rounded-full p-0.5 shadow-sm">
                          <CheckCircle2 className="text-primary w-6 h-6 fill-background" />
                        </div>
                      )}

                      <div className="flex items-center gap-5 w-full">
                        {/* Thumbnail */}
                        <div className="w-20 h-20 shrink-0 rounded-xl bg-gradient-to-br from-muted to-muted/50 border border-border/50 flex items-center justify-center overflow-hidden">
                          {hotel.imageUrl ? (
                            <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-muted-foreground/30 font-medium text-[10px] uppercase tracking-widest rotate-[-45deg]">Hotel</div>
                          )}
                        </div>

                        {/* Middle Info */}
                        <div className="flex-1">
                          <h3 className={`text-lg font-semibold leading-tight mb-1.5 flex items-center gap-2 ${isSelected ? 'text-foreground' : 'text-foreground'}`}>
                            {hotel.name}
                            <span className="text-sm font-semibold text-foreground inline-flex items-center gap-1">
                              <Star size={14} className="fill-yellow-500 text-yellow-500" /> {hotel.rating}
                            </span>
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
                              <MapPin size={14} className="text-foreground/50" />
                              {hotel.distanceToCluster} km to places
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveStreetWalk(hotel);
                              }}
                              className="flex items-center gap-1.5 text-xs font-semibold text-primary/80 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-md transition-colors"
                            >
                              <Eye size={14} /> Use Street Walk
                            </button>
                          </div>

                          {/* Warnings if budget tight */}
                          {remainingAfter < 0 && !isSelected && (
                            <div className="mt-2 text-xs font-medium text-red-500/90 flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded-md inline-flex w-max">
                              <AlertCircle size={12} /> Exceeds budget by ₹{Math.abs(remainingAfter).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Side Pricing */}
                      <div className="text-right shrink-0 ml-4 flex flex-col items-end justify-center">
                        <div className="text-xl font-semibold text-foreground tracking-tight mb-0.5">
                          ₹{totalCost.toLocaleString()}
                        </div>
                        <div className="text-xs font-medium text-muted-foreground">
                          ₹{hotel.pricePerNight.toLocaleString()}/night • {nights} {nights === 1 ? 'night' : 'nights'}
                        </div>
                      </div>
                    </div>
                  );
                })
              })()}
            </div>
          </div>
        )}

        {/* CONTINUATION */}
        <div className="flex justify-between items-center pt-8 border-t border-border">
          <button
            onClick={() => router.push('/plan/places')}
            className="text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            ← Back to Places
          </button>
          <button
            onClick={() => router.push('/plan/itinerary')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-transform hover:-translate-y-1"
          >
            Build Itinerary <ArrowRight size={20} />
          </button>
        </div>
      </div>

      {activeStreetWalk && (
        <StreetWalkModal
          isOpen={!!activeStreetWalk}
          onClose={() => setActiveStreetWalk(null)}
          lat={activeStreetWalk.coordinates?.[0] ?? 26.8467}
          lng={activeStreetWalk.coordinates?.[1] ?? 80.9462}
          mode="dynamic"
        />
      )}
    </div>
  );
}
