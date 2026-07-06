'use client';

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

interface AnimatedGlobeProps {
  passengers: { city: string }[];
  destination: string;
}

export default function AnimatedGlobe({ passengers, destination }: AnimatedGlobeProps) {
  const [arcsData, setArcsData] = useState<any[]>([]);
  const [labelsData, setLabelsData] = useState<any[]>([]);
  const [isClient, setIsClient] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [dims, setDims] = useState({ width: 400, height: 800 });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setDims({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!destination) {
      setArcsData([]);
      return;
    }

    const fetchCoords = async () => {
      try {
        const newArcs: any[] = [];
        const newLabels: any[] = [];
        const uniqueCities = Array.from(new Set(passengers.map(p => p.city).filter(Boolean)));
        
        let destCoords: [number, number] | null = null;

        if (destination) {
          const destRes = await api.searchCity(destination);
          if (destRes && destRes.length > 0 && destRes[0].osrm_coords) {
            destCoords = destRes[0].osrm_coords.split(',').map(Number) as [number, number];
            newLabels.push({ lat: destCoords[1], lng: destCoords[0], text: destination, color: '#10b981', type: 'destination' });
          }
        }
        
        for (const city of uniqueCities) {
          const srcRes = await api.searchCity(city);
          if (srcRes && srcRes.length > 0 && srcRes[0].osrm_coords) {
            const [srcLng, srcLat] = srcRes[0].osrm_coords.split(',').map(Number);
            newLabels.push({ lat: srcLat, lng: srcLng, text: city, color: '#3b82f6', type: 'origin' });

            if (destCoords && city !== destination) {
              newArcs.push({
                startLat: srcLat,
                startLng: srcLng,
                endLat: destCoords[1],
                endLng: destCoords[0],
                color: ['#ffeb3b', '#ff1744'], // Yellow to sharp red for a vivid arrow-like comet
              });
            }
          }
        }
        
        setArcsData(newArcs);
        setLabelsData(newLabels);
      } catch (error) {
        console.error('Failed to fetch coordinates for globe', error);
      }
    };

    // Debounce slightly to prevent API spam while typing
    const timeout = setTimeout(fetchCoords, 500);
    return () => clearTimeout(timeout);
  }, [passengers, destination]);

  // Handle dynamic zooming and panning
  useEffect(() => {
    if (!globeRef.current || labelsData.length === 0) return;

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    
    labelsData.forEach(lbl => {
      if (lbl.lat < minLat) minLat = lbl.lat;
      if (lbl.lat > maxLat) maxLat = lbl.lat;
      if (lbl.lng < minLng) minLng = lbl.lng;
      if (lbl.lng > maxLng) maxLng = lbl.lng;
    });

    const centerLat = (minLat + maxLat) / 2;
    let centerLng = (minLng + maxLng) / 2;

    // Handle cross-dateline issues gracefully (simple approach)
    if (maxLng - minLng > 180) {
      centerLng = centerLng > 0 ? centerLng - 180 : centerLng + 180;
    }

    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);
    
    // Altitude calculation: smaller diff = lower altitude (closer zoom)
    // Minimum altitude is 1.2, Max is 2.5
    let altitude = Math.max(1.2, Math.min(2.5, maxDiff * 0.05 + 1.2));
    
    // If only one point, zoom in nicely
    if (labelsData.length === 1) {
      altitude = 1.4;
    }

    globeRef.current.pointOfView({ lat: centerLat, lng: centerLng, altitude }, 1200);
  }, [labelsData]);

  if (!isClient) return <div className="absolute inset-0 bg-transparent" />;

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center">
      <Globe
        ref={globeRef}
        width={dims.width}
        height={dims.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"
        
        arcsData={arcsData}
        arcColor="color"
        arcDashLength={0.15}
        arcDashGap={0.85}
        arcDashInitialGap={() => Math.random()}
        arcDashAnimateTime={1000}
        arcStroke={2}
        arcAltitudeAutoScale={0.4}

        labelsData={labelsData}
        labelLat="lat"
        labelLng="lng"
        labelText="text"
        labelSize={1.8}
        labelDotRadius={0.6}
        labelColor="color"
        labelResolution={2}

        showAtmosphere={true}
        atmosphereColor="#60a5fa"
        atmosphereAltitude={0.2}
      />
      <style jsx global>{`
        .scene-container canvas {
          outline: none;
        }
      `}</style>
    </div>
  );
}
