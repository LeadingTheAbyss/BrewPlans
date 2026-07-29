'use client';

import React, { useState, useEffect } from 'react';
import { Article } from '@/data/blogData';
import { BlogNavbar } from '@/components/blog/BlogNavbar';
import { MediaFeed } from '@/components/blog/MediaFeed';
import { BlogFooter } from '@/components/blog/BlogFooter';

export default function BlogMediaPage() {
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        fetch('/api/blogs')
          .then(res => res.json())
          .then(data => setArticles(Array.isArray(data) ? data : []))
          .catch(() => setArticles([]));
      } catch (e) {
        setArticles([]);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#FFF7F0] text-[#1F2937] font-sans selection:bg-[#FF8A3D]/20 overflow-x-hidden relative">
      
      {/* Top Travel Journal Navbar */}
      <BlogNavbar />

      {/* The Visual Feed */}
      <MediaFeed articles={articles} />

      {/* Travel Journal Footer */}
      <BlogFooter />
    </div>
  );
}
