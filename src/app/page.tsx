'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { UserAvatar } from '@/components/UserAvatar';
import { FeedbackModal } from '@/components/FeedbackModal';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Sparkles, Search, Globe, ChevronDown, Train, Map, Menu, X, MessageSquare } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { user, fetchUser } = useAuthStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const handleNavigation = (path: string) => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(path)}`);
    } else {
      router.push(path);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    // Register GSAP Plugin
    gsap.registerPlugin(ScrollTrigger);

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate normalized X position (-0.5 to 0.5) and invert it for natural parallax
      const xPos = (e.clientX / window.innerWidth - 0.5) * -100; 
      gsap.to('.clouds', {
        x: xPos,
        duration: 1.5,
        ease: 'power2.out'
      });
    };
    window.addEventListener('mousemove', handleMouseMove);



    let renderer: THREE.WebGLRenderer;
    let sceneObj: any;

    class Scene {
      views: any[];
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      light: THREE.PointLight;
      softLight: THREE.AmbientLight;
      modelGroup: THREE.Group;
      w: number = window.innerWidth;
      h: number = window.innerHeight;

      constructor(model: THREE.Group) {
        this.views = [
          { bottom: 0, height: 1 },
          { bottom: 0, height: 0 }
        ];

        this.renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          canvas: canvasRef.current!
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setPixelRatio(window.devicePixelRatio);
        renderer = this.renderer; // Save reference for cleanup

        this.scene = new THREE.Scene();

        for (let ii = 0; ii < this.views.length; ++ii) {
          const view = this.views[ii];
          const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
          camera.position.fromArray([0, 0, 180]);
          camera.layers.disableAll();
          camera.layers.enable(ii);
          view.camera = camera;
          camera.lookAt(new THREE.Vector3(0, 5, 0));
        }

        this.light = new THREE.PointLight(0xffffff, 0.75, 0, 0); // added 0,0 for warnings in newer threejs
        this.light.position.set(70, -20, 150);
        this.scene.add(this.light);

        this.softLight = new THREE.AmbientLight(0xffffff, 1.5);
        this.scene.add(this.softLight);

        this.onResize();
        window.addEventListener('resize', this.onResize, false);

        const edges = new THREE.EdgesGeometry((model.children[0] as THREE.Mesh).geometry);
        const line = new THREE.LineSegments(edges);
        (line.material as THREE.LineBasicMaterial).depthTest = false;
        (line.material as THREE.LineBasicMaterial).opacity = 0.5;
        (line.material as THREE.LineBasicMaterial).transparent = true;
        line.position.set(0.5, 0.2, -1);

        this.modelGroup = new THREE.Group();
        model.layers.set(0);
        line.layers.set(1);

        this.modelGroup.add(model);
        this.modelGroup.add(line);
        this.scene.add(this.modelGroup);
      }

      render = () => {
        for (let ii = 0; ii < this.views.length; ++ii) {
          const view = this.views[ii];
          const camera = view.camera;

          const bottom = Math.floor(this.h * view.bottom);
          const height = Math.floor(this.h * view.height);

          this.renderer.setViewport(0, 0, this.w, this.h);
          this.renderer.setScissor(0, bottom, this.w, height);
          this.renderer.setScissorTest(true);

          camera.aspect = this.w / this.h;
          this.renderer.render(this.scene, camera);
        }
      };

      onResize = () => {
        this.w = window.innerWidth;
        this.h = window.innerHeight;

        for (let ii = 0; ii < this.views.length; ++ii) {
          const view = this.views[ii];
          const camera = view.camera;
          camera.aspect = this.w / this.h;
          const isMobile = this.w < 768;
          const minZ = isMobile ? 340 : 180;
          const camZ = (window.screen.width - (this.w * 1)) / 3;
          camera.position.z = camZ < minZ ? minZ : camZ;
          camera.updateProjectionMatrix();
        }

        this.renderer.setSize(this.w, this.h);
        this.render();
      };
    }

    function setupAnimation(model: THREE.Group) {
      sceneObj = new Scene(model);
      const scene = sceneObj;
      const plane = scene.modelGroup;

      gsap.fromTo('canvas', { x: "50%", autoAlpha: 0 }, { duration: 1, x: "0%", autoAlpha: 1 });
      gsap.to('.loading', { autoAlpha: 0 });
      gsap.to('.scroll-cta', { opacity: 1 });
      gsap.set('svg', { autoAlpha: 1 });

      const tau = Math.PI * 2;
      const isMobile = window.innerWidth < 768;
      const m = isMobile ? -1 : 1;

      gsap.set(plane.rotation, { y: tau * -.25 * m });
      gsap.set(plane.position, { x: (isMobile ? 40 : 80) * m, y: -32, z: -60 });

      scene.render();

      const sectionDuration = 1;

      // Animate background layers independently over the full scroll duration
      gsap.to('.particles-takeoff', {
        backgroundPosition: "0 500px", // parallax scroll
        scrollTrigger: { trigger: ".content", scrub: true, start: "top top", end: "bottom bottom" }
      });
      gsap.to('.volumetric-clouds', {
        y: "-15%", // parallax
        scrollTrigger: { trigger: ".content", scrub: true, start: "top top", end: "bottom bottom" }
      });
      gsap.to('.nav-grid', {
        rotation: 15, scale: 1.1,
        scrollTrigger: { trigger: ".content", scrub: true, start: "top top", end: "bottom bottom" }
      });
      gsap.to('.mountain-silhouettes', {
        y: "20vh", // Parallax mountains down as we fly over them
        scrollTrigger: { trigger: ".content", scrub: true, start: "top top", end: "bottom bottom" }
      });
      gsap.to('.city-skyline', {
        y: "10vh",
        scrollTrigger: { trigger: ".content", scrub: true, start: "top top", end: "bottom bottom" }
      });

      gsap.fromTo('.silhouette-back', 
        { opacity: 0, y: "20vh" },
        {
          opacity: 0.8,
          y: "0vh",
          scrollTrigger: {
            trigger: ".sunset",
            scrub: true,
            start: "top center",
            end: "bottom bottom"
          }
        }
      );

      gsap.fromTo('.silhouette-front', 
        { opacity: 0, y: "30vh" },
        {
          opacity: 1,
          y: "0vh",
          scrollTrigger: {
            trigger: ".sunset",
            scrub: true,
            start: "top center",
            end: "bottom bottom"
          }
        }
      );

      const tl = gsap.timeline({
        onUpdate: scene.render,
        scrollTrigger: {
          trigger: ".content",
          scrub: true,
          start: "top top",
          end: "bottom bottom"
        },
        defaults: { duration: sectionDuration, ease: 'power2.inOut' }
      });

      let delay = 0;
      const xOffset = (isMobile ? 32 : 40) * m;

      // 1. Intro (Left text) -> Plane Right (or Left on mobile)
      tl.to('.scroll-cta', { duration: 0.25, opacity: 0 }, delay);
      tl.to(plane.position, { x: xOffset, ease: 'power1.in' }, delay);
      // Atmosphere transition 1 -> 2
      tl.to('.takeoff-layer', { opacity: 0, ease: 'power1.inOut' }, delay + 0.5);
      tl.to('.altitude-layer', { opacity: 1, ease: 'power1.inOut' }, delay + 0.5);

      delay += sectionDuration;
      // 2. "Destination" (Right text) -> Plane Left
      tl.to(plane.rotation, { x: tau * .25, y: 0, z: -tau * 0.05 * m, ease: 'power1.inOut' }, delay);
      tl.to(plane.position, { x: -xOffset, y: 0, z: -60, ease: 'power1.inOut' }, delay);

      delay += sectionDuration;
      // 3. "Complex" (Left text) -> Plane Right
      tl.to(plane.rotation, { x: tau * .25, y: 0, z: tau * 0.05 * m, ease: 'power3.inOut' }, delay);
      tl.to(plane.position, { x: xOffset, y: 0, z: -60, ease: 'power2.inOut' }, delay);
      // Atmosphere transition 2 -> 3
      tl.to('.altitude-layer', { opacity: 0, ease: 'power1.inOut' }, delay + 0.5);
      tl.to('.nav-layer', { opacity: 1, ease: 'power1.inOut' }, delay + 0.5);

      delay += sectionDuration;
      // 4. "Tabs" (Right text) -> Plane Left
      tl.to(plane.rotation, { x: tau * .2, y: 0, z: -tau * 0.1 * m, ease: 'power3.inOut' }, delay);
      tl.to(plane.position, { x: -xOffset, y: 0, z: -60, ease: 'power2.inOut' }, delay);

      delay += sectionDuration;
      // 5. "Logistics" (Left text) -> Plane Right
      tl.to(plane.rotation, { x: tau * .25, y: 0, z: tau * 0.05 * m, ease: 'power3.inOut' }, delay);
      tl.to(plane.position, { x: xOffset, y: 0, z: -30, ease: 'power2.inOut' }, delay);
      // Atmosphere transition 3 -> 4
      tl.to('.nav-layer', { opacity: 0, ease: 'power1.inOut' }, delay + 0.5);
      tl.to('.descent-layer', { opacity: 1, ease: 'power1.inOut' }, delay + 0.5);

      delay += sectionDuration;
      // 6. "Defying" (Right text) -> Plane Left
      tl.to(plane.rotation, { x: 0, z: 0, y: tau * .25 * m }, delay);
      tl.to(plane.position, { x: (isMobile ? -10 : -20) * m, y: -10, z: 50 }, delay);

      delay += sectionDuration;
      // 7. Sunset empty -> Fly away
      tl.to(plane.rotation, { x: tau * 0.15, y: tau * .85 * m, z: -tau * 0, ease: 'power1.in' }, delay);
      tl.to(plane.position, { z: -150, x: 0, y: 0, ease: 'power1.inOut' }, delay);
      // Atmosphere transition 4 -> 5
      tl.to('.descent-layer', { opacity: 0, ease: 'power1.inOut' }, delay + 0.5);
      tl.to('.arrival-layer', { opacity: 1, ease: 'power1.inOut' }, delay + 0.5);

      delay += sectionDuration;
      // 8. Sunset end -> Rotate outwards and fly to a balanced Y position on mobile
      tl.to(plane.rotation, { duration: sectionDuration * 3, x: -tau * 0.05, y: tau * m, z: -tau * 0.1 * m, ease: 'power1.inOut' }, delay);
      tl.to(plane.position, { duration: sectionDuration * 3, x: 0, y: isMobile ? 40 : 0, z: 320, ease: 'power1.in' }, delay);
      
      tl.to(scene.light.position, { duration: sectionDuration * 3, x: 0, y: 0, z: 0 }, delay);
    }

    let mounted = true;

    function addWindows(planeGroup: THREE.Group, planeMesh: THREE.Mesh) {
      const box = new THREE.Box3().setFromObject(planeMesh);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const raycaster = new THREE.Raycaster();

      // Helper: raycast from side, return fuselage hit point
      function raycastSide(zPos: number, yPos: number, fromRight: boolean) {
        const origin = new THREE.Vector3(
          fromRight ? center.x + size.x * 2 : center.x - size.x * 2,
          yPos, zPos
        );
        const dir = new THREE.Vector3(fromRight ? -1 : 1, 0, 0);
        raycaster.set(origin, dir);
        const hits = raycaster.intersectObject(planeMesh, false)
          .filter(h => Math.abs(h.point.x - center.x) < size.x * 0.25);
        return hits.length > 0 ? hits[0] : null;
      }

      function placeMesh(geo: THREE.BufferGeometry, mat: THREE.Material, hit: any, group: THREE.Group) {
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(hit.point);
        m.position.addScaledVector(hit.face!.normal, 0.08);
        // Use lookAt instead of quaternion to guarantee the Y-axis stays perfectly vertical
        m.lookAt(hit.point.clone().add(hit.face!.normal));
        group.add(m);
      }

      // --- Shared Materials ---
      const windowRadius = Math.max(size.x, size.z) * 0.0075;
      const windowMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.9, clearcoat: 1.0 });

      // --- Doors (3 per side: front, mid, rear) ---
      const doorMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f5, roughness: 0.3, metalness: 0.2, clearcoat: 1.0 }); 
      // Made doors taller (0.12 instead of 0.08) per user request
      const doorGeo = new THREE.BoxGeometry(size.z * 0.018, size.y * 0.12, 0.5);
      
      const doorEdges = new THREE.EdgesGeometry(doorGeo);
      const doorEdgeMat = new THREE.LineBasicMaterial({ color: 0x999999, opacity: 0.8, transparent: true });

      const doorWindowGeo = new THREE.CylinderGeometry(windowRadius * 0.5, windowRadius * 0.5, 0.6, 16);
      doorWindowGeo.rotateX(Math.PI / 2);

      // Slightly lower the door center since it's taller now
      const doorY = box.min.y + size.y * 0.36;
      const doorZPositions = [
        box.max.z - size.z * 0.16, // Front door
        center.z + size.z * 0.03,  // Mid door
        box.min.z + size.z * 0.28  // Rear door
      ];

      doorZPositions.forEach(dz => {
        [true, false].forEach(fromRight => {
          const hit = raycastSide(dz, doorY, fromRight);
          if (hit) {
            const d = new THREE.Mesh(doorGeo, doorMat);
            d.position.copy(hit.point);
            d.position.addScaledVector(hit.face!.normal, 0.08);
            // Use lookAt to lock the door perfectly vertically
            d.lookAt(hit.point.clone().add(hit.face!.normal));

            const outline = new THREE.LineSegments(doorEdges, doorEdgeMat);
            d.add(outline); 

            const dw = new THREE.Mesh(doorWindowGeo, windowMat);
            // Shifted up slightly more because the door is taller
            dw.position.set(0, size.y * 0.035, 0); 
            d.add(dw);

            planeGroup.add(d);
          }
        });
      });

      // --- Passenger Windows ---
      // Use a cylinder (coin) instead of a flat circle to give it thickness to prevent Z-fighting
      const windowGeo = new THREE.CylinderGeometry(windowRadius, windowRadius, 0.5, 16);
      windowGeo.rotateX(Math.PI / 2); // Orient so the flat circular face points along Z
      const numWindows = 28;
      const startZ = box.min.z + size.z * 0.24;
      const endZ = box.max.z - size.z * 0.14;
      const winY = box.min.y + size.y * 0.35;

      for (let i = 0; i < numWindows; i++) {
        const z = startZ + (endZ - startZ) * (i / (numWindows - 1));
        
        // Skip passenger window if it overlaps with a door
        let overlap = false;
        doorZPositions.forEach(dz => {
           if (Math.abs(z - dz) < size.z * 0.025) {
               overlap = true;
           }
        });
        if (overlap) continue;

        [true, false].forEach(fromRight => {
          const hit = raycastSide(z, winY, fromRight);
          if (hit) placeMesh(windowGeo, windowMat, hit, planeGroup);
        });
      }

      // --- Cockpit Visor (2 dark angled windows near nose) ---
      const cockpitMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0a12, roughness: 0.05, metalness: 1.0, clearcoat: 1.0 });
      const cockpitGeo = new THREE.BoxGeometry(size.x * 0.06, size.y * 0.055, 0.5);
      const cockpitY = box.min.y + size.y * 0.385;
      const cockpitZ = box.max.z - size.z * 0.065;
      [true, false].forEach(fromRight => {
        const hit = raycastSide(cockpitZ, cockpitY, fromRight);
        if (hit) placeMesh(cockpitGeo, cockpitMat, hit, planeGroup);
      });
    }

    function onModelLoaded(loadedObject: THREE.Group) {
      if (!mounted) return;
      
      let planeMesh: THREE.Mesh | null = null;
      loadedObject.traverse(function (child) {
        if ((child as THREE.Mesh).isMesh) {
          planeMesh = child as THREE.Mesh;

          // --- Retract Landing Gear ---
          const box = new THREE.Box3().setFromObject(planeMesh);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const pos = planeMesh.geometry.attributes.position;
          
          const gearThreshold = box.min.y + size.y * 0.12; 
          
          const colors = [];
          
          for (let i = 0; i < pos.count; i++) {
            let x = pos.getX(i);
            let y = pos.getY(i);
            let z = pos.getZ(i);
            
            // Retract wheels
            if (y < gearThreshold) {
              pos.setY(i, gearThreshold);
              y = gearThreshold;
            }

            let r = 1, g = 1, b = 1;
            
            const distFromCenterX = Math.abs(x - center.x);
            const relZ = (z - box.min.z) / size.z;
            const relY = (y - box.min.y) / size.y;

            // 1. Paint Engines Gray — strict ellipsoid + hard Y cap so wings stay white
            const eDx = distFromCenterX - size.x * 0.26;
            const eDy = y - (box.min.y + size.y * 0.18);
            const eDz = z - (center.z + size.z * 0.08);

            const eRx = size.x * 0.10;
            const eRy = size.y * 0.10;
            const eRz = size.z * 0.16;

            // Hard Y cap: ONLY vertices strictly in the bottom 28% of the model
            if (
              y < box.min.y + size.y * 0.28 &&
              (eDx*eDx)/(eRx*eRx) + (eDy*eDy)/(eRy*eRy) + (eDz*eDz)/(eRz*eRz) < 1.0
            ) {
               r = 0.32; g = 0.32; b = 0.36;
            }

            // 2. Tail Fin Livery — tight to vertical stabilizer only (thin slab)
            // Vertical stabilizer is the thin geometry at the very back, centered on X=0
            if (
              distFromCenterX < size.x * 0.04 && // Only the thin fin, not fuselage
              relZ < 0.18 &&                     // Rear 18% of the plane
              relY > 0.52                        // Upper half
            ) {
               r = 0.88; g = 0.12; b = 0.18;   // Bold red
            }

            colors.push(r, g, b);
          }
          planeMesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
          planeMesh.geometry.attributes.position.needsUpdate = true;

          // Generate smooth vertex normals so it doesn't look faceted
          planeMesh.geometry.computeVertexNormals();
          
          // Realistic glossy white plane paint
          const mat = new THREE.MeshPhysicalMaterial({ 
            color: 0xf4f4f5, 
            metalness: 0.2, 
            roughness: 0.3,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            flatShading: false,
            vertexColors: true // Enable vertex coloring for the engines
          });
          planeMesh.material = mat;
        }
      });

      if (planeMesh) {
        try {
          addWindows(loadedObject, planeMesh);
        } catch (e) { console.error("Failed to add windows", e); }
      }

      setupAnimation(loadedObject);
    }

    const loader = new OBJLoader();
    loader.load(
      '/api/plane-obj', 
      function (obj) { 
        if (mounted) onModelLoaded(obj); 
      },
      undefined,
      function (error) {
        console.error("Failed to load plane model:", error);
        if (!mounted) return;
        
        // Fallback: create a dummy object so animations still run and page unhides
        const dummyGroup = new THREE.Group();
        const dummyMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.1, 0.1), 
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
        );
        dummyGroup.add(dummyMesh);
        setupAnimation(dummyGroup);
      }
    );

    // Cleanup
    return () => {
      mounted = false;
      window.removeEventListener('mousemove', handleMouseMove);
      ScrollTrigger.getAll().forEach(t => t.kill());
      if (sceneObj) {
        window.removeEventListener('resize', sceneObj.onResize);
      }
      if (renderer) {
        renderer.dispose();
      }
    };
  }, []);

  return (
    <div className="landing-body bg-[#0b0f19] text-white" ref={containerRef}>
      <div className="cinematic-bg">
        <div className="cinematic-bg-noise"></div>
        
        {/* Stage 1: TAKEOFF */}
        <div className="atmosphere-layer atmosphere-takeoff takeoff-layer">
          <div className="runway-glow"></div>
          <div className="particles-takeoff"></div>
        </div>

        {/* Stage 2: HIGH ALTITUDE */}
        <div className="atmosphere-layer atmosphere-altitude altitude-layer">
          <div className="volumetric-clouds"></div>
          <div className="sun-rays"></div>
        </div>

        {/* Stage 3: GLOBAL NAVIGATION */}
        <div className="atmosphere-layer atmosphere-nav nav-layer">
          <div className="nav-grid"></div>
          <div className="nav-lines"></div>
          <div className="nav-nodes"></div>
        </div>

        {/* Stage 4: GOLDEN HOUR DESCENT */}
        <div className="atmosphere-layer atmosphere-descent descent-layer">
          <div className="mountain-silhouettes"></div>
          <div className="atmospheric-haze"></div>
        </div>

        {/* Stage 5: ARRIVAL */}
        <div className="atmosphere-layer atmosphere-arrival arrival-layer">
          <div className="arrival-fog"></div>
          <div className="city-lights"></div>
          <div className="city-skyline"></div>
        </div>
      </div>
      <nav className="absolute top-0 left-0 w-full z-[100] flex items-center justify-between px-6 py-4 bg-[#282828] border-b border-[#3e3e3e] text-white font-sans transition-all duration-300">
        
        {/* Left: Logos and Links */}
        <div className="flex items-center gap-6">
          {/* Main Logo */}
          <div className="flex items-center gap-2 md:gap-4 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="hidden md:block relative w-28 h-10 flex-shrink-0">
              <img 
                src="/large_logo.png" 
                alt="PlanBro Logo" 
                className="absolute -top-3 -left-2 h-16 w-auto max-w-none object-contain" 
              />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-white drop-shadow-md z-10 relative">PlanBro</span>
          </div>

          {/* Links */}
          <div className="hidden lg:flex items-center gap-10 ml-20">
            <button 
              onClick={() => handleNavigation('/recommend')} 
              className="text-base tracking-wide font-bold text-white/80 hover:text-white hover:scale-105 transition-all"
            >
              Recommend Trips
            </button>
            <button 
              onClick={() => handleNavigation('/plan/setup')} 
              className="text-base tracking-wide font-bold text-white/80 hover:text-white hover:scale-105 transition-all"
            >
              Plan a Trip
            </button>
            <button 
              onClick={() => handleNavigation('/quick-trip')} 
              className="text-base tracking-wide font-bold text-white/80 hover:text-white hover:scale-105 transition-all flex items-center gap-1.5"
            >
              Plan a Hangout in Your City
            </button>
          </div>
        </div>

        {/* Right Action */}
        <div className="flex items-center gap-3 md:gap-4">
          <div className="lg:hidden flex items-center">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white/80 hover:text-white p-1 transition-colors">
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {user ? (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsFeedbackOpen(true)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all flex items-center justify-center text-white shrink-0"
                title="Send us Feedback"
              >
                <MessageSquare size={14} />
              </button>
              <button 
                onClick={() => router.push('/profile')}
                className="w-8 h-8 rounded-full border-2 border-white/20 hover:border-white transition-all overflow-hidden flex items-center justify-center shrink-0"
                title="Profile"
              >
                <UserAvatar user={user} className="w-full h-full text-xs" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => router.push('/login')}
              className="px-3 py-1.5 md:px-4 md:py-2 rounded bg-[#2A2A2E] hover:bg-[#3A3A3E] text-white text-[13px] font-bold transition-colors whitespace-nowrap"
            >
              Sign in
            </button>
          )}
        </div>
        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 w-full bg-[#282828] border-b border-[#3e3e3e] z-[99] flex flex-col px-6 py-6 gap-6 shadow-2xl animate-in slide-in-from-top-2">
          <button 
            onClick={() => { setMobileMenuOpen(false); handleNavigation('/recommend'); }} 
            className="text-lg tracking-wide font-bold text-white/90 hover:text-white text-left transition-colors"
          >
            Recommend Trips
          </button>
          <button 
            onClick={() => { setMobileMenuOpen(false); handleNavigation('/plan/setup'); }} 
            className="text-lg tracking-wide font-bold text-white/90 hover:text-white text-left transition-colors"
          >
            Plan a Trip
          </button>
          <button 
            onClick={() => { setMobileMenuOpen(false); handleNavigation('/quick-trip'); }} 
            className="text-lg tracking-wide font-bold text-white/90 hover:text-white text-left transition-colors"
          >
            Plan a Hangout in Your City
          </button>
        </div>
      )}
      </nav>

      <canvas ref={canvasRef} />
      <div className="content relative z-10">
        <div className="loading">Loading Engine...</div>
        <div className="trigger"></div>
        <div className="ground-container">
          <div className="parallax ground hidden"></div>
          
          <div className="section relative z-50 max-md:!px-6 max-md:!w-full max-md:!mx-0">
            <div className="pt-[8vh] md:pt-[12vh] max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">
              <h1 className="font-black text-6xl md:text-7xl lg:text-8xl tracking-tighter leading-[1] text-white mb-6 drop-shadow-sm">
                We plan the trip.<br/>
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">You pack your bags.</span>
              </h1>

            </div>

            <div className="scroll-cta absolute bottom-[10vh] left-6 md:left-0 flex flex-col items-start gap-3">
              <span className="font-bold text-[10px] md:text-xs tracking-[0.2em] uppercase text-white/60">Scroll to explore</span>
              <div className="w-[2px] h-12 md:h-16 bg-gradient-to-b from-white/50 to-transparent ml-1"></div>
            </div>
          </div>
          
          <div className="section right relative z-50">
            <div className="inline-block max-w-2xl backdrop-blur-xl bg-black/20 p-8 md:p-12 rounded-3xl border border-white/10 shadow-xl">
              <h2 className="!text-white">Trip planning shouldn't feel like a part-time job.</h2>
            </div>
          </div>

          <div className="section relative z-50">
            <div className="inline-block max-w-2xl backdrop-blur-xl bg-black/20 p-8 md:p-12 rounded-3xl border border-white/10 shadow-xl text-left">
              <h2 className="!text-white">Leave the details to us.</h2>
              <p className="text-xl md:text-2xl inline-block w-fit bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent font-bold mt-2">No tabs. No spreadsheets. No back-and-forth over budgets.</p>
            </div>
          </div>

          <div className="section right relative z-50">
            <div className="inline-block max-w-2xl backdrop-blur-xl bg-black/20 p-8 md:p-12 rounded-3xl border border-white/10 shadow-xl">
              <h2 className="!text-white">We find the way there.</h2>
              <p className="text-xl md:text-2xl inline-block w-fit bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent font-bold mt-2">Flights, trains, and buses, quietly compared until only the best remains.</p>
            </div>
          </div>

          <div className="section relative z-50">
            <div className="inline-block max-w-2xl backdrop-blur-xl bg-black/20 p-8 md:p-12 rounded-3xl border border-white/10 shadow-xl text-left">
              <h2 className="!text-white">Your whole trip, stitched together.</h2>
              <p className="text-xl md:text-2xl inline-block w-fit bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent font-bold mt-2">Stays, experiences, and timing, all laid out in one clean plan.</p>
            </div>
          </div>
          
          <div className="section right relative z-50">
            <div className="inline-block max-w-2xl backdrop-blur-xl bg-black/20 p-8 md:p-12 rounded-3xl border border-white/10 shadow-xl">
              <h2 className="!text-white">Less planning. More going.</h2>
              <p className="text-xl md:text-2xl inline-block w-fit bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent font-bold mt-2">Stop juggling logistics. Start the trip.</p>
            </div>
          </div>
          <div className="parallax clouds"></div>
        </div>
        
        <div className="blueprint relative z-0">
          {/* SVG blueprint outline removed for clean topographic map */}
          <div className="section"></div>
          <div className="section"></div>
        </div>

        <div className="sunset">
          <div className="silhouette-back"></div>
          <div className="silhouette-front"></div>
          <div className="section"></div>
          <div className="section end flex flex-col items-center justify-center pt-24 md:pt-32 pb-12 text-white !w-full !px-3 md:!px-10" style={{ height: 'auto', minHeight: '100vh' }}>
            <h2 className="mb-8 md:mb-12">Let's go.</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 w-full max-w-5xl mx-auto relative z-10">
              {/* Card 1: Recommend Mode */}
              <div 
                onClick={() => handleNavigation('/recommend')}
                className="bg-white/10 backdrop-blur-md border border-white/20 p-4 md:p-10 min-h-[110px] md:min-h-[240px] rounded-[1.25rem] md:rounded-3xl cursor-pointer hover:bg-white/20 transition-all md:hover:scale-105 group flex flex-col justify-between h-full"
              >
                <div>
                  <div className="text-base md:text-2xl font-bold text-white !mb-1 md:!mb-4 leading-tight tracking-tight">Discovery Engine</div>
                  <div className="text-zinc-300 text-[11px] md:text-lg mb-3 md:mb-6 leading-snug">
                    Not sure where to go? Tell us your budget and vibe.
                  </div>
                </div>
                <div className="flex items-center text-white text-xs md:text-base font-bold group-hover:translate-x-1 md:group-hover:translate-x-2 transition-transform">
                  Explore <ArrowRight className="ml-1 w-3 h-3 md:w-5 md:h-5" />
                </div>
              </div>

              {/* Card 2: Direct Planning Mode */}
              <div 
                onClick={() => handleNavigation('/plan/setup')}
                className="bg-blue-600 border border-blue-500 p-4 md:p-10 min-h-[110px] md:min-h-[240px] rounded-[1.25rem] md:rounded-3xl cursor-pointer hover:bg-blue-500 transition-all duration-300 md:hover:scale-105 group shadow-[0_0_30px_-10px_rgba(37,99,235,0.5)] md:shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_0_60px_-15px_rgba(37,99,235,0.7)] flex flex-col justify-between h-full"
              >
                <div>
                  <div className="text-base md:text-2xl font-bold text-white !mb-1 md:!mb-4 leading-tight tracking-tight">Plan Itinerary</div>
                  <div className="text-blue-100 text-[11px] md:text-lg mb-3 md:mb-6 leading-snug">
                    Know your destination? We'll lock down the logistics.
                  </div>
                </div>
                <div className="flex items-center text-white text-xs md:text-base font-bold group-hover:translate-x-1 md:group-hover:translate-x-2 transition-transform">
                  Start <ArrowRight className="ml-1 w-3 h-3 md:w-5 md:h-5" />
                </div>
              </div>              {/* Card 3: Hangout Mode */}
              <div 
                onClick={() => handleNavigation('/quick-trip')}
                className="bg-[#1a1a1a] border border-[#333] p-4 md:p-10 min-h-[110px] md:min-h-[240px] rounded-[1.25rem] md:rounded-3xl cursor-pointer hover:bg-[#222] transition-all duration-300 md:hover:scale-105 group shadow-2xl flex flex-col justify-between h-full"
              >
                <div>
                  <div className="text-base md:text-2xl font-bold text-white !mb-1 md:!mb-4 leading-tight tracking-tight">Hangout Mode</div>
                  <div className="text-zinc-400 text-[11px] md:text-lg mb-3 md:mb-6 leading-snug">
                    Short on time? Let's plan a spontaneous getaway.
                  </div>
                </div>
                <div className="flex items-center text-white text-xs md:text-base font-bold group-hover:translate-x-1 md:group-hover:translate-x-2 transition-transform">
                  Go <ArrowRight className="ml-1 w-3 h-3 md:w-5 md:h-5" />
                </div>
              </div>
            </div>

            {/* Footer Links */}
            <div className="mt-16 mb-8 flex gap-8 text-sm text-white/60 font-medium relative z-10">
              <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            </div>

          </div>
        </div>
      </div>
      
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  );
}
