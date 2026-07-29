'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DropdownOption {
  label: string;
  value: string;
  icon?: string | React.ReactNode;
}

interface CustomDropdownProps {
  label?: React.ReactNode;
  options: (string | DropdownOption)[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  colorTheme?: 'orange' | 'emerald' | 'sky' | 'purple' | 'default';
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  className = '',
  colorTheme = 'orange',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const normalizedOptions: DropdownOption[] = options.map((opt) =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const selectedOption = normalizedOptions.find((o) => o.value === value);

  // Theme-based accent styling
  const themeStyles = {
    orange: {
      activeItem: 'bg-[#FFF3E6] text-[#D45B0C] font-black border-l-4 border-[#FF8A3D]',
      hoverItem: 'hover:bg-[#FFF7F0] hover:text-[#D45B0C]',
      border: 'border-[#FF8A3D]/30 focus:border-[#FF8A3D] focus:ring-4 focus:ring-[#FF8A3D]/10',
      iconText: 'text-[#FF8A3D]',
    },
    emerald: {
      activeItem: 'bg-emerald-50 text-emerald-800 font-black border-l-4 border-emerald-600',
      hoverItem: 'hover:bg-emerald-50/60 hover:text-emerald-700',
      border: 'border-emerald-600/30 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10',
      iconText: 'text-emerald-600',
    },
    sky: {
      activeItem: 'bg-sky-50 text-sky-800 font-black border-l-4 border-sky-600',
      hoverItem: 'hover:bg-sky-50/60 hover:text-sky-700',
      border: 'border-sky-600/30 focus:border-sky-600 focus:ring-4 focus:ring-sky-600/10',
      iconText: 'text-sky-600',
    },
    purple: {
      activeItem: 'bg-purple-50 text-purple-800 font-black border-l-4 border-purple-600',
      hoverItem: 'hover:bg-purple-50/60 hover:text-purple-700',
      border: 'border-purple-600/30 focus:border-purple-600 focus:ring-4 focus:ring-purple-600/10',
      iconText: 'text-purple-600',
    },
    default: {
      activeItem: 'bg-neutral-100 text-[#1F2937] font-black border-l-4 border-neutral-800',
      hoverItem: 'hover:bg-neutral-50 hover:text-[#1F2937]',
      border: 'border-[#FF8A3D]/30 focus:border-[#FF8A3D]',
      iconText: 'text-[#1F2937]',
    },
  }[colorTheme];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <div className="mb-1">{label}</div>}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-12 px-4 rounded-xl bg-white border-2 text-left flex items-center justify-between transition-all duration-200 shadow-xs text-xs sm:text-sm ${themeStyles.border} ${
          isOpen ? 'ring-2 ring-[#FF8A3D]/20 border-[#FF8A3D]' : 'hover:border-[#FF8A3D]/60'
        }`}
      >
        <span className="truncate pr-2 font-bold text-[#1F2937] flex items-center gap-1.5">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span>{selectedOption.icon}</span>}
              <span>{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-[#6B7280] font-medium">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`text-[#6B7280] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[#FF8A3D]' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 z-[100] mt-2 bg-white rounded-2xl border-2 border-[#FF8A3D]/25 shadow-2xl py-2 overflow-y-auto max-h-[300px] min-w-[200px]"
          >
            {normalizedOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-between transition-colors duration-150 ${
                    isSelected ? themeStyles.activeItem : `text-[#374151] ${themeStyles.hoverItem}`
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {opt.icon && <span>{opt.icon}</span>}
                    <span>{opt.label}</span>
                  </span>
                  {isSelected && <Check size={15} className="shrink-0 text-current ml-2 font-black" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
