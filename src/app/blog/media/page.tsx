'use client';

import React, { useState, useEffect } from 'react';
import { Article } from '@/data/blogData';
import { BlogNavbar } from '@/components/blog/BlogNavbar';
import { MediaFeed } from '@/components/blog/MediaFeed';
import { CinematicLoader } from '@/components/CinematicLoader';
import { useCacheStore } from '@/store/cacheStore';
import { BlogFooter } from '@/components/blog/BlogFooter';

export default function BlogMediaPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const cache = useCacheStore();

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const cached = cache.getCache('blogs');
      if (cached && cached.length > 0) {
        setArticles(cached);
      }

      try {
        fetch('/api/blogs')
          .then(res => res.json())
          .then(data => {
            const arr = Array.isArray(data) ? data : [];
            setArticles(arr);
            cache.setCache('blogs', arr);
          })
          .catch(() => { if (!cache.getCache('blogs')) setArticles([]); })
          .finally(() => setIsFetching(false));
      } catch (e) {
        if (!cache.getCache('blogs')) setArticles([]);
        setIsFetching(false);
      }
    }
  }, []);

  const isLoading = isMounted && articles.length === 0 && isFetching;

  return (
    <div className="min-h-screen bg-[#FFF7F0] text-[#1F2937] font-sans selection:bg-[#FF8A3D]/20 overflow-x-hidden relative">
      <CinematicLoader 
        isLoading={isLoading} 
        category="places" 
        customLabel="Curating Your Perfect Visual Feed" 
        minDisplayMs={6500} 
      />
      
      {/* Top Travel Journal Navbar */}
      <BlogNavbar />

      {/* The Visual Feed */}
      <MediaFeed articles={articles} />

      {/* Travel Journal Footer */}
      <BlogFooter />
    </div>
  );
}
