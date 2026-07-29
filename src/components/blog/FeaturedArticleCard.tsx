'use client';

import React from 'react';
import { Article } from '@/data/blogData';
import { motion } from 'framer-motion';
import { Clock, ArrowUpRight, Bookmark, Share2, Heart, Eye, MessageSquare } from 'lucide-react';

interface FeaturedArticleCardProps {
  article: Article;
  onSelectArticle: (article: Article) => void;
}

export function FeaturedArticleCard({ article, onSelectArticle }: FeaturedArticleCardProps) {
  const [likes, setLikes] = React.useState(article.likes ?? 0);
  const [liked, setLiked] = React.useState(false);

  const toggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (liked) {
      setLikes(l => l - 1);
      setLiked(false);
    } else {
      setLikes(l => l + 1);
      setLiked(true);
    }
  };

  return (
    <section className="py-12 px-4 md:px-8 max-w-7xl mx-auto">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1F2937] tracking-tight">
            Featured Expedition
          </h2>
          <p className="text-sm text-[#6B7280] font-medium mt-0.5">This month&apos;s spotlight story from the editorial team</p>
        </div>

      <motion.div
        whileHover={{ y: -6 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        onClick={() => onSelectArticle(article)}
        className="group cursor-pointer rounded-[36px] bg-gradient-to-r from-[#FFF3E6] via-white to-[#FFF7F0] p-4 sm:p-6 md:p-8 border-2 border-[#FF8A3D]/20 shadow-[0_20px_60px_-15px_rgba(255,138,61,0.18)] hover:shadow-[0_30px_70px_-10px_rgba(255,138,61,0.3)] transition-all relative overflow-hidden"
      >
        {/* Subtle decorative internal gradient border */}
        <div className="absolute inset-0 rounded-[36px] border border-white/80 pointer-events-none z-20"></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left: Large Photo with zoom effect */}
          <div className="lg:col-span-7 relative h-[340px] sm:h-[440px] rounded-[28px] overflow-hidden shadow-lg bg-black">
            {article.videoUrl && (article.mediaType === 'article' || article.videoUrl.match(/\.(mp4|webm|ogg)$/i)) ? (
              <video 
                src={article.videoUrl} 
                autoPlay loop muted playsInline 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            ) : (
              <img 
                src={article.imageUrl} 
                alt={article.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            
            {/* Top Badge overlay */}
            <div className="absolute top-5 left-5 right-5 flex items-center justify-between z-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-4 py-1.5 rounded-full font-extrabold text-xs uppercase tracking-wider backdrop-blur-md shadow-md flex items-center gap-1.5 bg-white/95 text-[#D45B0C]`}>
                  <span>{article.categoryIcon}</span>
                  <span>{article.category}</span>
                </span>
                {article.city && (
                  <span className="px-4 py-1.5 rounded-full font-black text-xs backdrop-blur-md shadow-md bg-[#1F2937]/95 text-white flex items-center gap-1">
                    <span>📍</span>
                    <span>{article.city}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleLike}
                  className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-md ${liked ? 'bg-rose-500 text-white scale-110' : 'bg-white/90 hover:bg-white text-[#1F2937]'}`}
                  title="Like story"
                >
                  <Heart size={16} fill={liked ? "currentColor" : "none"} />
                </button>
              </div>
            </div>

            {/* Bottom Floating Author Quick Tag on mobile */}
            <div className="absolute bottom-5 left-5 right-5 lg:hidden text-white flex items-center justify-between">
              <span className="text-xs font-bold text-white/90 flex items-center gap-1.5">
                <Clock size={13} className="text-[#FFD166]" />
                {article.readingTime}
              </span>
              <span className="text-xs font-bold bg-[#FF8A3D] px-3 py-1 rounded-full">Read Story &rarr;</span>
            </div>
          </div>

          {/* Right: Editorial Content */}
          <div className="lg:col-span-5 flex flex-col justify-between h-full py-2 lg:pl-2">
            
            <div>
              <div className="hidden lg:flex items-center gap-3 text-xs font-extrabold uppercase tracking-widest text-[#D45B0C] mb-4">
                <span>{article.date}</span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-[#1F2937]">
                  <Clock size={13} className="text-[#FF8A3D]" />
                  {article.readingTime}
                </span>
              </div>

              <h3 className="font-extrabold text-2xl sm:text-3xl lg:text-4xl text-[#1F2937] tracking-tight leading-tight mb-5 group-hover:text-[#D45B0C] transition-colors">
                {article.title}
              </h3>

              <p className="text-sm sm:text-base text-[#4B5563] leading-relaxed font-normal mb-6">
                {article.excerpt}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs font-extrabold text-[#6B7280] mb-6">
                <span className="px-3 py-1 rounded-full bg-[#1F2937] text-[#FFD166] font-black flex items-center gap-1 shadow-sm">
                  <span>✈️ Adopted for {article.timesPlanned || 254} itineraries!</span>
                </span>
                <span className="flex items-center gap-1.5 text-rose-600">
                  <Heart size={15} className={liked ? 'fill-current' : ''} />
                  <span>{likes} Likes</span>
                </span>
                <span className="flex items-center gap-1.5 text-[#0284C7]">
                  <Eye size={15} />
                  <span>{article.views?.toLocaleString() || '0'} Views</span>
                </span>
                <span className="flex items-center gap-1.5 text-[#D45B0C]">
                  <MessageSquare size={15} />
                  <span>{article.comments?.length || article.commentsCount || '0'} Comments</span>
                </span>
              </div>
            </div>

            {/* Author profile & CTA Arrow */}
            <div className="pt-6 border-t border-[#FF8A3D]/20 flex items-center justify-between">
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3">
                  <img 
                    src={article.author.avatar} 
                    alt={article.author.name} 
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-[#FF8A3D]/30 shadow"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-[#1F2937] leading-none flex items-center gap-1.5">
                      <span>{article.author.name}</span>
                      {article.collaborators && article.collaborators.length > 0 && (
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-black">
                          + {article.collaborators[0].name} (Collab)
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-[#6B7280] font-medium mt-1">{article.author.role}</p>
                  </div>
                </div>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-[#1F2937] group-hover:bg-[#FF8A3D] text-white flex items-center justify-center transition-all group-hover:scale-105 shadow-md">
                <ArrowUpRight size={22} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>

            </div>

          </div>
        </div>
      </motion.div>
    </section>
  );
}
