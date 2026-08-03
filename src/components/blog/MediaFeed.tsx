import React, { useState } from 'react';
import { Article } from '@/data/blogData';
import { Play, Heart, MessageCircle } from 'lucide-react';
import { MediaModal } from '@/components/blog/MediaModal';
import { useBlogTheme } from '@/context/BlogThemeContext';

interface MediaFeedProps {
  articles: Article[];
}

export function MediaFeed({ articles }: MediaFeedProps) {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const blogTheme = useBlogTheme();
  const isDark = blogTheme?.isDark || false;

  // Only get articles that have an image or video, prioritizing those with images for the feed
  const mediaItems = articles.filter(a => a.imageUrl || a.videoUrl);

  if (mediaItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center min-h-[60vh]">
        <h2 className={`text-2xl font-black mb-2 ${isDark ? 'text-zinc-200' : 'text-[#1F2937]'}`}>No media found</h2>
        <p className={isDark ? 'text-zinc-500' : 'text-[#6B7280]'}>Be the first to share pictures and videos from your trips!</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-0 sm:px-4 md:px-8 py-1 sm:py-10 min-h-screen">
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-0.5 sm:gap-2">
        {mediaItems.map((article, idx) => (
          <div 
            key={article.id || idx} 
            className="relative group aspect-square overflow-hidden cursor-pointer bg-neutral-900"
            onClick={() => setSelectedArticle(article)}
          >
            {article.mediaType === 'video' || article.videoUrl ? (
              <div className="relative w-full h-full bg-black flex items-center justify-center group/video">
                {article.videoUrl?.match(/\.(mp4|webm|ogg)$/i) ? (
                  <video 
                    src={article.videoUrl} 
                    className="w-full h-full object-cover opacity-70 group-hover/video:opacity-100 transition-opacity"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <>
                    <Play className="absolute text-white w-10 h-10 z-20 opacity-80" fill="currentColor" />
                    <img 
                      src={article.imageUrl || `https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=600&q=80`} 
                      alt={article.title} 
                      className="w-full h-full object-cover opacity-70"
                    />
                  </>
                )}
              </div>
            ) : (
              <div className="relative w-full h-full">
                <img 
                  src={article.imageUrl} 
                  alt={article.title} 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            
            {/* Hover overlay (Instagram style) */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2 text-white font-bold">
                <Heart size={20} fill="currentColor" />
                <span>{article.likes || 0}</span>
              </div>
              <div className="flex items-center gap-2 text-white font-bold">
                <MessageCircle size={20} fill="currentColor" />
                <span>{article.comments?.length || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedArticle && (
        <MediaModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}
    </div>
  );
}
