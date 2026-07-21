'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WrappedPage() {
  const router = useRouter();
  const total = 8;
  const [current, setCurrent] = useState(1);
  const [showToast, setShowToast] = useState(false);

  const cities = ["Jaipur","Udaipur","Goa","Manali","Rishikesh","Pondicherry","Munnar","Varanasi","Leh"];
  const foods = ["Rajasthani Thali","Goan Seafood","Kashmiri Wazwan","Street Chaat","Filter Coffee","Momos","Butter Chicken","Kerala Sadya"];
  const buddies = [["Apoorv",4],["Meera",3],["Rohan",2],["Simran",2],["Kabir",1]];

  const handleNext = () => {
    if(current < total) setCurrent(c => c + 1);
  };

  const handlePrev = () => {
    if(current > 1) setCurrent(c => c - 1);
  };

  const triggerToast = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 1800);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        :root{
          --ink:#0A0E27;
          --ink2:#121A3F;
          --ink3:#1B2657;
          --gold:#F5B942;
          --pink:#FF3D7F;
          --mint:#37E8C4;
          --cream:#F7F3EC;
          --muted:rgba(247,243,236,0.58);
          --line:rgba(247,243,236,0.14);
        }
        .wrapped-body {
          height: 100vh;
          background:#05061A;
          background-image:
            radial-gradient(ellipse 900px 600px at 15% 10%, rgba(245,185,66,0.10), transparent 60%),
            radial-gradient(ellipse 900px 700px at 90% 90%, rgba(255,61,127,0.10), transparent 60%);
          font-family:'Inter',sans-serif;
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
        }
        .stage{
          display:flex;
          flex-direction:column;
          align-items:center;
          gap:18px;
        }
        .hint{
          font-family: monospace;
          font-size:11px;
          letter-spacing:0.14em;
          text-transform:uppercase;
          color:rgba(247,243,236,0.35);
        }
        .hint b{color:rgba(247,243,236,0.6); font-weight:600;}

        /* phone frame */
        .phone{
          position:relative;
          width:390px;
          height:844px;
          max-height:92vh;
          aspect-ratio:390/844;
          border-radius:44px;
          padding:12px;
          background:linear-gradient(155deg,#1c2350,#05061a 60%);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.06),
            0 40px 90px -20px rgba(0,0,0,0.75),
            0 0 120px -30px rgba(245,185,66,0.15);
        }
        .notch{
          position:absolute;
          top:12px; left:50%; transform:translateX(-50%);
          width:110px; height:26px;
          background:#05061A;
          border-radius:0 0 16px 16px;
          z-index:50;
        }
        .screen-frame{
          position:relative;
          width:100%; height:100%;
          border-radius:34px;
          overflow:hidden;
          background:var(--ink);
          isolation:isolate;
        }

        /* ambient moving blobs */
        .ambient{position:absolute; inset:0; z-index:0; overflow:hidden;}
        .blob{position:absolute; border-radius:50%; filter:blur(60px); opacity:0.35; animation:drift 18s ease-in-out infinite;}
        .blob.b1{width:260px;height:260px; background:var(--gold); top:-60px; left:-60px;}
        .blob.b2{width:280px;height:280px; background:var(--pink); bottom:-80px; right:-60px; animation-delay:-6s;}
        .blob.b3{width:220px;height:220px; background:var(--mint); bottom:20%; left:-80px; animation-delay:-11s;}
        @keyframes drift{
          0%,100%{transform:translate(0,0) scale(1);}
          50%{transform:translate(30px,-20px) scale(1.15);}
        }

        /* progress bar */
        .progress{
          position:absolute; top:22px; left:16px; right:16px;
          display:flex; gap:5px; z-index:40;
        }
        .progress .seg{
          flex:1; height:3px; border-radius:3px;
          background:rgba(247,243,236,0.22);
          overflow:hidden;
        }
        .progress .seg i{
          display:block; height:100%; width:0%;
          background:var(--cream);
          border-radius:3px;
          transition:width .25s linear;
        }
        .progress .seg.done i{width:100%;}

        .brandbar{
          position:absolute; top:40px; left:20px; right:20px;
          display:flex; align-items:center; justify-content:space-between;
          z-index:40;
        }
        .brandbar .logo{
          font-family: monospace;
          font-size:12px; letter-spacing:0.08em;
          color:var(--cream); font-weight:600;
          display:flex; align-items:center; gap:6px;
        }
        .brandbar .logo::before{content:"✈"; color:var(--gold); font-size:12px;}
        .brandbar .pnr{
          font-family: monospace;
          font-size:10px; color:rgba(247,243,236,0.4); letter-spacing:0.08em;
        }

        /* tap zones */
        .tapzone{position:absolute; top:0; bottom:0; width:50%; z-index:35; cursor:pointer; -webkit-tap-highlight-color: transparent;}
        .tapzone.left{left:0;} .tapzone.right{right:0;}

        /* screens */
        .screens{position:absolute; inset:0; z-index:5;}
        .screen{
          position:absolute; inset:0;
          display:none;
          flex-direction:column;
          padding:100px 26px 40px;
          z-index:6;
        }
        .screen.active{display:flex;}

        .eyebrow{
          font-family: monospace;
          font-size:11px; letter-spacing:0.16em; text-transform:uppercase;
          color:var(--gold);
          display:flex; align-items:center; gap:8px;
          margin-bottom:14px;
          opacity:0; transform:translateY(8px);
          animation:riseIn .5s .05s forwards ease-out;
        }
        .eyebrow::before{content:""; width:16px; height:1px; background:var(--gold);}

        .display{
          font-family:'Bricolage Grotesque', sans-serif;
          color:var(--cream);
          font-weight:700;
          line-height:1.02;
          letter-spacing:-0.01em;
        }
        .subcopy{
          font-family:'Inter',sans-serif;
          color:var(--muted);
          font-size:15px;
          line-height:1.55;
          margin-top:14px;
          max-width:300px;
          opacity:0; transform:translateY(8px);
          animation:riseIn .5s .2s forwards ease-out;
        }
        @keyframes riseIn{ to{opacity:1; transform:translateY(0);} }
        @keyframes countRise{ from{opacity:0; transform:translateY(16px);} to{opacity:1; transform:translateY(0);} }

        .ticket-tag{
          font-family: monospace;
          font-size:10.5px;
          letter-spacing:0.06em;
          color:var(--ink);
          background:var(--cream);
          padding:5px 10px;
          border-radius:100px;
          display:inline-flex;
          align-items:center;
          gap:6px;
          font-weight:600;
        }

        .dashed-divider{
          width:100%; height:0; border-top:1.5px dashed var(--line);
          margin:22px 0;
        }

        /* screen 1: intro */
        #s1{justify-content:center; align-items:flex-start; padding-top:0;}
        #s1 .wordmark{
          font-family: monospace;
          font-size:13px; letter-spacing:0.2em; color:var(--muted); margin-bottom:26px;
        }
        #s1 .display{font-size:56px;}
        #s1 .display span{color:var(--gold);}
        #s1 .cta{
          margin-top:40px;
          display:flex; align-items:center; gap:10px;
          font-family: monospace;
          font-size:12px; letter-spacing:0.1em; text-transform:uppercase;
          color:var(--cream);
        }
        #s1 .cta .arrow{
          width:34px; height:34px; border-radius:50%;
          border:1px solid var(--line);
          display:flex; align-items:center; justify-content:center;
          animation:pulseArrow 1.6s ease-in-out infinite;
        }
        @keyframes pulseArrow{0%,100%{transform:translateX(0);}50%{transform:translateX(5px);}}

        /* stat number */
        .statnum{
          font-family:'Bricolage Grotesque', sans-serif;
          font-weight:800;
          font-size:104px;
          line-height:0.92;
          letter-spacing:-0.02em;
          background:linear-gradient(180deg, var(--cream), rgba(247,243,236,0.75));
          -webkit-background-clip:text; background-clip:text; color:transparent;
          margin-top:6px;
        }
        .statunit{
          font-family: monospace;
          font-size:14px; color:var(--muted); letter-spacing:0.08em; text-transform:uppercase;
          margin-top:6px;
        }
        .accentline{width:44px; height:4px; border-radius:4px; margin-top:22px;}

        /* chips (screen 2) */
        .chiprow{display:flex; flex-wrap:wrap; gap:8px; margin-top:22px;}
        .citychip{
          font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600;
          color:var(--cream);
          background:rgba(247,243,236,0.06);
          border:1px solid var(--line);
          padding:7px 12px; border-radius:100px;
          opacity:0; transform:translateY(6px);
          animation:countRise .4s forwards ease-out;
        }

        /* screen 3 distance / route viz */
        .routeviz{
          margin-top:26px; width:100%; height:70px; position:relative;
        }
        .routeviz svg{width:100%; height:100%; overflow:visible;}
        .routeviz .path{
          fill:none; stroke:var(--mint); stroke-width:2; stroke-dasharray:6 8;
          stroke-linecap:round;
          animation:dashmove 1.4s linear infinite;
        }
        @keyframes dashmove{ to{ stroke-dashoffset:-28; } }
        .routeviz .dot{fill:var(--cream);}
        .equivbox{
          margin-top:20px;
          border:1px solid var(--line);
          border-radius:16px;
          padding:14px 16px;
          background:rgba(247,243,236,0.04);
        }
        .equivbox .lbl{font-family: monospace; font-size:10px; color:var(--mint); letter-spacing:0.1em; text-transform:uppercase; margin-bottom:6px;}
        .equivbox .txt{font-size:13.5px; color:var(--cream); line-height:1.5;}

        /* screen 5 foodie tag cloud */
        .tagcloud{display:flex; flex-wrap:wrap; gap:9px; margin-top:22px;}
        .foodtag{
          font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600;
          color:var(--ink); background:var(--gold);
          padding:7px 13px; border-radius:100px;
          opacity:0; transform:scale(0.85);
          animation:popIn .4s forwards ease-out;
        }
        @keyframes popIn{ to{opacity:1; transform:scale(1);} }

        /* screen 6: map */
        .mapwrap{
          margin-top:16px; position:relative; flex:1;
          display:flex; align-items:center; justify-content:center;
        }
        .mapwrap svg{width:100%; height:auto; max-height:100%;}
        .india-shape{fill:rgba(247,243,236,0.05); stroke:rgba(247,243,236,0.25); stroke-width:1.4; stroke-linejoin:round;}
        .route-arc{
          fill:none; stroke:url(#arcgrad); stroke-width:1.6;
          stroke-dasharray:6 6;
          animation:dashmove 1.2s linear infinite;
          opacity:0.9;
        }
        .city-dot{fill:var(--gold); stroke:var(--ink); stroke-width:2;}
        .city-pulse{fill:none; stroke:var(--gold); stroke-width:1.5; opacity:0.6; animation:pulseRing 2.2s ease-out infinite;}
        @keyframes pulseRing{
          0%{ r:5; opacity:0.7; }
          100%{ r:16; opacity:0; }
        }
        .city-label{font-family: monospace; font-size:8.5px; fill:var(--cream); letter-spacing:0.02em;}

        /* screen 7 buddies */
        .buddy-count-row{display:flex; align-items:baseline; gap:10px; margin-top:2px;}
        .reveal-card{
          margin-top:18px;
          border:1px solid rgba(255,61,127,0.35);
          background:linear-gradient(160deg, rgba(255,61,127,0.14), rgba(255,61,127,0.02));
          border-radius:20px;
          padding:22px 20px;
          text-align:center;
        }
        .reveal-card .lbl{font-family: monospace; font-size:10.5px; letter-spacing:0.14em; text-transform:uppercase; color:var(--pink);}
        .avatar-ring{
          width:76px; height:76px; border-radius:50%; margin:16px auto 12px;
          background:linear-gradient(135deg,var(--pink),var(--gold));
          display:flex; align-items:center; justify-content:center;
          font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:26px; color:var(--ink);
        }
        .reveal-card .name{font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:30px; color:var(--cream);}
        .reveal-card .meta{font-family: monospace; font-size:11px; color:var(--muted); margin-top:6px; letter-spacing:0.05em;}
        .buddy-bars{margin-top:20px; display:flex; flex-direction:column; gap:9px;}
        .buddy-bar-row{display:flex; align-items:center; gap:10px;}
        .buddy-bar-row .bname{width:58px; font-family:'Inter',sans-serif; font-size:11.5px; color:var(--muted); font-weight:600; flex-shrink:0;}
        .buddy-bar-track{flex:1; height:8px; border-radius:6px; background:rgba(247,243,236,0.08); overflow:hidden;}
        .buddy-bar-fill{height:100%; border-radius:6px; width:0%; background:linear-gradient(90deg,var(--pink),var(--gold)); transition:width 1s cubic-bezier(.2,.9,.3,1);}
        .buddy-bar-row .bnum{font-family: monospace; font-size:11px; color:var(--cream); width:16px; text-align:right;}

        /* screen 8 final ticket */
        #s8{padding:70px 20px 30px; align-items:center;}
        .ticket{
          width:100%;
          background:linear-gradient(165deg,#151B44,#0A0E27);
          border:1px solid rgba(247,243,236,0.12);
          border-radius:22px;
          padding:22px 20px 0;
          position:relative;
          box-shadow:0 20px 60px -20px rgba(0,0,0,0.6);
        }
        .ticket-top{display:flex; justify-content:space-between; align-items:flex-start;}
        .ticket-top .tlogo{font-family: monospace; font-weight:700; font-size:13px; color:var(--cream); letter-spacing:0.06em;}
        .ticket-top .tlogo span{color:var(--gold);}
        .ticket-top .tyear{font-family: monospace; font-size:11px; color:var(--muted);}
        .ticket-headline{font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:26px; color:var(--cream); margin-top:16px; line-height:1.05;}
        .ticket-grid{
          display:grid; grid-template-columns:1fr 1fr; gap:14px 10px;
          margin-top:20px;
        }
        .ticket-stat .k{font-family: monospace; font-size:9.5px; letter-spacing:0.1em; text-transform:uppercase; color:var(--muted);}
        .ticket-stat .v{font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:22px; color:var(--cream); margin-top:2px;}
        .ticket-stat .v.gold{color:var(--gold);}
        .ticket-stat .v.pink{color:var(--pink);}
        .ticket-stat .v.mint{color:var(--mint);}
        .perforation{
          position:relative; margin-top:22px; height:1px;
          border-top:1.5px dashed rgba(247,243,236,0.25);
        }
        .perforation::before, .perforation::after{
          content:""; position:absolute; top:-9px; width:18px; height:18px; background:#05061A; border-radius:50%;
        }
        .perforation::before{left:-29px;}
        .perforation::after{right:-29px;}
        .ticket-bottom{display:flex; align-items:center; justify-content:space-between; padding:16px 0 20px;}
        .barcode{display:flex; gap:2px; align-items:flex-end; height:26px;}
        .barcode i{display:block; width:2px; background:rgba(247,243,236,0.5);}
        .ticket-bottom .code{font-family: monospace; font-size:10px; color:var(--muted); letter-spacing:0.08em;}

        .share-btn{
          margin-top:24px; width:100%;
          background:var(--gold); color:var(--ink);
          font-family:'Inter',sans-serif; font-weight:700; font-size:14.5px;
          border:none; border-radius:100px; padding:15px;
          display:flex; align-items:center; justify-content:center; gap:8px;
          cursor:pointer;
          transition:transform .15s ease;
        }
        .share-btn:active{transform:scale(0.97);}
        .share-sub{
          margin-top:12px; font-family: monospace; font-size:10.5px; color:rgba(247,243,236,0.35); letter-spacing:0.05em;
        }
        .toast{
          position:absolute; bottom:110px; left:50%; transform:translateX(-50%) translateY(10px);
          background:var(--cream); color:var(--ink);
          font-family:'Inter',sans-serif; font-weight:600; font-size:12.5px;
          padding:10px 18px; border-radius:100px;
          opacity:0; pointer-events:none; z-index:60;
          transition:all .3s ease;
          white-space:nowrap;
        }
        .toast.show{opacity:1; transform:translateX(-50%) translateY(0);}

        @media (max-height:780px){
          .phone{height:92vh;}
          .statnum{font-size:86px;}
          #s1 .display{font-size:46px;}
        }
      `}} />
      <div className="wrapped-body relative">
        <button 
          onClick={() => router.push('/profile')} 
          className="absolute top-8 left-8 text-white/50 hover:text-white z-50 text-sm flex items-center gap-2 tracking-widest uppercase font-bold"
        >
          &larr; Back
        </button>

        <div className="stage">
          <div className="phone">
            <div className="notch"></div>
            <div className="screen-frame">
              <div className="ambient">
                <div className="blob b1"></div><div className="blob b2"></div><div className="blob b3"></div>
              </div>

              <div className="progress" id="progress">
                {[...Array(total)].map((_, i) => (
                  <div key={i} className={`seg ${i + 1 <= current ? 'done' : ''}`}><i></i></div>
                ))}
              </div>
              
              <div className="brandbar">
                <div className="logo">PLANBRO</div>
                <div className="pnr" id="pnrlabel">SCREEN {current}/{total}</div>
              </div>

              <div className="tapzone left" onClick={handlePrev}></div>
              <div className="tapzone right" onClick={handleNext}></div>

              <div className="screens">

                {/* 1 INTRO */}
                <div className={`screen ${current === 1 ? 'active' : ''}`} id="s1">
                  <div className="wordmark">PLANBRO PRESENTS</div>
                  <div className="display">Your 2026,<br/>in motion<span>.</span></div>
                  <div className="subcopy">Every city you chased, every km you clocked, every plate you didn't finish. We tracked it all so you don't have to remember it.</div>
                  <div className="cta">Tap to begin <div className="arrow">&rarr;</div></div>
                </div>

                {/* 2 EXPLORER */}
                <div className={`screen ${current === 2 ? 'active' : ''}`} id="s2">
                  <div className="eyebrow">Terminal 01 &middot; Destinations</div>
                  <div className="statnum" data-count="9">9</div>
                  <div className="statunit">cities explored</div>
                  <div className="accentline" style={{background:'var(--gold)'}}></div>
                  <div className="subcopy" style={{marginTop:'20px'}}>You didn't just travel this year. You collected stamps.</div>
                  <div className="chiprow" id="citychips">
                    {cities.map((c, i) => (
                      <div key={i} className="citychip" style={{animationDelay: `${0.15 + i*0.05}s`}}>{c}</div>
                    ))}
                  </div>
                </div>

                {/* 3 DISTANCE */}
                <div className={`screen ${current === 3 ? 'active' : ''}`} id="s3">
                  <div className="eyebrow" style={{color:'var(--mint)'}}>Terminal 02 &middot; Distance</div>
                  <div className="statnum" data-count="14820">14,820</div>
                  <div className="statunit">kilometers covered</div>
                  <div className="accentline" style={{background:'var(--mint)'}}></div>
                  <div className="routeviz">
                    <svg viewBox="0 0 320 70" preserveAspectRatio="none">
                      <path className="path" d="M5,50 Q80,10 160,40 T310,20"/>
                      <circle className="dot" cx="5" cy="50" r="4"/>
                      <circle className="dot" cx="310" cy="20" r="4"/>
                    </svg>
                  </div>
                  <div className="equivbox">
                    <div className="lbl">Put in perspective</div>
                    <div className="txt">That's Delhi to London and back &mdash; with a detour to Goa, because obviously.</div>
                  </div>
                </div>

                {/* 4 TRIPS */}
                <div className={`screen ${current === 4 ? 'active' : ''}`} id="s4">
                  <div className="eyebrow">Terminal 03 &middot; Trips</div>
                  <div className="statnum" data-count="7">7</div>
                  <div className="statunit">trips planned</div>
                  <div className="accentline" style={{background:'var(--gold)'}}></div>
                  <div className="subcopy" style={{marginTop:'20px'}}>Seven times you said "let's just go" &mdash; and actually went.</div>
                  <div className="dashed-divider"></div>
                  <div className="ticket-tag">&#10003; 3 weekend runs</div>
                  <div style={{height:'8px'}}></div>
                  <div className="ticket-tag">&#10003; 4 full getaways</div>
                </div>

                {/* 5 FOODIE */}
                <div className={`screen ${current === 5 ? 'active' : ''}`} id="s5">
                  <div className="eyebrow" style={{color:'var(--pink)'}}>Terminal 04 &middot; Food Stops</div>
                  <div className="statnum" data-count="42">42</div>
                  <div className="statunit">restaurants &amp; food stops</div>
                  <div className="accentline" style={{background:'var(--pink)'}}></div>
                  <div className="subcopy" style={{marginTop:'20px'}}>Certified plate-cleaner. Here's what you kept ordering.</div>
                  <div className="tagcloud" id="foodtags">
                    {foods.map((f, i) => (
                      <div key={i} className="foodtag" style={{animationDelay: `${0.15 + i*0.05}s`}}>{f}</div>
                    ))}
                  </div>
                </div>

                {/* 6 MAP */}
                <div className={`screen ${current === 6 ? 'active' : ''}`} id="s6" style={{paddingBottom:'24px'}}>
                  <div className="eyebrow">Terminal 05 &middot; Footprint</div>
                  <div className="display" style={{fontSize:'24px'}}>Your route across India</div>
                  <div className="mapwrap">
                    <svg viewBox="0 0 340 500">
                      <defs>
                        <linearGradient id="arcgrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#F5B942"/>
                          <stop offset="100%" stopColor="#FF3D7F"/>
                        </linearGradient>
                      </defs>
                      <path className="india-shape" d="M150,15 185,25 230,45 265,70 290,95 305,130 295,160 310,190 300,225 280,245 290,270 270,300 250,330 230,360 215,390 205,420 195,450 185,480 170,460 160,430 150,400 130,410 115,390 100,360 90,330 95,300 80,270 90,240 75,210 65,180 70,150 60,120 75,95 65,70 85,55 100,35 120,20 Z"/>

                      {/* route arcs */}
                      <path className="route-arc" d="M175,95 Q170,112 165,130"/>
                      <path className="route-arc" d="M165,130 Q148,148 130,165"/>
                      <path className="route-arc" d="M130,165 Q120,185 110,205"/>
                      <path className="route-arc" d="M110,205 Q160,197 210,190"/>
                      <path className="route-arc" d="M210,190 Q200,125 190,60"/>
                      <path className="route-arc" d="M190,60 Q145,190 100,320"/>
                      <path className="route-arc" d="M100,320 Q150,365 195,410"/>
                      <path className="route-arc" d="M195,410 Q175,425 155,440"/>

                      {/* city dots */}
                      <g>
                        <circle className="city-pulse" cx="190" cy="60"/><circle className="city-dot" cx="190" cy="60" r="4"/><text className="city-label" x="197" y="58">LEH</text>
                        <circle className="city-pulse" cx="175" cy="95"/><circle className="city-dot" cx="175" cy="95" r="4"/><text className="city-label" x="182" y="93">MANALI</text>
                        <circle className="city-pulse" cx="165" cy="130"/><circle className="city-dot" cx="165" cy="130" r="4"/><text className="city-label" x="172" y="128">RISHIKESH</text>
                        <circle className="city-pulse" cx="130" cy="165"/><circle className="city-dot" cx="130" cy="165" r="4"/><text className="city-label" x="102" y="163">JAIPUR</text>
                        <circle className="city-pulse" cx="110" cy="205"/><circle className="city-dot" cx="110" cy="205" r="4"/><text className="city-label" x="45" y="208">UDAIPUR</text>
                        <circle className="city-pulse" cx="210" cy="190"/><circle className="city-dot" cx="210" cy="190" r="4"/><text className="city-label" x="217" y="188">VARANASI</text>
                        <circle className="city-pulse" cx="100" cy="320"/><circle className="city-dot" cx="100" cy="320" r="4"/><text className="city-label" x="60" y="323">GOA</text>
                        <circle className="city-pulse" cx="195" cy="410"/><circle className="city-dot" cx="195" cy="410" r="4"/><text className="city-label" x="202" y="408">PONDICHERRY</text>
                        <circle className="city-pulse" cx="155" cy="440"/><circle className="city-dot" cx="155" cy="440" r="4"/><text className="city-label" x="105" y="448">MUNNAR</text>
                      </g>
                    </svg>
                  </div>
                  <div className="subcopy" style={{marginTop:'0'}}>Leh to Munnar &mdash; you covered more of the map than most people's bucket lists.</div>
                </div>

                {/* 7 SOCIAL */}
                <div className={`screen ${current === 7 ? 'active' : ''}`} id="s7">
                  <div className="eyebrow" style={{color:'var(--pink)'}}>Terminal 06 &middot; Travel Squad</div>
                  <div className="buddy-count-row">
                    <div className="statnum" style={{fontSize:'64px'}} data-count="6">6</div>
                    <div className="statunit" style={{marginTop:'0'}}>travel buddies this year</div>
                  </div>
                  <div className="reveal-card">
                    <div className="lbl">Out of all your buddies, your top buddy was</div>
                    <div className="avatar-ring">A</div>
                    <div className="name">Apoorv</div>
                    <div className="meta">4 TRIPS TOGETHER &middot; YOUR #1 CO-PILOT</div>
                  </div>
                  <div className="buddy-bars" id="buddybars">
                    {buddies.map((b, i) => (
                      <div key={i} className="buddy-bar-row">
                        <div className="bname">{b[0]}</div>
                        <div className="buddy-bar-track">
                          <div className="buddy-bar-fill" style={{width: current === 7 ? `${((b[1] as number)/4)*100}%` : '0%', transitionDelay: `${150 + i*100}ms`}}></div>
                        </div>
                        <div className="bnum">{b[1]}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 8 SUMMARY */}
                <div className={`screen ${current === 8 ? 'active' : ''}`} id="s8">
                  <div className="ticket">
                    <div className="ticket-top">
                      <div className="tlogo">PLAN<span>BRO</span></div>
                      <div className="tyear">WRAPPED &middot; 2026</div>
                    </div>
                    <div className="ticket-headline">This was your year on the move.</div>
                    <div className="ticket-grid">
                      <div className="ticket-stat"><div className="k">Destinations</div><div className="v gold">9</div></div>
                      <div className="ticket-stat"><div className="k">Distance</div><div className="v mint">14,820 km</div></div>
                      <div className="ticket-stat"><div className="k">Trips</div><div className="v">7</div></div>
                      <div className="ticket-stat"><div className="k">Food stops</div><div className="v pink">42</div></div>
                      <div className="ticket-stat"><div className="k">Travel buddies</div><div className="v">6</div></div>
                      <div className="ticket-stat"><div className="k">Top buddy</div><div className="v gold">Apoorv</div></div>
                    </div>
                    <div className="perforation"></div>
                    <div className="ticket-bottom">
                      <div className="barcode" id="barcode">
                        {[...Array(28)].map((_, i) => (
                          <i key={i} style={{height: `${8 + Math.random()*18}px`}}></i>
                        ))}
                      </div>
                      <div className="code">PNR: PB2026WRAP</div>
                    </div>
                  </div>
                  <button className="share-btn" onClick={triggerToast}>&#10548; Share your Wrapped</button>
                  <div className="share-sub">planbro.app/wrapped</div>
                </div>

              </div>
              <div className={`toast ${showToast ? 'show' : ''}`} id="toast">Saved to your gallery &#10003;</div>
            </div>
          </div>
          <div className="hint">Tap <b>left</b> / <b>right</b> edges of the screen to move through the story</div>
        </div>
      </div>
    </>
  );
}
