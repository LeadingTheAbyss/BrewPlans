'use client';

import { createPortal } from 'react-dom';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBudgetStore } from '@/store/budgetStore';
import { useTripStore } from '@/store/tripStore';
import { Plane, Building, Landmark, Coffee, User, Menu, ChevronUp, Check, ListFilter, Sun, Moon, X, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { UserAvatar } from '@/components/UserAvatar';
import smallLogo from '@/app/icon.png';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const budget = useBudgetStore();
  const { user, fetchUser } = useAuthStore();
  const [isNotificationDismissed, setIsNotificationDismissed] = useState(false);
  const [isBudgetDropdownOpen, setIsBudgetDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user on mount if not already fetched
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Global Budget Sync to prevent ghost expenses if passengers are deleted
  const trip = useTripStore();
  useEffect(() => {
    const transportTotal = trip.selectedTransports.reduce((acc, t) => acc + t.cost, 0);
    useBudgetStore.getState().setExpense('transport', transportTotal);
    
    // Note: We're omitting places/food auto-sync here because those depend on itineraryStore, 
    // but tripStore (transports) handles the biggest expenses and passenger deletions.
  }, [trip.selectedTransports]);
  
  // Theme state
  const [isDark, setIsDark] = useState(true);
  
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const navLinks = [
    { href: '/plan/setup', label: 'Trip Setup' },
    { href: '/plan/transport', label: 'Transport' },
    { href: '/plan/places', label: 'Places' },
    { href: '/plan/food', label: 'Food' },
    { href: '/plan/hotels', label: 'Hotels' },
    { href: '/plan/itinerary', label: 'Itinerary' },
    { href: '/plan/review', label: 'Review' },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-[#050505] text-neutral-900 dark:text-[#EDEDED] font-sans selection:bg-black/10 dark:selection:bg-white/30 transition-colors duration-300" style={{ fontFamily: "'Outfit', sans-serif" }}>
      
      {/* Horizontal Progression Track */}
      {pathname !== '/profile' && (
        <header className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-[#050505]/90 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-[100] sticky top-0 transition-colors duration-300">
          <div className="flex items-center gap-10">
            <Link href="/" className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-3">
              <img src={smallLogo.src} alt="PlanBro Logo" className="w-10 h-10 object-contain" />
              <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-black dark:text-white">PlanBro</h1>
            </Link>
            
            {pathname !== '/stats' && pathname !== '/recommend' && (
              <nav className="flex items-center gap-6 hidden md:flex">
                {navLinks.map((link, idx) => {
                  const isActive = pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`text-[11px] uppercase font-bold tracking-[0.1em] transition-all ${isActive ? 'text-black dark:text-white' : 'text-neutral-400 dark:text-neutral-500 hover:text-black dark:hover:text-white'}`}
                    >
                      {idx + 1}. {link.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            
            {/* Budget Dropdown in Navbar */}
            {pathname.startsWith('/plan') && (
              <div className="relative">
                <button
                  onClick={() => setIsBudgetDropdownOpen(!isBudgetDropdownOpen)}
                  className="h-7 px-3 rounded-full border border-neutral-300 dark:border-white/20 hover:border-neutral-500 dark:hover:border-white/50 transition-colors flex items-center justify-center bg-neutral-100 dark:bg-white/5 text-neutral-800 dark:text-neutral-200 gap-2"
                >
                  <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest hidden sm:inline-block">Budget</span>
                  <span className="text-xs font-bold">₹{budget.totalBudget.toLocaleString('en-IN')}</span>
                  <ChevronUp size={12} className={`text-neutral-500 transition-transform duration-300 ${isBudgetDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu via Portal */}
                {mounted && isBudgetDropdownOpen && createPortal(
                  <>
                    {/* Backdrop to close when clicking outside */}
                    <div className="fixed inset-0 z-[999]" onClick={() => setIsBudgetDropdownOpen(false)}></div>
                    <div className="fixed right-8 top-16 w-72 bg-white dark:bg-[#111111] text-black dark:text-[#EDEDED] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.8)] overflow-hidden z-[1000] animate-in fade-in slide-in-from-top-2">
                      <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#0a0a0a]">
                        <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Budget Breakdown</span>
                      </div>
                      <div className="p-5">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-400 font-medium flex items-center gap-2"><Plane size={12} /> Transport</span>
                            <span className="text-red-400 font-semibold">- ₹{(budget.spentTransport || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-400 font-medium flex items-center gap-2"><Landmark size={12} /> Places</span>
                            <span className="text-red-400 font-semibold">- ₹{(budget.spentPlaces || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-400 font-medium flex items-center gap-2"><Coffee size={12} /> Food</span>
                            <span className="text-red-400 font-semibold">- ₹{(budget.spentFood || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-400 font-medium flex items-center gap-2"><Building size={12} /> Hotels</span>
                            <span className="text-red-400 font-semibold">- ₹{(budget.spentHotels || 0).toLocaleString('en-IN')}</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center mt-4">
                          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Remaining</span>
                          <span className={`text-xl font-bold ${budget.remaining < 0 ? 'text-red-500' : 'text-emerald-500 dark:text-emerald-400'}`}>
                            ₹{(budget.remaining || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>,
                  document.body
                )}
              </div>
            )}
            <button 
              onClick={() => setIsDark(!isDark)}
              className="w-7 h-7 rounded-full border border-neutral-300 dark:border-white/20 hover:border-neutral-500 dark:hover:border-white/50 transition-colors flex items-center justify-center bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300"
              title="Toggle Theme"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <Link href="/profile" className="w-7 h-7 rounded-full border border-neutral-300 dark:border-white/20 hover:border-neutral-500 dark:hover:border-white/50 transition-colors flex items-center justify-center overflow-hidden bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300">
              {user ? (
                <UserAvatar user={user} className="w-full h-full text-[10px]" />
              ) : (
                <User size={14} />
              )}
            </Link>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden relative">
        <div className="flex-1 overflow-y-auto bg-transparent">
          {children}
        </div>



        {/* API Limit Warning Notification */}
        {user && !user.isAdmin && user.apiCalls >= 40 && !isNotificationDismissed && (
          <div className="absolute bottom-8 left-8 w-72 bg-[#111] border border-red-900/50 rounded-2xl shadow-2xl p-4 z-50">
            <button
              onClick={() => setIsNotificationDismissed(true)}
              className="absolute top-3 right-3 text-neutral-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 mt-0.5" size={16} />
              <div className="pr-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-widest mb-1.5">Limit Warning</h4>
                <p className="text-[11px] font-medium text-neutral-300 leading-relaxed">
                  You are approaching the daily mission limit.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
