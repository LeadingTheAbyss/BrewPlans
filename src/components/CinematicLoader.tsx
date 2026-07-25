'use client';

import React, { useEffect, useRef, useState } from 'react';

// ─── Image Pools ────────────────────────────────────────────────────────────
// Dynamic high quality Wikipedia images using internal API (with fallback)

const PLACES_IMAGES = [
  { url: '/api/destination-photo?name=Goa&type=place&redirect=true', label: 'Goa', tag: 'Beaches' },
  { url: '/api/destination-photo?name=Mumbai&type=place&redirect=true', label: 'Mumbai', tag: 'City' },
  { url: '/api/destination-photo?name=Ladakh&type=place&redirect=true', label: 'Ladakh', tag: 'Mountains' },
  { url: '/api/destination-photo?name=Udaipur&type=place&redirect=true', label: 'Udaipur', tag: 'Heritage' },
  { url: '/api/destination-photo?name=Jaipur&type=place&redirect=true', label: 'Jaipur', tag: 'Royal' },
  { url: '/api/destination-photo?name=Agra&type=place&redirect=true', label: 'Agra', tag: 'Historic' },
  { url: '/api/destination-photo?name=Varanasi&type=place&redirect=true', label: 'Varanasi', tag: 'Spiritual' },
  { url: '/api/destination-photo?name=Hampi&type=place&redirect=true', label: 'Hampi', tag: 'Ruins' },
  { url: '/api/destination-photo?name=Munnar&type=place&redirect=true', label: 'Munnar', tag: 'Nature' },
  { url: '/api/destination-photo?name=Delhi&type=place&redirect=true', label: 'Delhi', tag: 'Capital' },
  { url: '/api/destination-photo?name=Mysore&type=place&redirect=true', label: 'Mysore', tag: 'Palace' },
  { url: '/api/destination-photo?name=Madurai&type=place&redirect=true', label: 'Madurai', tag: 'Culture' },
  { url: '/api/destination-photo?name=Hyderabad&type=place&redirect=true', label: 'Hyderabad', tag: 'Heritage' },
  { url: '/api/destination-photo?name=Kolkata&type=place&redirect=true', label: 'Kolkata', tag: 'Classic' },
  { url: '/api/destination-photo?name=Qutub+Minar&type=place&redirect=true', label: 'Qutub Minar', tag: 'Monument' },
  { url: '/api/destination-photo?name=Ajanta+Caves&type=place&redirect=true', label: 'Ajanta Caves', tag: 'Ancient' },
  { url: '/api/destination-photo?name=Konark&type=place&redirect=true', label: 'Konark', tag: 'Temple' },
  { url: '/api/destination-photo?name=Ellora&type=place&redirect=true', label: 'Ellora', tag: 'Architecture' },
];

const FOOD_IMAGES = [
  { url: '/api/destination-photo?name=Biryani&type=food&redirect=true', label: 'Biryani', tag: 'Flavorful' },
  { url: '/api/destination-photo?name=Masala+Dosa&type=food&redirect=true', label: 'Masala Dosa', tag: 'South Indian' },
  { url: '/api/destination-photo?name=Samosa&type=food&redirect=true', label: 'Samosa', tag: 'Snack' },
  { url: '/api/destination-photo?name=Butter+Chicken&type=food&redirect=true', label: 'Butter Chicken', tag: 'Rich' },
  { url: '/api/destination-photo?name=Chole+Bhature&type=food&redirect=true', label: 'Chole Bhature', tag: 'North Indian' },
  { url: '/api/destination-photo?name=Paneer+Tikka&type=food&redirect=true', label: 'Paneer Tikka', tag: 'Tandoor' },
  { url: '/api/destination-photo?name=Pav+Bhaji&type=food&redirect=true', label: 'Pav Bhaji', tag: 'Street Food' },
  { url: '/api/destination-photo?name=Vada+Pav&type=food&redirect=true', label: 'Vada Pav', tag: 'Mumbai Special' },
  { url: '/api/destination-photo?name=Idli+Sambar&type=food&redirect=true', label: 'Idli Sambar', tag: 'Classic' },
  { url: '/api/destination-photo?name=Dal+Makhani&type=food&redirect=true', label: 'Dal Makhani', tag: 'Comfort' },
  { url: '/api/destination-photo?name=Palak+Paneer&type=food&redirect=true', label: 'Palak Paneer', tag: 'Healthy' },
  { url: '/api/destination-photo?name=Malai+Kofta&type=food&redirect=true', label: 'Malai Kofta', tag: 'Gourmet' },
  { url: '/api/destination-photo?name=Gulab+Jamun&type=food&redirect=true', label: 'Gulab Jamun', tag: 'Dessert' },
  { url: '/api/destination-photo?name=Jalebi&type=food&redirect=true', label: 'Jalebi', tag: 'Sweet' },
  { url: '/api/destination-photo?name=Thali&type=food&redirect=true', label: 'Thali', tag: 'Feast' },
  { url: '/api/destination-photo?name=Rogan+Josh&type=food&redirect=true', label: 'Rogan Josh', tag: 'Kashmiri' },
  { url: '/api/destination-photo?name=Tandoori+Chicken&type=food&redirect=true', label: 'Tandoori Chicken', tag: 'Grilled' },
  { url: '/api/destination-photo?name=Lassi&type=food&redirect=true', label: 'Lassi', tag: 'Beverage' },
];

