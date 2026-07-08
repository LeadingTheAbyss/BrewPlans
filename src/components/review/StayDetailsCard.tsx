'use client';

import React from 'react';
import { Hotel } from '@/types/trip';
import { Calendar, Bed, Users } from 'lucide-react';
import Link from 'next/link';

interface StayDetailsCardProps {
  hotel: Hotel;
  checkInDate: string | null;
  checkOutDate: string | null;
  paxCount: number;
}

export default function StayDetailsCard({ hotel, checkInDate, checkOutDate, paxCount }: StayDetailsCardProps) {
  const nights = hotel.nights || 1;
  const rooms = Math.ceil(paxCount / 3);
  const totalCost = rooms * hotel.pricePerNight * nights;

  // Format date helper
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-[#111111] border border-[#222222] rounded-2xl flex flex-col md:flex-row overflow-hidden shadow-sm">
      {/* Hotel Image */}
      <div className="md:w-72 h-48 md:h-auto relative shrink-0 bg-zinc-900">
        {hotel.imageUrl && (
          <img 
            src={hotel.imageUrl} 
            alt={hotel.name} 
            className="w-full h-full object-cover absolute inset-0 z-10"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <div className="absolute inset-0 z-0 w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center text-zinc-600 font-medium">
          No Image
        </div>
      </div>

      {/* Details Area */}
      <div className="flex-1 p-6 flex flex-col">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {hotel.name}
              <span className="text-yellow-500 text-sm">{'★'.repeat(Math.round(hotel.rating || 5))}</span>
            </h3>
            <p className="text-sm text-zinc-400 mt-1">{hotel.location || 'City Center, Destination'}</p>
          </div>
          <Link 
            href="/plan/hotels"
            className="px-4 py-1.5 rounded-full border border-zinc-700 text-xs font-medium hover:bg-zinc-800 text-zinc-300 transition-colors"
          >
            View Details
          </Link>
        </div>

        {/* Stats Row */}
        <div className="mt-auto grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-[#222]">
          
          <div>
            <div className="text-[11px] text-zinc-500 mb-1 flex items-center gap-1.5"><Calendar size={12}/> Check-in</div>
            <div className="text-sm font-medium text-zinc-200">{formatDate(checkInDate)}</div>
          </div>

          <div>
            <div className="text-[11px] text-zinc-500 mb-1 flex items-center gap-1.5"><Calendar size={12}/> Check-out</div>
            <div className="text-sm font-medium text-zinc-200">{formatDate(checkOutDate)}</div>
          </div>
          
          <div>
            <div className="text-[11px] text-zinc-500 mb-1 flex items-center gap-1.5"><Calendar size={12}/> Duration</div>
            <div className="text-sm font-medium text-zinc-200">{Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24))} Nights</div>
          </div>

          <div>
            <div className="text-[11px] text-zinc-500 mb-1 flex items-center gap-1.5"><Bed size={12}/> Rooms</div>
            <div className="text-sm font-medium text-zinc-200">{rooms} {rooms === 1 ? 'Room' : 'Rooms'}</div>
          </div>

          <div className="text-right md:ml-auto">
            <div className="text-[11px] text-zinc-500 mb-1">Total Cost</div>
            <div className="text-lg font-bold text-white">₹{totalCost.toLocaleString('en-IN')}</div>
            <div className="text-xs text-zinc-500 mt-0.5">₹{Math.round(totalCost / Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24))).toLocaleString('en-IN')} / night</div>
          </div>

        </div>
      </div>
    </div>
  );
}
