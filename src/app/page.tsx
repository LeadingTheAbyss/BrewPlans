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
import { ArrowRight, Sparkles, Search, Globe, ChevronDown, Train, Map, Menu, X, MessageSquare, Plane, Navigation, Clock, Cloud, Activity } from 'lucide-react';
import { ContrailCanvas } from '@/components/ContrailCanvas';

const TOURIST_ATTRACTIONS = [
  'Taj Mahal, Agra', 
  'Hawa Mahal, Jaipur', 
  'Mysore Palace', 
  'Golden Temple, Amritsar', 
  'Gateway of India', 
  'Victoria Memorial, Kolkata', 
  'Pangong Lake, Ladakh', 
  'Munnar Tea Gardens', 
  'Meenakshi Temple, Madurai', 
  'Qutub Minar, Delhi', 
  'Amer Fort, Jaipur', 
  'Varanasi Ghats'
];

export default function LandingPage() {
  const router = useRouter();
  const { user, fetchUser } = useAuthStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  // Lazy initializer runs synchronously on first render — prevents ContrailCanvas flashing on mobile
  const [isMobileDevice] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [bgImages, setBgImages] = useState<string[]>([
    '/landing_1.png', 
    '/landing_2.png', 
    '/landing_3.png', 
    '/landing_4.jpg', 
    '/landing_5.jpg'
  ]);

  useEffect(() => {
    const mobile = window.innerWidth < 768;
    const imgWidth = mobile ? 800 : 1920;
    const shuffled = [...TOURIST_ATTRACTIONS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5);
    setBgImages(selected.map(place => `/api/destination-photo?name=${encodeURIComponent(place)}&type=place&redirect=true&width=${imgWidth}`));
  }, []);



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

    const isMobile = window.innerWidth < 768;

    let mouseMoveScheduled = false;
    let lastMouseX = 0;
    const handleMouseMove = (e: MouseEvent) => {
      lastMouseX = e.clientX;
      if (!mouseMoveScheduled) {
        mouseMoveScheduled = true;
        requestAnimationFrame(() => {
          const xPos = (lastMouseX / window.innerWidth - 0.5) * -100; 
          gsap.to('.clouds', {
            x: xPos,
            duration: 1.5,
            ease: 'power2.out'
          });
          mouseMoveScheduled = false;
        });
      }
    };
    // No mouse events on touch devices
    if (!isMobile) {
      window.addEventListener('mousemove', handleMouseMove);
    }



    let mounted = true;
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
      
      currentPlaneX: number = 50;
      currentPlaneY: number = 50;
      currentPlaneVx: number = 0;
      currentPlaneVy: number = 0;
      planeSpeed: number = 0;
      
      tailOffset: THREE.Vector3 = new THREE.Vector3(10, 0, 0);
      noseOffset: THREE.Vector3 = new THREE.Vector3(-10, 0, 0);
      e1Offset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
      e2Offset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

      constructor(model: THREE.Group) {
        // On mobile, only one view needed — wireframe view is disabled
        const isMobile = window.innerWidth < 768;
        this.views = isMobile
          ? [{ bottom: 0, height: 1 }]
          : [{ bottom: 0, height: 1 }, { bottom: 0, height: 0 }];

        this.renderer = new THREE.WebGLRenderer({
          antialias: !isMobile, // Antialias is expensive on mobile GPUs
          alpha: true,
          canvas: canvasRef.current!
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = false;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
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

        // Contrails are now handled by ContrailSVG in 2D space

        this.onResize();
        window.addEventListener('resize', this.onResize, false);

        this.modelGroup = new THREE.Group();
        model.layers.set(0);
        this.modelGroup.add(model);

        // EdgesGeometry (wireframe) is expensive — skip on mobile
        if (!isMobile) {
          const edges = new THREE.EdgesGeometry((model.children[0] as THREE.Mesh).geometry);
          const line = new THREE.LineSegments(edges);
          (line.material as THREE.LineBasicMaterial).depthTest = false;
          (line.material as THREE.LineBasicMaterial).opacity = 0.5;
          (line.material as THREE.LineBasicMaterial).transparent = true;
          line.position.set(0.5, 0.2, -1);
          line.layers.set(1);
          this.modelGroup.add(line);
        }
        this.scene.add(this.modelGroup);
        
        // Compute precise tail and nose local coordinates based on the model's bounding box
        const box = new THREE.Box3().setFromObject(this.modelGroup);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // APU / Tail exhaust is at the very back (-Z), centered on X, slightly above vertical center
        this.tailOffset = new THREE.Vector3(center.x, box.min.y + size.y * 0.45, box.min.z + size.z * 0.05);
        // Nose tip
        this.noseOffset = new THREE.Vector3(center.x, box.min.y + size.y * 0.4, box.max.z);
        // Engines (approximate positions on wings)
        this.e1Offset = new THREE.Vector3(center.x - size.x * 0.25, box.min.y + size.y * 0.4, box.min.z + size.z * 0.45);
        this.e2Offset = new THREE.Vector3(center.x + size.x * 0.25, box.min.y + size.y * 0.4, box.min.z + size.z * 0.45);
      }

      render = () => {
        let screenX = 50;
        let screenY = 50;

        if (this.modelGroup && this.views[0].camera) {
          const planeWorldPos = new THREE.Vector3();
          this.modelGroup.getWorldPosition(planeWorldPos);
          
          const tailWorldPos = this.tailOffset.clone().applyMatrix4(this.modelGroup.matrixWorld);
          const noseWorldPos = this.noseOffset.clone().applyMatrix4(this.modelGroup.matrixWorld);

          const vectorCenter = planeWorldPos.clone();
          vectorCenter.project(this.views[0].camera);

          const vectorTail = tailWorldPos.clone();
          vectorTail.project(this.views[0].camera);

          const vectorNose = noseWorldPos.clone();
          vectorNose.project(this.views[0].camera);
          
          const vectorE1 = this.e1Offset.clone().applyMatrix4(this.modelGroup.matrixWorld);
          vectorE1.project(this.views[0].camera);
          
          const vectorE2 = this.e2Offset.clone().applyMatrix4(this.modelGroup.matrixWorld);
          vectorE2.project(this.views[0].camera);

          screenX = (vectorCenter.x * 0.5 + 0.5) * 100;
          screenY = (-(vectorCenter.y * 0.5) + 0.5) * 100;
          
          const e1X = (vectorE1.x * 0.5 + 0.5) * 100;
          const e1Y = (-(vectorE1.y * 0.5) + 0.5) * 100;
          
          const e2X = (vectorE2.x * 0.5 + 0.5) * 100;
          const e2Y = (-(vectorE2.y * 0.5) + 0.5) * 100;
          
          document.documentElement.style.setProperty('--e1-x', `${e1X}%`);
          document.documentElement.style.setProperty('--e1-y', `${e1Y}%`);
          document.documentElement.style.setProperty('--e2-x', `${e2X}%`);
          document.documentElement.style.setProperty('--e2-y', `${e2Y}%`);
        }

        // Calculate velocity before applying inertia
        const vx = screenX - this.currentPlaneX;
        const vy = screenY - this.currentPlaneY;
        
        // Apply smooth inertia to coordinates
        this.currentPlaneX += vx * 0.08;
        this.currentPlaneY += vy * 0.08;
        
        // Smooth velocity
        this.currentPlaneVx += (vx - this.currentPlaneVx) * 0.1;
        this.currentPlaneVy += (vy - this.currentPlaneVy) * 0.1;
        
        // Calculate speed magnitude
        this.planeSpeed = Math.sqrt(this.currentPlaneVx**2 + this.currentPlaneVy**2);
        
        // Update CSS Variables
        document.documentElement.style.setProperty('--plane-x', `${this.currentPlaneX}%`);
        document.documentElement.style.setProperty('--plane-y', `${this.currentPlaneY}%`);
        document.documentElement.style.setProperty('--plane-vx', `${this.currentPlaneVx}`);
        document.documentElement.style.setProperty('--plane-vy', `${this.currentPlaneVy}`);
        document.documentElement.style.setProperty('--plane-speed', `${this.planeSpeed}`);

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

      // Animate background layers using GPU-accelerated transforms
      // Skip parallax on mobile — compositing 5 large textures continuously kills mobile GPUs
      if (!isMobile) {
        gsap.set('.atmosphere-layer', { scale: 1.15 }); // Oversize slightly so we have room to move
        gsap.to('.atmosphere-layer', {
          yPercent: -8,
          ease: 'none',
          scrollTrigger: { trigger: ".content", scrub: 1, start: "top top", end: "bottom bottom" }
        });
      }

      gsap.fromTo('.silhouette-back', 
        { opacity: 0, y: "20vh" },
        {
          opacity: 0, // Kept invisible
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
          opacity: 0, // Kept invisible
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
        scrollTrigger: {
          trigger: ".content",
          scrub: 1, // Smooth interpolation! Eliminates lag and stutter from mouse wheels.
          start: "top top",
          end: "bottom bottom",
          onUpdate: (self) => {
            const p = self.progress;
            
            // Altitude: curve up, stay, curve down
            let alt = 0;
            if (p < 0.2) alt = (p / 0.2) * 36000;
            else if (p > 0.8) alt = ((1 - p) / 0.2) * 36000;
            else alt = 36000 + Math.sin(p * 10) * 200;
            
            // Speed
            let speed = 0;
            if (p < 0.1) speed = (p / 0.1) * 520;
            else if (p > 0.9) speed = ((1 - p) / 0.1) * 520;
            else speed = 520 + Math.sin(p * 20) * 5;

            const elAlt = document.querySelector('.flight-stat-alt');
            if(elAlt) elAlt.textContent = `${Math.floor(Math.max(0, alt)).toLocaleString()} ft`;
            
            const elSpeed = document.querySelector('.flight-stat-speed');
            if(elSpeed) elSpeed.textContent = `${Math.floor(Math.max(0, speed))} mph`;

            const elEta = document.querySelector('.flight-stat-eta');
            if(elEta) {
               const totalMins = Math.floor((1 - p) * 120);
               const hrs = Math.floor(totalMins / 60).toString().padStart(2, '0');
               const mins = (totalMins % 60).toString().padStart(2, '0');
               elEta.textContent = `${hrs}:${mins}`;
            }

            const elWeather = document.querySelector('.flight-stat-weather');
            if(elWeather) {
               if(p < 0.2) elWeather.textContent = "Stormy";
               else if(p > 0.8) elWeather.textContent = "Foggy";
               else elWeather.textContent = "Clear Skies";
            }
          }
        },
        defaults: { duration: sectionDuration, ease: 'power2.inOut' }
      });

      let delay = 0;
      const xOffset = (isMobile ? 32 : 40) * m;

      // 1. Intro (Left text) -> Plane Right (or Left on mobile)
      tl.to('.scroll-cta', { duration: 0.25, opacity: 0 }, delay);
      tl.to(plane.position, { x: xOffset, ease: 'power1.in' }, delay);
      // Atmosphere transition 1 -> 2
      tl.to('.takeoff-layer', { autoAlpha: 0, ease: 'power1.inOut' }, delay + 0.5);
      tl.to('.altitude-layer', { autoAlpha: 1, ease: 'power1.inOut' }, delay + 0.5);

      delay += sectionDuration;
      // 2. "Destination" (Right text) -> Plane Left
      tl.to(plane.rotation, { x: tau * .25, y: 0, z: -tau * 0.05 * m, ease: 'power1.inOut' }, delay);
      tl.to(plane.position, { x: -xOffset, y: 0, z: -60, ease: 'power1.inOut' }, delay);

      delay += sectionDuration;
      // 3. "Complex" (Left text) -> Plane Right
      tl.to(plane.rotation, { x: tau * .25, y: 0, z: tau * 0.05 * m, ease: 'power3.inOut' }, delay);
      tl.to(plane.position, { x: xOffset, y: 0, z: -60, ease: 'power2.inOut' }, delay);
      // Atmosphere transition 2 -> 3
      tl.to('.altitude-layer', { autoAlpha: 0, ease: 'power1.inOut' }, delay + 0.5);
      tl.to('.nav-layer', { autoAlpha: 1, ease: 'power1.inOut' }, delay + 0.5);

      delay += sectionDuration;
      // 4. "Tabs" (Right text) -> Plane Left
      tl.to(plane.rotation, { x: tau * .2, y: 0, z: -tau * 0.1 * m, ease: 'power3.inOut' }, delay);
      tl.to(plane.position, { x: -xOffset, y: 0, z: -60, ease: 'power2.inOut' }, delay);

      delay += sectionDuration;
      // 5. "Logistics" (Left text) -> Plane Right
      tl.to(plane.rotation, { x: tau * .25, y: 0, z: tau * 0.05 * m, ease: 'power3.inOut' }, delay);
      tl.to(plane.position, { x: xOffset, y: 0, z: -30, ease: 'power2.inOut' }, delay);
      // Atmosphere transition 3 -> 4
      tl.to('.nav-layer', { autoAlpha: 0, ease: 'power1.inOut' }, delay + 0.5);
      tl.to('.descent-layer', { autoAlpha: 1, ease: 'power1.inOut' }, delay + 0.5);

      delay += sectionDuration;
      // 6. "Defying" (Right text) -> Plane Left
      tl.to(plane.rotation, { x: 0, z: 0, y: tau * .25 * m }, delay);
      tl.to(plane.position, { x: (isMobile ? -10 : -20) * m, y: -10, z: 50 }, delay);

      delay += sectionDuration;
      // 7. Sunset empty -> Fly away
      tl.to(plane.rotation, { x: tau * 0.15, y: tau * .85 * m, z: -tau * 0, ease: 'power1.in' }, delay);
      tl.to(plane.position, { z: -150, x: 0, y: 0, ease: 'power1.inOut' }, delay);
      // Atmosphere transition 4 -> 5
      tl.to('.descent-layer', { autoAlpha: 0, ease: 'power1.inOut' }, delay + 0.5);
      tl.to('.arrival-layer', { autoAlpha: 1, ease: 'power1.inOut' }, delay + 0.5);

      delay += sectionDuration;
      // 8. Sunset end -> Rotate outwards and fly away completely
      tl.to(plane.rotation, { duration: sectionDuration * 3, x: -tau * 0.05, y: tau * m, z: -tau * 0.1 * m, ease: 'power1.inOut' }, delay);
      // On mobile camera is at z:340 so push plane to z:500 to get it off-screen
      tl.to(plane.position, { duration: sectionDuration * 3, x: 0, y: isMobile ? 40 : 0, z: isMobile ? 500 : 320, ease: 'power1.in' }, delay);
      
      tl.to(scene.light.position, { duration: sectionDuration * 3, x: 0, y: 0, z: 0 }, delay);

      // Fade the entire WebGL canvas to zero once the plane has flown away
      // This ensures nothing bleeds through into the content sections below
      tl.to(canvasRef.current!, { autoAlpha: 0, duration: sectionDuration * 0.8, ease: 'power1.in' }, delay + sectionDuration * 2.5);

      // Start continuous render loop for live tracking and contrails
      let isVisible = true;
      let isIntersecting = true;
      
      const handleVisibilityChange = () => {
        isVisible = !document.hidden;
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      const observer = new IntersectionObserver((entries) => {
        isIntersecting = entries[0].isIntersecting;
      });
      const landingBody = document.querySelector('.landing-body');
      if (landingBody) observer.observe(landingBody);

      const renderLoop = () => {
        if (!mounted) {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          observer.disconnect();
          return;
        }
        if (isVisible && isIntersecting) {
          scene.render();
        }
        requestAnimationFrame(renderLoop);
      };
      renderLoop();
    }

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

    // Lightweight window function for mobile — 12 raycasts, MeshBasicMaterial (zero lighting cost)
    function addMobileWindows(planeGroup: THREE.Group, planeMesh: THREE.Mesh) {
      const box = new THREE.Box3().setFromObject(planeMesh);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const raycaster = new THREE.Raycaster();

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

      const windowRadius = Math.max(size.x, size.z) * 0.0075;
      // MeshBasicMaterial: no lighting calculation at all — cheapest possible material
      const windowMat = new THREE.MeshBasicMaterial({ color: 0x111122 });
      // Lower-segment circle (8 segments vs 16) — half the vertex count
      const windowGeo = new THREE.CylinderGeometry(windowRadius, windowRadius, 0.5, 8);
      windowGeo.rotateX(Math.PI / 2);

      const numWindows = 12; // 12 instead of 28 — only 24 raycasts total (vs 56)
      const startZ = box.min.z + size.z * 0.24;
      const endZ = box.max.z - size.z * 0.14;
      const winY = box.min.y + size.y * 0.35;

      for (let i = 0; i < numWindows; i++) {
        const z = startZ + (endZ - startZ) * (i / (numWindows - 1));
        [true, false].forEach(fromRight => {
          const hit = raycastSide(z, winY, fromRight);
          if (hit) {
            const m = new THREE.Mesh(windowGeo, windowMat);
            m.position.copy(hit.point);
            m.position.addScaledVector(hit.face!.normal, 0.08);
            m.lookAt(hit.point.clone().add(hit.face!.normal));
            planeGroup.add(m);
          }
        });
      }
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
          // MeshPhysicalMaterial requires a double shading pass for clearcoat — too expensive on mobile
          const isMobile = window.innerWidth < 768;
          const mat = isMobile
            ? new THREE.MeshStandardMaterial({ color: 0xf4f4f5, metalness: 0.2, roughness: 0.3, vertexColors: true })
            : new THREE.MeshPhysicalMaterial({ color: 0xf4f4f5, metalness: 0.2, roughness: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.1, flatShading: false, vertexColors: true });
          planeMesh.material = mat;
        }
      });

      // Desktop: full 56-raycast, MeshPhysicalMaterial windows
      // Mobile: lightweight 24-raycast, MeshBasicMaterial windows only
      const isMobileForWindows = window.innerWidth < 768;
      if (planeMesh) {
        try {
          if (isMobileForWindows) {
            addMobileWindows(loadedObject, planeMesh);
          } else {
            addWindows(loadedObject, planeMesh);
          }
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
      if (!isMobile) window.removeEventListener('mousemove', handleMouseMove);
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
      {/* ContrailCanvas is a continuous 2D canvas draw loop — too expensive on mobile */}
      {!isMobileDevice && <ContrailCanvas />}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-30" />
      
      <div className="cinematic-bg">
        <div className="cinematic-bg-noise"></div>
        
        {/* Stage 1: TAKEOFF */}
        <div 
          className="atmosphere-layer atmosphere-takeoff takeoff-layer" 
          style={{ backgroundImage: `url('${bgImages[0]}')`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}
        ></div>

        {/* Stage 2: HIGH ALTITUDE */}
        <div 
          className="atmosphere-layer atmosphere-altitude altitude-layer" 
          style={{ backgroundImage: `url('${bgImages[1]}')`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}
        >
          <div className="interactive-stars"></div>
        </div>

        {/* Stage 3: GLOBAL NAVIGATION */}
        <div 
          className="atmosphere-layer atmosphere-nav nav-layer"
          style={{ backgroundImage: `url('${bgImages[2]}')`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}
        >
        </div>

        {/* Stage 4: GOLDEN HOUR DESCENT */}
        <div 
          className="atmosphere-layer atmosphere-descent descent-layer"
          style={{ backgroundImage: `url('${bgImages[3]}')`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}
        ></div>

        {/* Stage 5: ARRIVAL */}
        <div 
          className="atmosphere-layer atmosphere-arrival arrival-layer"
          style={{ 
            backgroundImage: `url('${bgImages[4]}')`, 
            backgroundSize: 'cover', 
            backgroundPosition: 'center 20%',
            backgroundRepeat: 'no-repeat'
          }}
        >
        </div>
        
        {/* Global Vignette Overlay for Text Readability */}
        <div className="fixed inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 z-0 pointer-events-none"></div>
      </div>
      

      <nav className="absolute top-0 left-0 w-full z-[100] flex items-center justify-between px-6 py-4 bg-[#282828] border-b border-[#3e3e3e] text-white font-sans transition-all duration-300">
        
        {/* Left: Logos and Links */}
        <div className="flex items-center gap-6">
          {/* Main Logo */}
          <div className="flex items-center gap-2 md:gap-4 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="hidden md:block relative w-28 h-10 flex-shrink-0">
              <img 
                src="/large_logo_2.png" 
                alt="BrewPlans Logo" 
                className="absolute -top-3 -left-2 h-16 w-auto max-w-none object-contain" 
              />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-white drop-shadow-md z-10 relative">BrewPlans</span>
          </div>

          {/* Links */}
          <div className="hidden lg:flex items-center gap-7 lg:gap-8 ml-8 xl:ml-14">
            <button 
              onClick={() => router.push('/blog')} 
              className="text-base tracking-wide font-bold bg-gradient-to-r from-[#FF8A3D] to-[#FFD166] bg-clip-text text-transparent hover:scale-105 transition-all flex items-center gap-1.5 drop-shadow"
            >
              Discover Blogs & Videos
            </button>
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
                className="h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all flex items-center gap-2 text-white shrink-0"
                title="Send us Feedback"
              >
                <MessageSquare size={14} />
                <span className="hidden sm:inline-block text-xs font-bold uppercase tracking-widest">Send Us Feedback</span>
              </button>
              <button 
                onClick={() => router.push('/u/1')}
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
            onClick={() => { setMobileMenuOpen(false); router.push('/blog'); }} 
            className="text-lg tracking-wide font-bold bg-gradient-to-r from-[#FF8A3D] to-[#FFD166] bg-clip-text text-transparent hover:opacity-80 text-left transition-all"
          >
            Discover Blogs & Videos
          </button>
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

      <div className="content relative z-10">
        <div className="loading">Loading Engine...</div>
        <div className="trigger"></div>
        <div className="ground-container">
          <div className="parallax ground hidden"></div>
          
          <div className="section relative z-50 max-md:!px-6 max-md:!w-full max-md:!mx-0">
            <div className="pt-[8vh] md:pt-[12vh] max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">
              <h1 className="font-black text-6xl md:text-7xl lg:text-8xl tracking-tighter leading-[1] text-white mb-6 drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
                We plan the trip.<br/>
                <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-md">You pack your bags.</span>
              </h1>
            </div>

            <div className="scroll-cta absolute bottom-[10vh] left-6 md:left-0 flex flex-col items-start gap-3">
              <span className="font-bold text-[10px] md:text-xs tracking-[0.2em] uppercase text-white/60">Scroll to explore</span>
              <div className="w-[2px] h-12 md:h-16 bg-gradient-to-b from-white/50 to-transparent ml-1"></div>
            </div>
          </div>
          
          <div className="section right relative z-50">
            <div className="inline-block max-w-[500px] backdrop-blur-xl bg-black/40 p-6 md:p-8 rounded-3xl border border-white/10 shadow-xl text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight text-balance">Trip planning shouldn't feel like a part-time job.</h2>
            </div>
          </div>

          <div className="section relative z-50">
            <div className="inline-block max-w-[500px] backdrop-blur-xl bg-black/40 p-6 md:p-8 rounded-3xl border border-white/10 shadow-xl text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight text-balance">Leave the details to us.</h2>
              <p className="text-lg md:text-xl text-white/80 font-medium mt-3 text-balance">No tabs. No spreadsheets. No back-and-forth over budgets.</p>
            </div>
          </div>

          <div className="section right relative z-50">
            <div className="inline-block max-w-[500px] backdrop-blur-xl bg-black/40 p-6 md:p-8 rounded-3xl border border-white/10 shadow-xl text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight text-balance">We find the way there.</h2>
              <p className="text-lg md:text-xl text-white/80 font-medium mt-3 text-balance">Flights, trains, and buses, quietly compared until only the best remains.</p>
            </div>
          </div>

          <div className="section relative z-50">
            <div className="inline-block max-w-[500px] backdrop-blur-xl bg-black/40 p-6 md:p-8 rounded-3xl border border-white/10 shadow-xl text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight text-balance">Your whole trip, stitched together.</h2>
              <p className="text-lg md:text-xl text-white/80 font-medium mt-3 text-balance">Stays, experiences, and timing, all laid out in one clean plan.</p>
            </div>
          </div>
          
          <div className="section right relative z-50">
            <div className="inline-block max-w-[500px] backdrop-blur-xl bg-black/40 p-6 md:p-8 rounded-3xl border border-white/10 shadow-xl text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight text-balance">Less planning. More going.</h2>
              <p className="text-lg md:text-xl text-white/80 font-medium mt-3 text-balance">Stop juggling logistics. Start the trip.</p>
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
          <div className="silhouette-back hidden opacity-0"></div>
          <div className="silhouette-front hidden opacity-0"></div>
          <div className="section"></div>
          <div className="section end flex flex-col items-center justify-center pt-24 md:pt-32 pb-12 text-white !w-full !px-3 md:!px-10 relative z-10" style={{ height: 'auto', minHeight: '100vh' }}>
            <h2 className="mb-8 md:mb-12 drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)] text-white">Let's go.</h2>
            
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
            <div className="mt-16 mb-6 flex flex-wrap gap-4 justify-center relative z-10">
              <a href="/terms" className="px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm text-white text-sm font-semibold border border-white/30 hover:bg-black/80 hover:border-white/60 hover:scale-105 transition-all duration-200">Terms of Service</a>
              <a href="/privacy" className="px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm text-white text-sm font-semibold border border-white/30 hover:bg-black/80 hover:border-white/60 hover:scale-105 transition-all duration-200">Privacy Policy</a>
              <a href="mailto:support@brewplans.com" className="px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm text-white text-sm font-semibold border border-white/30 hover:bg-black/80 hover:border-white/60 hover:scale-105 transition-all duration-200">Contact Us : support@brewplans.com</a>
            </div>

            {/* Social Links */}
            <div className="mb-12 flex flex-wrap items-center justify-center gap-3 relative z-10 text-white">
              <a 
                href="https://instagram.com/brewplansdotcom" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm hover:bg-[#FF8A3D] hover:border-[#FF8A3D] border border-white/30 flex items-center justify-center transition-all shadow-xs" 
                title="Instagram: @brewplansdotcom"
              >
                <svg className="w-4 h-4 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              <a 
                href="https://x.com/BrewPlans" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm hover:bg-[#FF8A3D] hover:border-[#FF8A3D] border border-white/30 flex items-center justify-center transition-all shadow-xs" 
                title="X (Twitter): @BrewPlans"
              >
                <svg className="w-4 h-4 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
              </a>
              <a 
                href="https://facebook.com/BrewPlans" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm hover:bg-[#FF8A3D] hover:border-[#FF8A3D] border border-white/30 flex items-center justify-center transition-all shadow-xs" 
                title="Facebook: BrewPlans"
              >
                <svg className="w-4 h-4 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a 
                href="mailto:support@brewplans.com" 
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm hover:bg-[#FF8A3D] hover:border-[#FF8A3D] border border-white/30 flex items-center justify-center transition-all shadow-xs" 
                title="Email: support@brewplans.com"
              >
                <svg className="w-4 h-4 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </a>
              <a 
                href="#" 
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm hover:bg-[#FF8A3D] hover:border-[#FF8A3D] border border-white/30 flex items-center justify-center transition-all shadow-xs" 
                title="YouTube (Link coming soon)"
              >
                <svg className="w-4 h-4 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3v6Z"/></svg>
              </a>
            </div>

          </div>
        </div>
      </div>
      
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  );
}