const HOTELS_IMAGES = [
  { url: '/api/destination-photo?name=Taj+Mahal+Palace&type=hotel&redirect=true', label: 'Taj Mahal Palace', tag: 'Mumbai' },
  { url: '/api/destination-photo?name=Umaid+Bhawan&type=hotel&redirect=true', label: 'Umaid Bhawan', tag: 'Jodhpur' },
  { url: '/api/destination-photo?name=Rambagh+Palace&type=hotel&redirect=true', label: 'Rambagh Palace', tag: 'Jaipur' },
  { url: '/api/destination-photo?name=Falaknuma+Palace&type=hotel&redirect=true', label: 'Falaknuma', tag: 'Hyderabad' },
  { url: '/api/destination-photo?name=Taj+Lake+Palace&type=hotel&redirect=true', label: 'Taj Lake Palace', tag: 'Udaipur' },
  { url: '/api/destination-photo?name=Jai+Mahal+Palace&type=hotel&redirect=true', label: 'Jai Mahal Palace', tag: 'Jaipur' },
  { url: '/api/destination-photo?name=Kumarakom+Lake+Resort&type=hotel&redirect=true', label: 'Kumarakom Lake Resort', tag: 'Kerala' },
  { url: '/api/destination-photo?name=Wildflower+Hall+Shimla&type=hotel&redirect=true', label: 'Wildflower Hall', tag: 'Shimla' },
  { url: '/api/destination-photo?name=Samode+Palace&type=hotel&redirect=true', label: 'Samode Palace', tag: 'Jaipur' },
  { url: '/api/destination-photo?name=Neemrana+Fort&type=hotel&redirect=true', label: 'Neemrana Fort', tag: 'Rajasthan' },
  { url: '/api/destination-photo?name=Lalitha+Mahal&type=hotel&redirect=true', label: 'Lalitha Mahal', tag: 'Mysore' },
  { url: '/api/destination-photo?name=ITC+Grand+Chola&type=hotel&redirect=true', label: 'ITC Grand Chola', tag: 'Chennai' },
  { url: '/api/destination-photo?name=Brunton+Boatyard&type=hotel&redirect=true', label: 'Brunton Boatyard', tag: 'Kochi' },
  { url: '/api/destination-photo?name=Ahilya+Fort&type=hotel&redirect=true', label: 'Ahilya Fort', tag: 'Maheshwar' },
  { url: '/api/destination-photo?name=Evolve+Back+Hampi&type=hotel&redirect=true', label: 'Evolve Back', tag: 'Hampi' },
  { url: '/api/destination-photo?name=Oberoi+Udaivilas&type=hotel&redirect=true', label: 'Oberoi Udaivilas', tag: 'Udaipur' },
  { url: '/api/destination-photo?name=Taj+Falaknuma&type=hotel&redirect=true', label: 'Taj Falaknuma', tag: 'Hyderabad' },
  { url: '/api/destination-photo?name=Leela+Palace+Udaipur&type=hotel&redirect=true', label: 'Leela Palace', tag: 'Udaipur' },
];

const IMAGE_POOLS = {
  places: PLACES_IMAGES,
  food: FOOD_IMAGES,
  hotels: HOTELS_IMAGES,
};

const CATEGORY_CONFIG = {
  places: {
    label: 'Discovering Places',
    sublabel: 'Finding the best attractions just for you',
    accent: '#3b82f6',
    accentRgb: '59, 130, 246',
    gradient: 'from-blue-950 via-slate-900 to-black',
  },
  food: {
    label: 'Exploring Restaurants',
    sublabel: 'Curating the best dining experiences for you',
    accent: '#f97316',
    accentRgb: '249, 115, 22',
    gradient: 'from-orange-950 via-zinc-900 to-black',
  },
  hotels: {
    label: 'Finding Hotels',
    sublabel: 'Selecting the finest stays just for you',
    accent: '#8b5cf6',
    accentRgb: '139, 92, 246',
    gradient: 'from-purple-950 via-zinc-900 to-black',
  },
};

