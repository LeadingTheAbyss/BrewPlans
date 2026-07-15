import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Place } from '@/types/trip';
import { Clock, Ticket, CheckSquare, Square, Plus, GripVertical } from 'lucide-react';

interface SortablePlaceCardProps {
  place: Place;
  isOverlay?: boolean;
  compact?: boolean;
  isSelected?: boolean;
  onSelectToggle?: () => void;
  onQuickAdd?: (placeId: string) => void;
  onClickContainer?: () => void;
}

export function SortablePlaceCard({ 
  place, 
  isOverlay = false, 
  compact = false,
  isSelected = false,
  onSelectToggle,
  onQuickAdd,
  onClickContainer
}: SortablePlaceCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: place.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const getCategoryColor = (cat: string) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('park') || c.includes('nature')) return 'text-green-400 bg-green-500/10 border-green-500/20';
    if (c.includes('museum') || c.includes('history') || c.includes('fort')) return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
    if (c.includes('temple') || c.includes('church') || c.includes('shrine')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  };
  const catStyle = getCategoryColor(place.category || '');

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClickContainer}
      className={`relative group bg-[#111111] border rounded-xl flex items-stretch transition-all duration-300
        ${isOverlay ? 'shadow-[0_0_30px_rgba(34,197,94,0.15)] border-green-500/50 scale-[1.02] z-50' : 'border-[#222222] hover:border-[#333] hover:shadow-lg'}
        ${isSelected ? 'border-emerald-500/50 bg-emerald-500/5' : ''}
        ${onClickContainer ? 'cursor-pointer' : ''}
        ${compact ? 'p-3' : 'p-4'}
      `}
    >
      {/* Selection Checkbox (Vault only) */}
      {onSelectToggle && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onSelectToggle();
          }}
          className="absolute -left-2 -top-2 z-10 w-6 h-6 rounded-md bg-[#1a1a1a] border border-[#333] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:border-emerald-500 data-[selected=true]:opacity-100 data-[selected=true]:bg-emerald-500 data-[selected=true]:border-emerald-400"
          data-selected={isSelected}
        >
          {isSelected ? <CheckSquare size={14} className="text-black" /> : <Square size={14} className="text-zinc-400" />}
        </button>
      )}

      {/* Minimal Drag Handle */}
      <div 
        {...attributes} 
        {...listeners} 
        className={`w-6 flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0 transition-opacity text-zinc-500 hover:text-zinc-300 touch-none
          ${compact ? 'opacity-40 lg:opacity-0 lg:group-hover:opacity-100' : 'opacity-40 group-hover:opacity-100'}
        `}
      >
        <GripVertical size={16} strokeWidth={2} />
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${compact ? 'pl-3' : 'pl-4'}`}>
        <div className="flex justify-between items-start mb-1">
          <h4 className="font-bold text-sm text-zinc-100 truncate pr-2">{place.name}</h4>
          {place.entryFee && place.entryFee > 0 ? (
            <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#222] shrink-0">
              <Ticket size={10} /> ₹{place.entryFee}
            </div>
          ) : null}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${catStyle}`}>
              {place.category || 'Location'}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium">
              <Clock size={10} /> {(place.visitDurationHours || 1) + (place.travelTimeHours || 0)}h
            </span>
          </div>

          {/* Quick Add Button (Vault only) */}
          {onQuickAdd && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdd(place.id);
              }}
              className="px-2 py-1 bg-zinc-800 hover:bg-emerald-600 text-zinc-400 hover:text-white rounded text-[10px] font-bold uppercase tracking-widest transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1"
            >
              <Plus size={10} /> Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
