'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, LogOut, Map, History, Compass, ChevronRight, MessageSquare, ChevronDown, Trash2, Check, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { UserAvatar } from '@/components/UserAvatar';
import { useTripStore } from '@/store/tripStore';
import { useItineraryStore } from '@/store/itineraryStore';
import { useBudgetStore } from '@/store/budgetStore';
import { FeedbackModal } from '@/components/FeedbackModal';
import ModernDateRangePicker from '@/components/ModernDateRangePicker';

let cachedTrips: any[] | null = null;
let lastFetchedTime = 0;

export default function ProfilePage() {
  const { user, fetchUser, isLoading, logout } = useAuthStore();
  const router = useRouter();
  const [trips, setTrips] = useState<any[]>(cachedTrips || []);
  const [loadingTrips, setLoadingTrips] = useState(!cachedTrips);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<string | null>(null);
  const [wrappedRange, setWrappedRange] = useState('all-time');
  const [wrappedStartDate, setWrappedStartDate] = useState('');
  const [wrappedEndDate, setWrappedEndDate] = useState('');

  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (user) {
      const isStale = Date.now() - lastFetchedTime > 5 * 60 * 1000;
      if (!cachedTrips || isStale) {
        if (!cachedTrips) setLoadingTrips(true);
        fetch('/api/trips')
          .then(res => res.json())
          .then(data => {
            const fetchedTrips = data.trips || [];
            cachedTrips = fetchedTrips;
            lastFetchedTime = Date.now();
            setTrips(fetchedTrips);
            setLoadingTrips(false);
          })
          .catch(() => setLoadingTrips(false));
      }
    } else if (!isLoading) {
      // If not loading and no user, redirect to login
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const handleLogout = async () => {
    cachedTrips = null;
    lastFetchedTime = 0;
    await logout();
    router.push('/');
  };

  const executeDeleteTrip = async (tripId: string) => {
    try {
      const res = await fetch(`/api/trips?id=${tripId}`, { method: 'DELETE' });
      if (res.ok) {
        const newTrips = trips.filter(t => t.id !== tripId);
        setTrips(newTrips);
        if (cachedTrips) {
          cachedTrips = cachedTrips.filter(t => t.id !== tripId);
        }
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        alert('Failed to delete trip.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete trip.');
    }
    setTripToDelete(null);
  };

  const handleTripClick = (trip: any) => {
    const snap = trip.snapshot as any;
    
    if (snap.type === 'quick-trip') {
       localStorage.setItem('quickTripData', JSON.stringify(snap));
       router.push('/quick-trip');
       return;
    }

    // Load into global stores
    useTripStore.getState().loadSnapshot(snap, trip.destination);
    useItineraryStore.getState().loadSnapshot(snap);
    useBudgetStore.getState().loadSnapshot(snap);
    
    // Redirect to review page in read-only mode
    router.push('/plan/review');
  };

  if (isLoading || !user) {
    return (
      <AppShell>
        <div className="w-full min-h-[calc(100vh-2rem)] bg-[#0A0A0A] text-[#EDEDED] flex items-center justify-center rounded-3xl">
          <div className="flex flex-col items-center gap-6">
             <div className="w-12 h-12 border border-white/20 border-t-white rounded-full animate-spin" />
             <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest animate-pulse">Authenticating...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="w-full min-h-[calc(100vh-2rem)] bg-[#0A0A0A] text-[#EDEDED] p-8 lg:p-16 rounded-3xl font-sans">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 sm:gap-0 mb-10 sm:mb-16 border-b border-white/10 pb-6 sm:pb-8">
          <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-8 w-full sm:w-auto">
            <button 
              onClick={() => router.push('/')} 
              className="text-white/40 hover:text-white transition-colors flex items-center gap-2 font-bold text-[10px] sm:text-xs uppercase tracking-widest group shrink-0"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </button>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tighter text-white shrink-0">Profile</h1>
            <button 
              onClick={handleLogout} 
              className="sm:hidden text-red-500/60 hover:text-red-500 transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest shrink-0"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-4 shrink-0">
            <button
              onClick={() => setIsFeedbackOpen(true)}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center justify-center text-white shrink-0"
              title="Send us Feedback"
            >
              <MessageSquare size={14} />
            </button>
            <button 
              onClick={handleLogout} 
              className="text-red-500/60 hover:text-red-500 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest ml-2"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-20">
          
          {/* Identity Section (Left) */}
          <div className="w-full lg:w-80 flex flex-col items-start space-y-8">
            
            <div>
              <UserAvatar user={user} className="w-40 h-40 text-5xl border border-white/10 shadow-xl" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-light tracking-tight text-white">{user.name}</h2>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">{user.email}</p>
            </div>

            <div className="pt-8 border-t border-white/10 w-full space-y-4">
               {['kartikeykumarsingh27jun2006@gmail.com', 'growwayushh@gmail.com', 'aawasthiapoorv@gmail.com'].includes(user.email) && (
                 <div className="flex justify-between items-center text-sm font-light">
                   <span className="text-white/40">Account Type</span>
                   <span className="text-white">Admin</span>
                 </div>
               )}
               <div className="flex justify-between items-center text-sm font-light">
                 <span className="text-white/40">Trips Planned</span>
                 <span className="text-white">{trips.length}</span>
               </div>
            </div>

          </div>

          {/* Mission History Section (Right) */}
          <div className="flex-1 flex flex-col">
            
            {/* BrewPlans Wrapped Section */}
            <div className="mb-12 border border-white/10 rounded-2xl p-6 lg:p-8 bg-gradient-to-br from-[#121A3F] to-[#0A0E27] relative group">
              <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#FF3D7F] rounded-full blur-[100px] opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-[#F5B942] rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
              </div>
              
              <div className="relative z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                    BrewPlans Wrapped
                  </h3>
                  <p className="text-sm text-white/60 mt-2 max-w-md">Relive your travels, destinations, and adventures. See your journey visualized like never before.</p>
                </div>
                
                <div className="flex flex-col gap-3 min-w-[200px]">
                  <div className="relative">
                    <select 
                      value={wrappedRange}
                      onChange={(e) => setWrappedRange(e.target.value)}
                      className="w-full py-3 pl-4 pr-10 bg-white/10 text-white font-bold text-xs uppercase tracking-widest rounded-full outline-none border border-white/20 focus:border-white/50 appearance-none cursor-pointer"
                    >
                      <option value="today" className="text-black">Today</option>
                      <option value="this-week" className="text-black">This Week</option>
                      <option value="this-month" className="text-black">This Month</option>
                      <option value="this-year" className="text-black">This Year</option>
                      <option value="all-time" className="text-black">All Time</option>
                      <option value="custom" className="text-black">Custom Date</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                  </div>
                  
                  {wrappedRange === 'custom' && (
                    <div className="pt-2">
                      <ModernDateRangePicker
                        label="Select Custom Dates"
                        startDate={wrappedStartDate}
                        endDate={wrappedEndDate}
                        onChange={(start, end) => {
                          setWrappedStartDate(start || '');
                          setWrappedEndDate(end || '');
                        }}
                      />
                    </div>
                  )}

                  <button 
                    onClick={() => {
                      let url = `/wrapped?range=${wrappedRange}`;
                      if (wrappedRange === 'custom') {
                        url += `&start=${wrappedStartDate}&end=${wrappedEndDate}`;
                      }
                      router.push(url);
                    }}
                    className="w-full py-3 px-6 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-full hover:bg-white/90 transition-colors flex justify-center items-center gap-2 mt-1"
                  >
                    View Wrapped <Compass size={16} />
                  </button>
                </div>
              </div>
            </div>

            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-8 flex items-center gap-3">
              <History size={14} className="text-white/20"/> Past Trips
            </h3>
            
            {loadingTrips ? (
              <div className="py-20 flex justify-center border-t border-white/10">
                 <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest animate-pulse">Retrieving trips...</p>
              </div>
            ) : trips.length === 0 ? (
              <div className="py-20 flex flex-col items-start border-t border-white/10">
                <p className="text-2xl font-light text-white/40 mb-2">No trips on record.</p>
                <p className="text-sm font-light text-white/20 mb-8">You haven't planned any trips yet.</p>
                <button 
                  onClick={() => router.push('/plan/setup')}
                  className="bg-white text-black px-8 py-3 font-bold uppercase tracking-widest text-xs hover:bg-white/90 transition-all flex items-center gap-3"
                >
                  Plan a New Trip <Compass size={16} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col border-t border-white/10">
                {trips.map((trip, i) => {
                  const snap = trip.snapshot as any;
                  return (
                    <div key={trip.id} className="group flex items-center justify-between py-8 border-b border-white/10 hover:bg-white/[0.02] -mx-8 px-8 transition-colors cursor-pointer" onClick={() => handleTripClick(trip)}>
                      
                      <div className="flex items-center gap-8">
                        <span className="text-white/20 font-bold text-xl group-hover:text-white/40 transition-colors">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <h4 className="text-2xl font-light text-white">{trip.destination}</h4>
                          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-2">
                            Created {new Date(trip.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-16">
                        <div className="hidden md:block">
                          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Travelers</p>
                          <p className="text-lg font-light text-white">{snap.passengers?.length || 0}</p>
                        </div>
                        <div className="hidden sm:block">
                          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Budget Expended</p>
                          <p className="text-lg font-light text-white">₹{snap.budget?.spent?.toLocaleString('en-IN') || 0}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setTripToDelete(trip.id); }}
                            className="text-red-500/50 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-full transition-all"
                            title="Delete Trip"
                          >
                            <Trash2 size={18} />
                          </button>
                          <ChevronRight size={20} className="text-white/20 group-hover:text-white transition-colors" />
                        </div>
                      </div>

                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      {/* Delete Confirmation Modal */}
      {tripToDelete && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111] border border-[#333] rounded-2xl p-6 md:p-8 max-w-sm w-full shadow-2xl relative">
            <h3 className="text-xl font-bold text-white mb-2">Delete Trip</h3>
            <p className="text-sm text-zinc-400 mb-8">Are you sure you want to delete this trip? This action cannot be undone.</p>
            
            <div className="flex gap-4 justify-end">
              <button 
                onClick={() => setTripToDelete(null)}
                className="flex-1 py-3 px-4 bg-[#222] hover:bg-[#333] text-white font-bold text-sm uppercase tracking-widest rounded-xl transition-colors flex justify-center items-center gap-2"
              >
                <X size={16} className="text-red-500" /> Cancel
              </button>
              <button 
                onClick={() => executeDeleteTrip(tripToDelete)}
                className="flex-1 py-3 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 font-bold text-sm uppercase tracking-widest rounded-xl transition-colors flex justify-center items-center gap-2"
              >
                <Check size={16} className="text-green-500" /> Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] bg-[#111] border border-green-500/30 shadow-2xl shadow-green-500/10 text-green-400 px-6 py-3 rounded-full flex items-center gap-3 animate-in fade-in slide-in-from-bottom-8 duration-300">
          <Check size={18} />
          <span className="text-sm font-bold tracking-wide">Trip Successfully Deleted</span>
        </div>
      )}
    </AppShell>
  );
}
