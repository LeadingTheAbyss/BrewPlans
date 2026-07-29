'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Compass, Menu, X, MapPin, Send, Plane, PenTool, User, Cloud, CloudFog } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { UserAvatar } from '@/components/UserAvatar';

export function BlogNavbar({ wordCount, saveStatus }: { wordCount?: number; saveStatus?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ displayName?: string; pfp?: string; username?: string } | null>(null);
  const isMediaTab = pathname === '/blog/media';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('brewplans_user_profile');
        if (saved) setUserProfile(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const scrollToNewsletter = () => {
    const el = document.getElementById('newsletter-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      router.push('/blog#newsletter-section');
    }
  };

  return (
    <header className="w-full sticky top-0 z-[100] bg-[#FFF7F0]/95 backdrop-blur-md border-b border-[#FF8A3D]/20 px-4 md:px-8 py-3.5 transition-all shadow-xs">
      <div className="w-full flex items-center justify-between gap-4 lg:gap-8">
        
        {/* Brand Logo & Editorial Tag (#1) */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <img 
              src="/icon.png" 
              alt="BrewPlans Logo" 
              className="w-10 h-10 object-contain drop-shadow-[0_4px_8px_rgba(255,138,61,0.25)] group-hover:scale-105 transition-transform shrink-0" 
            />
            <div className="flex flex-col">
              <span className="font-black text-xl md:text-2xl tracking-tight text-[#1F2937] leading-none flex items-center gap-1.5 whitespace-nowrap">
                BrewPlans
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FF8A3D]/15 text-[#D45B0C] font-bold uppercase tracking-wider hidden sm:inline-block">
                  Community
                </span>
              </span>
              <span className="text-[11px] text-[#6B7280] font-medium tracking-wide hidden md:block whitespace-nowrap">India&apos;s joyful travel community</span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links or Write Status */}
        {pathname === '/blog/write' ? (
          <div className="hidden lg:flex items-center gap-4 text-xs font-bold uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-xl border border-[#FF8A3D]/20 shadow-sm">
            <span>{wordCount || 0} words</span>
            {saveStatus === 'Saved' ? (
              <div className="flex items-center gap-1 text-emerald-600 ml-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="text-[10px]">Saved</span>
                <Cloud size={13} />
              </div>
            ) : saveStatus ? (
              <div className="flex items-center gap-1 text-amber-600 ml-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <span className="text-[10px]">Saving...</span>
                <CloudFog size={13} className="animate-pulse" />
              </div>
            ) : null}
          </div>
        ) : (
          <nav className="hidden lg:flex items-center gap-6 xl:gap-10 text-xs xl:text-sm font-extrabold text-[#1F2937] whitespace-nowrap overflow-x-auto no-scrollbar py-1">
            <Link 
              href="/blog" 
              className={`transition-all flex items-center gap-1.5 whitespace-nowrap py-1 shrink-0 ${!isMediaTab && pathname === '/blog' ? 'text-[#FF8A3D] border-b-2 border-[#FF8A3D]' : 'hover:text-[#FF8A3D]'}`}
            >
              <span>Blogs</span>
            </Link>
            <Link 
              href="/blog/media" 
              className={`transition-all flex items-center gap-1.5 whitespace-nowrap py-1 shrink-0 ${isMediaTab ? 'text-[#FF8A3D] border-b-2 border-[#FF8A3D]' : 'hover:text-[#FF8A3D]'}`}
            >
              <span>Show Pics & Videos</span>
            </Link>
          </nav>
        )}

        {/* Top Right Actions pushed to extreme right (#3) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto lg:ml-0">
          
          <Link
            href="/blog/write"
            className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#FFF3E6] hover:bg-white text-[#D45B0C] font-extrabold text-xs uppercase tracking-wider border-2 border-[#FF8A3D]/30 shadow-xs hover:scale-103 transition-all whitespace-nowrap shrink-0"
            title="Write your own Indian travel experience"
          >
            <PenTool size={14} className="text-[#FF8A3D] shrink-0" />
            <span>Post About Your Trip</span>
          </Link>

          {/* Profile avatar link button */}
          <Link
            href={`/u/${encodeURIComponent(userProfile?.username || '1')}`}
            className="flex items-center gap-2 p-1.5 pr-3.5 rounded-2xl bg-[#1F2937] hover:bg-black text-white font-extrabold text-xs tracking-wide shadow-md hover:scale-105 active:scale-95 transition-all whitespace-nowrap shrink-0 border border-white/10"
            title="View Your Profile, PFP, Bio & Socials"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white/20 animate-pulse"></div>
                <div className="w-12 h-3 bg-white/20 rounded animate-pulse hidden sm:block"></div>
              </div>
            ) : (
              <>
                <UserAvatar 
                  user={{ 
                    name: userProfile?.displayName || user?.name || 'Explorer', 
                    picture: userProfile?.pfp || user?.picture 
                  }} 
                  className="w-7 h-7 text-[10px]" 
                />
                <span className="hidden sm:inline font-black text-white">
                  {userProfile?.displayName?.split(' ')[0] || user?.name?.split(' ')[0] || 'Profile'}
                </span>
              </>
            )}
          </Link>

          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-xl bg-[#FFF3E6] text-[#1F2937] border border-[#FF8A3D]/20 hover:bg-[#FFB347]/10 transition-colors ml-1"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-4 pt-4 border-t border-[#FF8A3D]/20 flex flex-col gap-3 animate-in slide-in-from-top-2">
          <Link
            href="/blog"
            onClick={() => setMobileMenuOpen(false)}
            className={`w-full text-left font-extrabold text-base px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${!isMediaTab && pathname === '/blog' ? 'bg-[#FFF3E6] text-[#FF8A3D]' : 'bg-white/70 hover:bg-[#FFF3E6] text-[#1F2937]'}`}
          >
            <span>Blogs</span>
          </Link>
          <Link
            href="/blog/media"
            onClick={() => setMobileMenuOpen(false)}
            className={`w-full text-left font-extrabold text-base px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${isMediaTab ? 'bg-[#FFF3E6] text-[#FF8A3D]' : 'bg-white/70 hover:bg-[#FFF3E6] text-[#1F2937]'}`}
          >
            <span>Show Pics & Videos</span>
          </Link>
          <Link
            href="/blog/write"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full text-left font-black text-base text-[#1F2937] px-4 py-3 rounded-xl bg-white border border-[#FF8A3D]/30 flex items-center justify-center gap-2 shadow-xs"
          >
            <PenTool size={16} className="text-[#FF8A3D]" />
            <span>Post About Your Trip</span>
          </Link>

        </div>
      )}
    </header>
  );
}
