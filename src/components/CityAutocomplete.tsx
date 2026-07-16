'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';


interface CityAutocompleteProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
}

export default function CityAutocomplete({ label, placeholder, value, onChange }: CityAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync internal query with external value if it changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (val === '') {
      onChange('');
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (val.length >= 1) {
      setLoading(true);
      timeoutRef.current = setTimeout(async () => {
        const apiResults = await api.searchCity(val);
        setResults(apiResults);
        setIsOpen(true);
        setLoading(false);
      }, 500);
    } else {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
    }
  };

  const handleSelect = (city: string) => {
    setQuery(city);
    onChange(city);
    setIsOpen(false);
  };

  return (
    <div className="space-y-2 relative" ref={wrapperRef}>
      {label && <label className="text-sm font-medium text-muted-foreground">{label}</label>}
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          className="w-full p-3 bg-background border border-input text-foreground rounded-lg focus:ring-2 focus:ring-primary outline-none placeholder:text-muted-foreground/50 pr-10 transition-colors text-[11px] sm:text-[13px] truncate"
          value={query}
          onChange={handleInputChange}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        />
        {/\d/.test(query) && (
          <div className="absolute top-full mt-1.5 left-0 text-red-500 text-[11px] font-medium flex items-center gap-1.5 bg-red-500/10 px-2 py-1.5 rounded-md backdrop-blur-sm border border-red-500/20 whitespace-nowrap z-50">
            <AlertCircle size={12} className="shrink-0" />
            <span>Invalid entry</span>
          </div>
        )}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="animate-spin text-muted-foreground" size={18} />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden top-[100%]">
          {results.map((res, i) => (
            <div
              key={i}
              className="p-3 hover:bg-muted cursor-pointer flex flex-col border-b last:border-0 border-border transition-colors"
              onClick={() => handleSelect(res.name)}
            >
              <div className="font-semibold text-foreground flex items-center gap-2 overflow-hidden">
                <MapPin size={14} className="text-muted-foreground shrink-0" />
                <span className="shrink-0">{res.name}</span>
                <span className="text-muted-foreground text-xs font-normal truncate">({res.state})</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}