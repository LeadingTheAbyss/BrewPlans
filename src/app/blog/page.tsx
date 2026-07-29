'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { isAdminEmail } from '@/lib/admin';
import { Article, BUDGET_FILTER_OPTIONS, SEASON_FILTER_OPTIONS } from '@/data/blogData';
import { INITIAL_CUSTOM_BLOGS } from '@/data/seedBlogs';
import { calculateProgressiveMetrics } from '@/lib/blogMetrics';
import { BlogNavbar } from '@/components/blog/BlogNavbar';
import { BlogHero } from '@/components/blog/BlogHero';
import { FeaturedArticleCard } from '@/components/blog/FeaturedArticleCard';
import { CategoryPills } from '@/components/blog/CategoryPills';
import { EditorialArticleGrid } from '@/components/blog/EditorialArticleGrid';
import { PopularDestinationsScroll } from '@/components/blog/PopularDestinationsScroll';
import { BlogNewsletter } from '@/components/blog/BlogNewsletter';
import { BlogFooter } from '@/components/blog/BlogFooter';
import { ArticleReaderModal } from '@/components/blog/ArticleReaderModal';
import { CustomDropdown } from '@/components/blog/CustomDropdown';
import { useRouter } from 'next/navigation';
import { Search, Filter, DollarSign, Calendar, X } from 'lucide-react';

const QUICK_CITIES = [
  'All India',
  'Goa',
  'Jammu & Kashmir',
  'Manali & Himachal',
  'Delhi',
  'Kochi & Kerala',
  'Jaipur & Udaipur',
  'Meghalaya & Tawang',
  'Mumbai & Pune'
];

