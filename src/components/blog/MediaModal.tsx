import React, { useState, useEffect } from 'react';
import { Article, Comment } from '@/data/blogData';
import { Heart, MessageCircle, X, Play, MoreHorizontal } from 'lucide-react';

interface MediaModalProps {
  article: Article;
  onClose: () => void;
}

export function MediaModal({ article, onClose }: MediaModalProps) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(article.likes || 0);
  const [comments, setComments] = useState<Comment[]>(article.comments || []);
  const [newComment, setNewComment] = useState('');

  // Initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const likedIds = JSON.parse(localStorage.getItem('brewplans_liked_articles') || '[]');
        if (likedIds.includes(article.id)) setLiked(true);
        
        // Also check if we have updated data for this custom article
        const customBlogs: Article[] = JSON.parse(localStorage.getItem('brewplans_custom_blogs') || '[]');
        const updatedArticle = customBlogs.find(a => a.id === article.id);
        if (updatedArticle) {
          setLikesCount(updatedArticle.likes || 0);
          setComments(updatedArticle.comments || []);
        } else if (likedIds.includes(article.id)) {
          // It's a static article but liked locally
          setLikesCount((article.likes || 0) + 1);
        }
      } catch (e) {}
    }
  }, [article]);

  const handleLike = () => {
    if (typeof window === 'undefined') return;
    const newLiked = !liked;
    setLiked(newLiked);
    
    let newCount = likesCount;
    if (newLiked) {
      newCount = likesCount + 1;
    } else {
      newCount = Math.max(0, likesCount - 1);
    }
    setLikesCount(newCount);

    try {
      const likedIds = JSON.parse(localStorage.getItem('brewplans_liked_articles') || '[]');
      if (newLiked && !likedIds.includes(article.id)) {
        likedIds.push(article.id);
      } else if (!newLiked) {
        const index = likedIds.indexOf(article.id);
        if (index > -1) likedIds.splice(index, 1);
      }
      localStorage.setItem('brewplans_liked_articles', JSON.stringify(likedIds));

      // Update custom blogs if applicable
      const customBlogs: Article[] = JSON.parse(localStorage.getItem('brewplans_custom_blogs') || '[]');
      const bIndex = customBlogs.findIndex(a => a.id === article.id);
      if (bIndex > -1) {
        customBlogs[bIndex].likes = newCount;
        localStorage.setItem('brewplans_custom_blogs', JSON.stringify(customBlogs));
      }
    } catch (e) {}
  };

  const handlePostComment = () => {
    if (!newComment.trim() || typeof window === 'undefined') return;
    
    const profileSaved = localStorage.getItem('brewplans_user_profile');
    let author = 'You';
    let avatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80';
    if (profileSaved) {
      const parsed = JSON.parse(profileSaved);
      if (parsed.displayName) author = parsed.displayName;
      if (parsed.pfp) avatar = parsed.pfp;
    }

    const commentObj: Comment = {
      author,
      avatar,
      content: newComment,
      date: 'Just now'
    };

    const updatedComments = [commentObj, ...comments];
    setComments(updatedComments);
    setNewComment('');

    try {
      // Update custom blogs if applicable
      const customBlogs: Article[] = JSON.parse(localStorage.getItem('brewplans_custom_blogs') || '[]');
      const bIndex = customBlogs.findIndex(a => a.id === article.id);
      if (bIndex > -1) {
        customBlogs[bIndex].comments = updatedComments;
        localStorage.setItem('brewplans_custom_blogs', JSON.stringify(customBlogs));
      }
    } catch (e) {}
  };

  const isVideo = article.mediaType === 'video' || article.videoUrl;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-0 sm:p-4 md:p-8 animate-in fade-in duration-200">
      
      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute z-[110] top-3 right-3 sm:top-6 sm:right-6 text-white bg-black/40 hover:bg-black/60 p-2 rounded-full transition-all"
      >
        <X size={24} />
      </button>

      {/* Modal Container */}
      <div 
        className="flex flex-col md:flex-row w-full max-w-6xl min-h-full md:min-h-0 md:h-[85vh] sm:h-[90vh] bg-[#0A0A0A] rounded-none sm:rounded-md overflow-y-auto md:overflow-hidden border-0 sm:border border-white/10 shadow-2xl pb-16 md:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MOBILE ONLY: Header (Above Media) */}
        <div className="flex md:hidden items-center justify-between p-3 border-b border-white/10 shrink-0 bg-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full shrink-0">
              <img 
                src={article.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'} 
                alt={article.author?.name}
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white leading-tight">
                {article.author?.name || 'explorer'}
              </h4>
              {article.city && (
                <p className="text-xs text-white/50">{article.city}</p>
              )}
            </div>
          </div>
          <button className="text-white/50 hover:text-white transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>

        {/* Left Side: Media Viewer */}
        <div className="w-full md:w-[60%] lg:w-[65%] h-auto md:h-full bg-black flex items-center justify-center relative group border-b md:border-b-0 md:border-r border-white/10">
          {isVideo ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img 
                src={article.imageUrl || `https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1200&q=80`}
                alt={article.title}
                className="w-full h-full object-contain opacity-50"
              />
              <button className="absolute bg-white/10 hover:bg-white/20 backdrop-blur-md p-4 rounded-full text-white transition-all transform group-hover:scale-110">
                <Play size={32} fill="currentColor" />
              </button>
            </div>
          ) : (
            <img 
              src={article.imageUrl}
              alt={article.title}
              className="w-full h-auto max-h-[70vh] md:max-h-none md:h-full object-contain"
            />
          )}
        </div>

        {/* Right Side: Details & Comments */}
        <div className="w-full md:w-[40%] lg:w-[35%] flex-1 md:h-full flex flex-col bg-[#0A0A0A]">
          
          {/* DESKTOP ONLY: Header */}
          <div className="hidden md:flex items-center justify-between p-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full shrink-0">
                <img 
                  src={article.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'} 
                  alt={article.author?.name}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white leading-tight">
                  {article.author?.name || 'explorer'}
                </h4>
                {article.city && (
                  <p className="text-xs text-white/50">{article.city}</p>
                )}
              </div>
            </div>
            <button className="text-white/50 hover:text-white transition-colors">
              <MoreHorizontal size={20} />
            </button>
          </div>

          {/* Scrollable Content: Caption + Comments */}
          <div className="flex-1 md:overflow-y-auto no-scrollbar p-3 md:p-4 flex flex-col gap-6">
            
            {/* Caption */}
            <div className="flex gap-3">
              <img 
                src={article.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'} 
                alt="author"
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
              <div className="text-sm text-white/90">
                <span className="font-semibold text-white mr-2">{article.author?.name || 'explorer'}</span>
                {article.title}
                {(article.excerpt || article.content) && (
                  <p className="mt-2 text-white/70 whitespace-pre-wrap text-[13px]">
                    {article.excerpt || article.content?.substring(0, 150) + '...'}
                  </p>
                )}
              </div>
            </div>

            {/* Comments */}
            {comments && comments.length > 0 ? (
              <div className="flex flex-col gap-4">
                {comments.map((comment, i) => (
                  <div key={i} className="flex gap-3">
                    <img 
                      src={comment.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'} 
                      alt="user"
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                    <div className="text-sm">
                      <span className="font-semibold text-white mr-2">{comment.author}</span>
                      <span className="text-white/80">{comment.content}</span>
                      <div className="flex items-center gap-4 mt-1 text-[11px] font-semibold text-white/40">
                        <span>Reply</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-white/30 text-sm italic">
                No comments yet.
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="border-t-0 md:border-t border-white/10 p-3 md:p-4 shrink-0 bg-[#0A0A0A]">
            <div className="flex items-center gap-4 mb-3">
              <button onClick={handleLike} className="group transition-transform active:scale-95">
                <Heart 
                  size={26} 
                  className={`transition-colors ${liked ? 'text-rose-500 fill-rose-500' : 'text-white group-hover:text-white/70'}`} 
                />
              </button>
              <button className="group transition-transform active:scale-95">
                <MessageCircle size={26} className="text-white group-hover:text-white/70" />
              </button>
            </div>
            
            <div className="font-semibold text-sm text-white mb-2">
              {likesCount.toLocaleString()} likes
            </div>
            
            <div className="text-[10px] text-white/40 uppercase tracking-wide">
              {article.date || 'RECENTLY'}
            </div>
          </div>

          {/* Add Comment Input */}
          <div className="border-t border-white/10 p-3 md:p-4 shrink-0 flex items-center gap-3 bg-[#0A0A0A]">
            <input 
              type="text" 
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePostComment();
              }}
              className="flex-1 bg-transparent border-none focus:outline-none text-sm text-white placeholder:text-white/40"
            />
            <button 
              onClick={handlePostComment}
              disabled={!newComment.trim()}
              className={`font-semibold text-sm transition-opacity ${newComment.trim() ? 'text-[#FF8A3D] hover:opacity-80' : 'text-[#FF8A3D] opacity-50 cursor-not-allowed'}`}
            >
              Post
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
