'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Compass, ArrowUp, Heart, Map, Plane, Mail, FileText } from 'lucide-react';
import { TRAVEL_QUOTES } from '@/data/travelQuotes';
import { ARTICLES } from '@/data/blogData';

export function BlogFooter() {
  // Initialize with index 0 (Jawaharlal Nehru quote) for clean SSR hydration
  const [quoteObj, setQuoteObj] = useState(TRAVEL_QUOTES[0]);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    // Pick a new random quote every time someone reloads or visits
    const initialIndex = Math.floor(Math.random() * TRAVEL_QUOTES.length);
    setQuoteObj(TRAVEL_QUOTES[initialIndex]);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#FFF3E6] border-t border-[#FF8A3D]/20 pt-16 pb-12 px-4 md:px-8 relative text-[#1F2937]">
      <div className="max-w-7xl mx-auto">
        
        {/* Top section: Random Quote Banner (New quote on every visit/reload) */}
        <div className="pb-14 border-b border-[#FF8A3D]/20 text-center max-w-4xl mx-auto relative group">
          <div className="transition-opacity duration-300 opacity-100">
            <p className="font-serif italic text-2xl sm:text-3xl lg:text-4xl font-normal tracking-tight text-[#1F2937] leading-relaxed px-4">
              &ldquo;{quoteObj.quote}&rdquo;
            </p>
            <div className="mt-4 flex items-center justify-center">
              <span className="text-xs font-black uppercase tracking-widest text-[#D45B0C]">
                — {quoteObj.author}
              </span>
            </div>
          </div>
        </div>

        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 py-12 border-b border-[#FF8A3D]/15">
          
          {/* Brand Col */}
          <div className="md:col-span-5 flex flex-col items-start">
            <Link href="/" className="flex items-center gap-2.5 group mb-4">
              <img 
                src="/icon.png" 
                alt="BrewPlans Logo" 
                className="w-10 h-10 object-contain drop-shadow-[0_4px_8px_rgba(255,138,61,0.25)] group-hover:scale-105 transition-transform shrink-0" 
              />
              <span className="font-extrabold text-2xl tracking-tight text-[#1F2937]">BrewPlans Community</span>
            </Link>
            <p className="text-sm text-[#6B7280] leading-relaxed max-w-sm mb-6">
              A publication dedicated to joyful travel, mindful adventure, and smart itinerary planning powered by AI.
            </p>
            
            <div className="flex flex-wrap items-center gap-3 text-[#1F2937]">
              <a 
                href="https://instagram.com/brewplansdotcom" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-9 h-9 rounded-full bg-white hover:bg-[#FF8A3D] hover:text-white border border-[#FF8A3D]/30 flex items-center justify-center transition-all shadow-xs" 
                title="Instagram: @brewplansdotcom"
              >
                <svg className="w-4 h-4 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              <a 
                href="https://x.com/BrewPlans" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-9 h-9 rounded-full bg-white hover:bg-[#FF8A3D] hover:text-white border border-[#FF8A3D]/30 flex items-center justify-center transition-all shadow-xs" 
                title="X (Twitter): @BrewPlans"
              >
                <svg className="w-4 h-4 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
              </a>
              <a 
                href="https://facebook.com/BrewPlans" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-9 h-9 rounded-full bg-white hover:bg-[#FF8A3D] hover:text-white border border-[#FF8A3D]/30 flex items-center justify-center transition-all shadow-xs" 
                title="Facebook: BrewPlans"
              >
                <svg className="w-4 h-4 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a 
                href="mailto:support@brewplans.com" 
                className="w-9 h-9 rounded-full bg-white hover:bg-[#FF8A3D] hover:text-white border border-[#FF8A3D]/30 flex items-center justify-center transition-all shadow-xs" 
                title="Email: support@brewplans.com"
              >
                <Mail size={16} />
              </a>
              <a 
                href="#" 
                className="w-9 h-9 rounded-full bg-white hover:bg-[#FF8A3D] hover:text-white border border-[#FF8A3D]/30 flex items-center justify-center transition-all shadow-xs" 
                title="YouTube (Link coming soon)"
              >
                <svg className="w-4 h-4 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3v6Z"/></svg>
              </a>
            </div>
          </div>

          {/* Navigation Col 1: Trending Blogs */}
          <div className="md:col-span-3">
            <h4 className="font-extrabold text-xs uppercase tracking-widest text-[#D45B0C] mb-4">
              Trending Blogs
            </h4>
            <ul className="space-y-3 text-sm font-bold text-[#4B5563]">
              {ARTICLES.slice(0, 5).map(article => (
                <li key={article.id}>
                  <Link href={`/blog/u/${encodeURIComponent(article.author.username)}/${encodeURIComponent(article.slug)}`} className="hover:text-[#FF8A3D] transition-colors line-clamp-2">
                    {article.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Navigation Col 2: BrewPlans Tools */}
          <div className="md:col-span-4">
            <h4 className="font-extrabold text-xs uppercase tracking-widest text-[#D45B0C] mb-4">
              Plan Your Adventure
            </h4>
            <ul className="space-y-3 text-sm font-bold text-[#1F2937]">
              <li>
                <Link href="/recommend" className="flex items-center gap-2 hover:text-[#FF8A3D] transition-colors">
                  <Compass size={16} className="text-[#FFB347]" />
                  <span>Recommend Trips</span>
                </Link>
              </li>
              <li>
                <Link href="/plan/setup" className="flex items-center gap-2 hover:text-[#FF8A3D] transition-colors">
                  <Plane size={16} className="text-[#6EC6FF]" />
                  <span>Plan a Trip</span>
                </Link>
              </li>
              <li>
                <Link href="/quick-trip" className="flex items-center gap-2 hover:text-[#FF8A3D] transition-colors">
                  <Map size={16} className="text-[#7ED957]" />
                  <span>Plan a Hangout in Your City</span>
                </Link>
              </li>
              <li>
                <Link href="/blog/guidelines" className="flex items-center gap-2 hover:text-[#FF8A3D] transition-colors">
                  <FileText size={16} className="text-[#FF8A3D]" />
                  <span>Community Guidelines</span>
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs font-medium text-[#6B7280] gap-4">
          <div className="flex items-center gap-1">
            <span>© {new Date().getFullYear()} BrewPlans. Handcrafted with</span>
            <Heart size={13} className="text-[#E11D48] mx-0.5 inline fill-current" />
            <span>for lifelong explorers across India.</span>
          </div>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#FF8A3D] text-[#1F2937] hover:text-white font-black uppercase tracking-wider border border-[#FF8A3D]/20 shadow-xs transition-all"
          >
            <span>Back to Top</span>
            <ArrowUp size={14} />
          </button>
        </div>

      </div>
    </footer>
  );
}