// Preload images asynchronously
export function preloadCinematicImages(category: 'places' | 'food' | 'hotels') {
  if (typeof window === 'undefined') return;
  const images = IMAGE_POOLS[category];
  
  // We use setTimeout to push this to the end of the event queue so it doesn't block
  setTimeout(() => {
    // We could use requestIdleCallback if available, but a simple small delay is often enough
    const loadImages = () => {
      images.forEach(img => {
        const image = new Image();
        image.src = img.url;
      });
    };
    
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(loadImages);
    } else {
      loadImages();
    }
  }, 1000);
}

// ─── Fisher-Yates shuffle ─────────────────────────────────────────────────────
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Build column data (6+ cards per column, looping after 10s) ───────────────
function buildColumns(category: 'places' | 'food' | 'hotels') {
  const pool = shuffled(IMAGE_POOLS[category]);
  const half = Math.ceil(pool.length / 3);
  // Each column gets a slice of the shuffled pool, then repeats for looping
  const col1 = [...pool.slice(0, half), ...pool.slice(0, half)];
  const col2 = [...pool.slice(half, half * 2), ...pool.slice(half, half * 2)];
  const col3 = [...pool.slice(half * 2), ...pool.slice(half * 2)];
  return [col1, col2, col3];
}

// ─── PhotoCard ────────────────────────────────────────────────────────────────
function PhotoCard({ img, accent, delay }: {
  img: { url: string; label: string; tag: string };
  accent: string;
  delay: number;
}) {
  return (
    <div
      className="cinematic-card"
      style={{ animationDelay: `${delay}ms` }}
    >
      <img
        src={img.url}
        alt={img.label}
        loading="eager"
        decoding="async"
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
      />
      <div className="cinematic-card-overlay">
        <span className="cinematic-card-tag" style={{ background: `${accent}33`, borderColor: `${accent}55`, color: accent }}>
          {img.tag}
        </span>
        <span className="cinematic-card-label">{img.label}</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface CinematicLoaderProps {
  isLoading: boolean;
  category: 'places' | 'food' | 'hotels';
  destination?: string;
}

type Phase = 'entering' | 'running' | 'exiting' | 'done';

export function CinematicLoader({ isLoading, category, destination }: CinematicLoaderProps) {
  const [phase, setPhase] = useState<Phase>(isLoading ? 'entering' : 'done');
  const [columns, setColumns] = useState<ReturnType<typeof buildColumns>>(() => isLoading ? buildColumns(category) : [[], [], []]);
  const startTimeRef = useRef<number>(Date.now());
  const MIN_DISPLAY_MS = 2500; // Reduced from 4s to 2.5s for snappier feel without flickering

  const config = CATEGORY_CONFIG[category];

  // If loading starts again (e.g. changing filters)
  useEffect(() => {
    if (isLoading && phase === 'done') {
      setColumns(buildColumns(category));
      startTimeRef.current = Date.now();
      setPhase('entering');
    }
  }, [isLoading, category, phase]);

  // Transition entering -> running
  useEffect(() => {
    if (phase === 'entering') {
      if (columns[0].length === 0) {
         setColumns(buildColumns(category));
      }
      startTimeRef.current = Date.now();
      const enterTimer = setTimeout(() => setPhase('running'), 50);
      return () => clearTimeout(enterTimer);
    }
  }, [phase, category, columns]);

  // Watch isLoading to trigger exit after min display time
  useEffect(() => {
    if (!isLoading && phase === 'running') {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

      const exitTimer = setTimeout(() => {
        setPhase('exiting');
        // After exit animation (900ms), mark done
        setTimeout(() => setPhase('done'), 900);
      }, remaining);

      return () => clearTimeout(exitTimer);
    }
  }, [isLoading, phase]);

  if (phase === 'done') return null;

  return (
    <>
      {/* Injected CSS */}
      <style>{`
        @keyframes scrollUp {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes scrollDown {
          0% { transform: translateY(-50%); }
          100% { transform: translateY(0); }
        }
        @keyframes shimmerSweep {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes cardFadeIn {
          from { opacity: 0; transform: scale(0.92) translateY(16px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }
        @keyframes cinematic-bounce {
          0%, 100% { transform: translateY(0) scale(0.8); opacity: 0.4; }
          50% { transform: translateY(-8px) scale(1.2); opacity: 1; box-shadow: 0 4px 16px var(--cinematic-accent); }
        }
        @keyframes floatBadge {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }

        .cinematic-loader-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          overflow: hidden;
          background: #050508;
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .cinematic-loader-overlay.phase-running {
          opacity: 1;
        }
        .cinematic-loader-overlay.phase-exiting {
          opacity: 0;
          transition: opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .cinematic-columns {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          padding: 10px;
        }

        .cinematic-column {
          display: flex;
          flex-direction: column;
          gap: 10px;
          will-change: transform;
        }
        .cinematic-col-0 { animation: scrollUp 24s linear infinite; }
        .cinematic-col-1 { animation: scrollDown 19s linear infinite; }
        .cinematic-col-2 { animation: scrollUp 15s linear infinite; }

        .cinematic-card {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          flex-shrink: 0;
          height: 220px;
          background: #111;
          opacity: 0;
          animation: cardFadeIn 0.6s ease forwards;
          box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        }
        .cinematic-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 6s ease;
        }
        .cinematic-card:hover img {
          transform: scale(1.06);
        }
        .cinematic-card-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 12px;
          gap: 4px;
        }
        .cinematic-card-tag {
          display: inline-block;
          width: fit-content;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 20px;
          border: 1px solid;
          backdrop-filter: blur(4px);
        }
        .cinematic-card-label {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.92);
          line-height: 1.3;
        }

        .cinematic-center-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0;
          pointer-events: none;
          z-index: 10;
        }

        .cinematic-blur-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 55% 50% at 50% 50%, rgba(0,0,0,0.82) 30%, transparent 100%);
        }

        .cinematic-badge {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          animation: floatBadge 3.5s ease-in-out infinite;
        }

        .cinematic-destination-label {
          font-size: clamp(13px, 1.5vw, 16px);
          font-weight: 600;
          letter-spacing: 0.4em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.7);
          margin-bottom: 8px;
        }

        .cinematic-title {
          font-size: clamp(26px, 4vw, 48px);
          font-weight: 800;
          letter-spacing: -0.02em;
          text-align: center;
          background: linear-gradient(120deg, #fff 20%, var(--cinematic-accent) 50%, #fff 80%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerSweep 2.5s linear infinite;
          line-height: 1.15;
          padding: 0 20px;
        }

        .cinematic-subtitle {
          font-size: clamp(12px, 1.5vw, 15px);
          font-weight: 400;
          color: rgba(255,255,255,0.45);
          letter-spacing: 0.02em;
          text-align: center;
          margin-top: 6px;
        }

        .cinematic-dots {
          display: flex;
          gap: 8px;
          margin-top: 20px;
        }
        .cinematic-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: cinematic-bounce 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
        }
        .cinematic-dot:nth-child(1) { animation-delay: 0ms; }
        .cinematic-dot:nth-child(2) { animation-delay: 150ms; }
        .cinematic-dot:nth-child(3) { animation-delay: 300ms; }

        .cinematic-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(to right, rgba(5,5,8,0.65) 0%, transparent 18%, transparent 82%, rgba(5,5,8,0.65) 100%),
            linear-gradient(to bottom, rgba(5,5,8,0.5) 0%, transparent 14%, transparent 86%, rgba(5,5,8,0.5) 100%);
        }
      `}</style>

      <div
        className={`cinematic-loader-overlay ${phase === 'running' ? 'phase-running' : phase === 'exiting' ? 'phase-exiting' : ''}`}
        style={{ '--cinematic-accent': config.accent } as React.CSSProperties}
        aria-label="Loading content, please wait"
        aria-live="polite"
      >
        {/* 3-Column Photo Wall */}
        <div className="cinematic-columns">
          {columns.map((col, colIdx) => (
            <div key={colIdx} className={`cinematic-column cinematic-col-${colIdx}`}>
              {col.map((img, i) => (
                <PhotoCard
                  key={`${colIdx}-${i}`}
                  img={img}
                  accent={config.accent}
                  delay={i * 60 + colIdx * 80}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Edge vignettes */}
        <div className="cinematic-vignette" />

        {/* Center hero overlay */}
        <div className="cinematic-center-overlay">
          <div className="cinematic-blur-bg" />
          <div className="cinematic-badge">
            {destination && (
              <div className="cinematic-destination-label">{destination}</div>
            )}
            <div className="cinematic-title">{config.label}</div>
            <div className="cinematic-subtitle">{config.sublabel}</div>
            <div className="cinematic-dots">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="cinematic-dot"
                  style={{ background: config.accent }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