export default function BlogLandingPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>('All Stories');
  const [searchCity, setSearchCity] = useState<string>('');
  const [selectedQuickCity, setSelectedQuickCity] = useState<string>('All India');
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);

  // Dynamic user blogs (No hardcoded data - Item 14)
  const [articles, setArticles] = useState<Article[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Structured Meta-Data filter states
  const [budgetFilter, setBudgetFilter] = useState<string>('All Budgets');
  const [seasonFilter, setSeasonFilter] = useState<string>('All Seasons');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ADMIN_HANDLES = ['admin', 'kamlesh', 'brewplans_admin', 'superadmin'];
      try {
        fetch('/api/blogs')
          .then(res => res.json())
          .then(data => {
            let customBlogs: Article[] = Array.isArray(data) ? data : [];
            
            // Apply progressive metrics
            customBlogs = customBlogs.map(b => {
              const metrics = calculateProgressiveMetrics(b);
              return {
                ...b,
                likes: metrics.likesCount,
                views: metrics.viewsCount
              };
            });
            
            // Temporary cleanup block to remove all blogs except the Jammu one
            customBlogs = customBlogs.filter(b => b.title.toLowerCase().includes('jammu'));
            
            setArticles(customBlogs);
          });

        const profileSaved = localStorage.getItem('brewplans_user_profile');
        const userSaved = localStorage.getItem('brewplans_user');
        let myUsername = '';
        let currentIsAdmin = false;

        let myEmail = '';
        
        let parsedProfile = profileSaved ? JSON.parse(profileSaved) : {};
        let parsedUser = userSaved ? JSON.parse(userSaved) : {};

        myUsername = parsedProfile.username || parsedUser.username || '';
        myEmail = parsedProfile.email || parsedUser.email || '';
        
        if (parsedProfile.isAdmin || parsedUser.isAdmin || isAdminEmail(myEmail)) {
          currentIsAdmin = true;
        }

        if (myUsername && ADMIN_HANDLES.includes(myUsername.toLowerCase())) {
          currentIsAdmin = true;
        }

        setIsAdmin(currentIsAdmin);
      } catch (e) {
        setArticles([]);
      }
    }
  }, []);

  const handleDeleteArticle = (articleToDelete: Article) => {
    if (typeof window !== 'undefined') {
      try {
        fetch(`/api/blogs/${articleToDelete.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {}
      const updated = articles.filter(a => a.id !== articleToDelete.id && a.slug !== articleToDelete.slug);
      setArticles(updated);
    }
  };

  const handleSelectArticle = (article: Article) => {
    const username = article.author?.username || 'explorer';
    const slug = article.slug || article.id;
    router.push(`/blog/u/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`);
  };

  const displayedArticles = useMemo(() => {
    let list = [...articles];

    // Category filter
    if (selectedCategory !== 'All Stories') {
      list = list.filter(a => a.category === selectedCategory);
    }

    // Quick City chip filter
    if (selectedQuickCity !== 'All India') {
      const target = selectedQuickCity.toLowerCase().split(' & ')[0];
      list = list.filter(a => 
        a.city?.toLowerCase().includes(target) ||
        a.title.toLowerCase().includes(target) ||
        a.excerpt?.toLowerCase().includes(target)
      );
    }

    // Text box search city filter
    if (searchCity.trim()) {
      const q = searchCity.toLowerCase().trim();
      list = list.filter(a => 
        a.city?.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.excerpt?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q)
      );
    }

    // Structured Meta-Data filters
    if (budgetFilter !== 'All Budgets') {
      list = list.filter(a => a.budget?.toLowerCase().includes(budgetFilter.toLowerCase().split(' ')[0]) || a.budget === budgetFilter);
    }
    if (seasonFilter !== 'All Seasons') {
      list = list.filter(a => a.bestSeason?.toLowerCase().includes(seasonFilter.toLowerCase().split(' ')[0]) || a.bestSeason === seasonFilter);
    }

    return list;
  }, [articles, selectedCategory, searchCity, selectedQuickCity, budgetFilter, seasonFilter]);

  const resetAllFilters = () => {
    setSelectedCategory('All Stories');
    setSearchCity('');
    setSelectedQuickCity('All India');
    setBudgetFilter('All Budgets');
    setSeasonFilter('All Seasons');
  };

  const activeFilterCount = 
    (selectedCategory !== 'All Stories' ? 1 : 0) +
    (selectedQuickCity !== 'All India' ? 1 : 0) +
    (budgetFilter !== 'All Budgets' ? 1 : 0) +
    (seasonFilter !== 'All Seasons' ? 1 : 0);

  const featuredArticle = articles.length > 0 ? articles[0] : null;

  return (
    <div className="min-h-screen bg-[#FFF7F0] text-[#1F2937] font-sans selection:bg-[#FF8A3D]/20 overflow-x-hidden relative">
      
      {/* Top Travel Journal Navbar */}
      <BlogNavbar />

      {/* Featured Article Section (Trending Top) */}
      {featuredArticle && (
        <FeaturedArticleCard 
          article={featuredArticle} 
          onSelectArticle={handleSelectArticle} 
        />
      )}

      {/* Horizontal Trending Destinations Showcase */}
      <PopularDestinationsScroll />

      {/* Indian City Search & Structured Filters Console */}
      <section className="py-8 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-[#FFF3E6] via-[#FFF9E6] to-[#FEF3C7] rounded-[36px] p-6 sm:p-10 border-4 border-[#FF8A3D]/30 shadow-xl mb-8">
          
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#D45B0C] mb-1.5 bg-white/80 px-3.5 py-1 rounded-full border border-[#FF8A3D]/30 shadow-xs">
                <Filter size={14} className="text-[#FF8A3D]" />
                <span>Smart Indian Expedition Discovery</span>
              </div>
              <h3 className="text-2xl sm:text-4xl font-black text-[#1F2937] tracking-tight">
                Filter by Destination, Budget & Season
              </h3>
              <p className="text-xs sm:text-sm text-[#4B5563] font-medium mt-1">
                Customize your feed to match your exact budget and trip vibe.
              </p>
            </div>
          </div>

          {/* Search Input Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FF8A3D]" size={22} />
            <input
              type="text"
              value={searchCity}
              onChange={(e) => {
                setSearchCity(e.target.value);
                if (selectedQuickCity !== 'All India') setSelectedQuickCity('All India');
              }}
              placeholder="Search Indian destinations or regions (e.g. Goa, Manali, Spiti, Chandni Chowk, Tawang...)"
              className="w-full h-15 pl-12 pr-12 rounded-2xl bg-white/95 border-2 border-[#FF8A3D]/30 focus:outline-none focus:border-[#FF8A3D] text-[#1F2937] font-extrabold placeholder:text-gray-400 shadow-md text-base sm:text-lg transition-all"
            />
            {searchCity && (
              <button
                onClick={() => setSearchCity('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* STRUCTURED META-DATA DROPDOWN CONSOLE (Budget Tier & Season) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 pt-2">
            
            {/* Budget Selector */}
            <CustomDropdown
              label={
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#D45B0C] mb-1 pl-1 flex items-center gap-1">
                  <DollarSign size={12} /> Budget Tier
                </label>
              }
              value={budgetFilter}
              onChange={setBudgetFilter}
              options={BUDGET_FILTER_OPTIONS}
              colorTheme="orange"
            />

            {/* Season Selector */}
            <CustomDropdown
              label={
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 mb-1 pl-1 flex items-center gap-1">
                  <Calendar size={12} /> Best Time to Visit
                </label>
              }
              value={seasonFilter}
              onChange={setSeasonFilter}
              options={SEASON_FILTER_OPTIONS}
              colorTheme="emerald"
            />
          </div>

          {/* Quick City Filter Chips & Reset Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#FF8A3D]/20">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#6B7280] mr-1">Regions:</span>
              {QUICK_CITIES.map(city => (
                <button
                  key={city}
                  onClick={() => {
                    setSelectedQuickCity(city);
                    setSearchCity('');
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${
                    selectedQuickCity === city && !searchCity
                      ? 'bg-[#1F2937] text-white shadow-md scale-105'
                      : 'bg-white text-[#4B5563] hover:bg-[#FF8A3D]/10 border border-[#FF8A3D]/25'
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={resetAllFilters}
                className="px-4 py-1.5 rounded-full bg-rose-500 text-white font-black text-xs uppercase tracking-wider hover:bg-rose-600 transition-colors shadow-sm flex items-center gap-1"
              >
                <span>Reset All Filters ({activeFilterCount})</span>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Editorial Masonry Grid of Articles & Videos */}
      <EditorialArticleGrid 
        articles={displayedArticles} 
        onSelectArticle={handleSelectArticle} 
        selectedCategory={selectedCategory} 
        onDeleteArticle={handleDeleteArticle}
        isAdmin={isAdmin}
      />

      {/* Travel Journal Footer */}
      <BlogFooter />

      {/* Fallback Reader Modal */}
      <ArticleReaderModal 
        article={readingArticle} 
        onClose={() => setReadingArticle(null)} 
      />

    </div>
  );
}
