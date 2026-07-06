'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Place, ItineraryDay } from '@/types/trip';

interface ItineraryMapProps {
  days: ItineraryDay[];
  places: Place[];
  apiKey: string;
}

const DAY_COLORS = [
  '#2563eb', // Blue (Day 1)
  '#dc2626', // Red (Day 2)
  '#16a34a', // Green (Day 3)
  '#d97706', // Orange (Day 4)
  '#9333ea', // Purple (Day 5)
  '#0891b2', // Cyan (Day 6)
  '#be123c', // Rose (Day 7)
];

export function ItineraryMap({ days, places, apiKey }: ItineraryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let mapInstance: any = null;

    const initMap = async () => {
      try {
        if (!apiKey) {
          console.warn('Google Maps API key is missing');
          if (isMounted) setMapError(true);
          return;
        }

        // @ts-ignore
        if (!window.google?.maps?.importLibrary) {
          const scriptId = 'google-maps-bootstrap';
          if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.innerHTML = `(g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=\`https://maps.\${c}apis.com/maps/api/js?\`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({key: "${apiKey}", v: "weekly"});`;
            document.head.appendChild(script);
          }
        }

        // @ts-ignore
        const { Map, Polyline } = await window.google.maps.importLibrary("maps");
        // @ts-ignore
        const { AdvancedMarkerElement, PinElement } = await window.google.maps.importLibrary("marker");

        if (!isMounted || !mapRef.current) return;

        mapInstance = new Map(mapRef.current, {
          mapId: 'DEMO_MAP_ID',
          zoom: 12,
          center: { lat: 20.5937, lng: 78.9629 }, // Default India center
          disableDefaultUI: true,
          zoomControl: true,
        });

        // @ts-ignore
        const bounds = new window.google.maps.LatLngBounds();
        let hasPoints = false;

        days.forEach((day, dayIndex) => {
          const color = DAY_COLORS[dayIndex % DAY_COLORS.length];
          const pathCoords: { lat: number, lng: number }[] = [];

          day.placeIds.forEach((placeId, placeIndex) => {
            const place = places.find(p => p.id === placeId);
            if (place && place.lat && place.lng) {
              const pos = { lat: place.lat, lng: place.lng };
              pathCoords.push(pos);
              bounds.extend(pos);
              hasPoints = true;

              const pin = new PinElement({
                background: color,
                borderColor: color,
                glyphColor: 'white',
                glyph: `${placeIndex + 1}`,
              });

              new AdvancedMarkerElement({
                map: mapInstance,
                position: pos,
                title: place.name,
                content: pin.element,
              });
            }
          });

          if (pathCoords.length > 1) {
            new Polyline({
              path: pathCoords,
              geodesic: true,
              strokeColor: color,
              strokeOpacity: 0.8,
              strokeWeight: 4,
              map: mapInstance,
            });
          }
        });

        if (hasPoints) {
          mapInstance.fitBounds(bounds);
        }
      } catch (err) {
        console.error("Map initialization failed", err);
        if (isMounted) setMapError(true);
      }
    };

    initMap();

    return () => {
      isMounted = false;
    };
  }, [days, places, apiKey]);

  if (mapError) {
    return <div className="w-full h-full bg-zinc-100 flex items-center justify-center rounded-2xl text-zinc-500 font-medium border border-zinc-200">Failed to load Map</div>;
  }

  return <div ref={mapRef} className="w-full h-full rounded-2xl shadow-sm overflow-hidden" />;
}
