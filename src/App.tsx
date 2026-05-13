/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode, useRef, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Map as MapIcon, 
  Wallet, 
  Layers, 
  Trophy, 
  Menu, 
  X, 
  ArrowRight,
  TrendingUp,
  Cpu,
  Globe,
  LogOut,
  User as UserIcon,
  Crown,
  ShoppingBag,
  MessageCircle,
  Gavel,
  Play,
  ShoppingCart,
  Send,
  Plus,
  Tv,
  MapPin,
  Lock,
  ChevronRight,
  Sparkles,
  Zap,
  ExternalLink
} from 'lucide-react';
import { auth, signInWithGoogle, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, query, collection, where, addDoc, orderBy, limit, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Float, MeshDistortMaterial, MeshWobbleMaterial, ContactShadows, Text } from '@react-three/drei';
import * as THREE from 'three';
import ReactPlayer from 'react-player';

const MAP_KEYS = [
  process.env.GOOGLE_MAPS_PLATFORM_KEY,
  process.env.GOOGLE_MAPS_PLATFORM_KEY_2,
  process.env.GOOGLE_MAPS_PLATFORM_KEY_3
].filter(Boolean) as string[];

const MapWithFallback = ({ children }: { children: ReactNode }) => {
  const [keyIndex, setKeyIndex] = useState(0);
  const currentKey = MAP_KEYS[keyIndex] || '';

  useEffect(() => {
    // Google Maps Auth Failure Global Handler
    (window as any).gm_authFailure = () => {
      console.warn(`Google Maps Auth Failure with key index ${keyIndex}. Attempting fallback...`);
      if (keyIndex < MAP_KEYS.length - 1) {
        setKeyIndex(prev => prev + 1);
      }
    };
    return () => {
      (window as any).gm_authFailure = null;
    };
  }, [keyIndex]);

  if (!currentKey) {
    return (
      <div className="flex items-center justify-center h-full bg-black/40 border border-white/5">
        <div className="text-center p-8">
          <Lock className="w-8 h-8 text-gold mx-auto mb-4 opacity-20" />
          <p className="text-[10px] text-white/30 uppercase tracking-[0.2em]">Sovereign Encryption: No Map Key Found</p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={currentKey} key={currentKey}>
      {children}
    </APIProvider>
  );
};

// --- Constants ---

const MAURITIUS_CENTER = { lat: -20.3484, lng: 57.5522 };
const VILLAS = [
  { 
    id: 'oa-1', 
    name: "Oasis North Villa", 
    type: "Residential", 
    price: 1200000, 
    location: "Grand Baie", 
    coords: { lat: -20.0101, lng: 57.5802 },
    img: 'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?auto=format&fit=crop&q=80&w=2070',
    desc: "A stunning contemporary villa with private beach access and metabolic garden nodes."
  },
  { 
    id: 'az-2', 
    name: "Azure Heights Penthouse", 
    type: "Residential", 
    price: 850000, 
    location: "Tamarin", 
    coords: { lat: -20.3200, lng: 57.3700 },
    img: 'https://images.unsplash.com/photo-1554032067-ff703f8c8f00?auto=format&fit=crop&q=80&w=2070',
    desc: "Breathtaking mountain views and automated climate control systems."
  },
  { 
    id: 'pl-1', 
    name: "Port Louis Commercial Node", 
    type: "Commercial", 
    price: 2100000, 
    location: "Port Louis", 
    coords: { lat: -20.1609, lng: 57.5050 },
    img: 'https://images.unsplash.com/photo-1544735716-e3ed28230f71?auto=format&fit=crop&q=80&w=2070',
    desc: "Multi-tenant digital office space with high-speed uplink to the Metropolis Mesh."
  },
  { 
    id: 'em-3', 
    name: "Emerald Cove Estate", 
    type: "Residential", 
    price: 3400000, 
    location: "Belle Mare", 
    coords: { lat: -20.1900, lng: 57.7700 },
    img: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&q=80&w=2070',
    desc: "The pinnacle of Mauritian luxury, featuring 5 energy-positive suites and a 100m pool."
  }
];

// --- Components ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We throw it so the system can catch it and diagnose rules
  throw new Error(JSON.stringify(errInfo));
}

const LiveObservatory = () => {
  const [activeCam, setActiveCam] = useState<'caudan' | 'govt' | 'place'>('caudan');
  const Player = ReactPlayer as any;
  
  const cams = {
    caudan: {
      title: "Caudan Waterfront Node",
      url: "https://stream.myt.mu/rh/prod/CAUDAN_NORTH.stream_720p/playlist.m3u8",
      stats: { load: "82%", density: "High", security: "Active" }
    },
    govt: {
      title: "Govt Street Axis",
      url: "https://stream.myt.mu/prod/CDM_GOVT_STR_JUNCTION.stream_720p/playlist.m3u8",
      stats: { load: "45%", density: "Medium", security: "Active" }
    },
    place: {
      title: "Place d'Armes Hub",
      url: "https://stream.myt.mu/prod/PLACE_DARMES.stream_720p/playlist.m3u8",
      stats: { load: "62%", density: "Medium", security: "Active" }
    }
  };

  return (
    <div className="w-full aspect-video bg-black relative group overflow-hidden border border-white/10">
      <div className="absolute inset-0 grayscale group-hover:grayscale-0 transition-all duration-1000">
        <Player
          url={cams[activeCam].url}
          playing={true}
          muted={true}
          loop={true}
          width="100%"
          height="100%"
          playsinline={true}
          controls={false}
          style={{ transform: 'scale(1.1)' }}
        />
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
      
      <div className="absolute top-6 left-6 flex gap-3 z-20">
         <button 
           onClick={() => setActiveCam('caudan')}
           className={`px-4 py-1.5 text-[9px] uppercase tracking-widest font-bold border ${activeCam === 'caudan' ? 'bg-gold text-black border-gold' : 'bg-black/80 text-white/40 border-white/10 hover:border-white/30'}`}
         >
           Caudan Waterfront
         </button>
         <button 
           onClick={() => setActiveCam('govt')}
           className={`px-4 py-1.5 text-[9px] uppercase tracking-widest font-bold border ${activeCam === 'govt' ? 'bg-gold text-black border-gold' : 'bg-black/80 text-white/40 border-white/10 hover:border-white/30'}`}
         >
           Govt Junction
         </button>
         <button 
           onClick={() => setActiveCam('place')}
           className={`px-4 py-1.5 text-[9px] uppercase tracking-widest font-bold border ${activeCam === 'place' ? 'bg-gold text-black border-gold' : 'bg-black/80 text-white/40 border-white/10 hover:border-white/30'}`}
         >
           Place d'Armes
         </button>
      </div>

      <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end pointer-events-none z-20">
         <div>
            <div className="text-gold text-[10px] uppercase font-bold tracking-widest mb-1 flex items-center gap-2">
               <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
               Live Feed // Metropolitan Observer
            </div>
            <h4 className="text-xl font-serif italic text-white">{cams[activeCam].title}</h4>
         </div>
         <div className="flex gap-8">
            {Object.entries(cams[activeCam].stats).map(([k, v]) => (
              <div key={k} className="flex flex-col items-end">
                 <span className="text-[8px] text-white/20 uppercase font-bold tracking-widest">{k}</span>
                 <span className="text-xs text-white/60 font-mono">{v}</span>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

const MauritiusShowcase = () => {
  const images = [
    { url: "https://images.unsplash.com/photo-1590247813693-5541d1c609ec", label: "Grand Baie", type: "Pittoresque Beach View" },
    { url: "https://images.unsplash.com/photo-1589330273594-fade1ee91647", label: "Le Morne Brabant", type: "Where Abolition of Slavery Began" },
    { url: "https://images.unsplash.com/photo-1544735716-e3ed28230f71", label: "Port Louis Waterfront", type: "Mauritius on the Move" },
    { url: "https://images.unsplash.com/photo-1552083375-1447ce886485", label: "Pointe d'Esny", type: "First Port of Mauritius Grand Port" },
  ];

  return (
    <section className="py-32">
       <div className="flex justify-between items-end mb-16 px-8">
          <div>
            <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Island Tapestry</h2>
            <h3 className="text-5xl font-serif italic text-white leading-tight">Mauritius Landscape <br /> & Corporate Life</h3>
          </div>
          <div className="hidden lg:block max-w-sm text-right">
             <p className="text-xs text-white/30 italic leading-relaxed">
               "A synergy of sub-tropical tranquility and hyper-efficient digital infrastructure. The Metropolis is not just a place, but an state of being."
             </p>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-4">
          {images.map((img, i) => (
            <motion.div 
              key={i}
              whileHover={{ scale: 1.02 }}
              className="aspect-[3/4] relative overflow-hidden group aura-card border-white/5"
            >
               <img src={img.url} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" alt={img.label} />
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />
               <div className="absolute bottom-6 left-6">
                  <span className="text-[9px] text-gold font-bold uppercase tracking-widest mb-1 block">{img.type}</span>
                  <h4 className="text-xl font-serif italic text-white">{img.label}</h4>
               </div>
            </motion.div>
          ))}
       </div>
    </section>
  );
};

const Navbar = ({ user, auraBalance }: { user: User | null, auraBalance: number }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-xl border-b border-white/10 h-16">
      <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 bg-gradient-to-tr from-gold to-[#8E6D3B] rounded-sm flex items-center justify-center font-serif text-black font-bold shadow-[0_0_20px_rgba(197,160,89,0.2)]">A</div>
          <span className="text-lg font-serif tracking-widest text-gold drop-shadow-sm">AURA <span className="text-white/20 mx-1">/</span> METROPOLIS</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-8">
          <Link to="/metropolis" className="tracking-archive text-white/50 hover:text-white transition-colors">Sky Metropolis</Link>
          <Link to="/map" className="tracking-archive text-white/50 hover:text-white transition-colors">Sovereign Map</Link>
          <Link to="/market" className="tracking-archive text-white/50 hover:text-white transition-colors">Market</Link>
          <Link to="/grocery" className="tracking-archive text-white/50 hover:text-white transition-colors">Grocery</Link>
          <Link to="/media" className="tracking-archive text-white/50 hover:text-white transition-colors">Media</Link>
          <Link to="/citadel" className="tracking-archive text-white/50 hover:text-white transition-colors">The Citadel</Link>
          
          {user && (
            <div className="flex items-center gap-4 px-4 py-1.5 bg-gold/5 border border-gold/10 rounded-sm">
               <div className="flex flex-col items-end">
                  <span className="text-[8px] text-gold/50 font-bold tracking-widest leading-none mb-1">AURA BALANCE</span>
                  <span className="text-xs font-mono text-gold leading-none">{auraBalance.toFixed(2)}</span>
               </div>
               <TrendingUp className="w-3 h-3 text-gold animate-pulse" />
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-6">
              <Link to="/dashboard" className="w-8 h-8 rounded-sm bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden hover:border-gold/30 transition-all shadow-inner">
                {user.photoURL ? <img src={user.photoURL} alt={user.displayName || ''} className="opacity-70 grayscale hover:grayscale-0 transition-all scale-110" /> : <UserIcon className="w-4 h-4 text-white/50" />}
              </Link>
              <button 
                onClick={() => signOut(auth)}
                className="text-[10px] tracking-widest text-white/30 hover:text-white transition-colors uppercase font-bold"
              >
                LOGOUT
              </button>
            </div>
          ) : (
            <button 
              onClick={signInWithGoogle}
              className="px-6 py-2 border border-gold/30 rounded-none text-[10px] tracking-widest text-gold hover:bg-gold hover:text-black transition-all font-bold uppercase"
            >
              Initialize Node
            </button>
          )}
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-[#050505] border-b border-white/5 p-4 flex flex-col gap-4"
          >
            <Link to="/metropolis" onClick={() => setIsOpen(false)}>Sky Metropolis</Link>
            <Link to="/map" onClick={() => setIsOpen(false)}>Sovereign Map</Link>
            <Link to="/market" onClick={() => setIsOpen(false)}>Art Market</Link>
            <Link to="/grocery" onClick={() => setIsOpen(false)}>Grocery Node</Link>
            <Link to="/media" onClick={() => setIsOpen(false)}>Media Hub</Link>
            <Link to="/citadel" onClick={() => setIsOpen(false)}>The Citadel</Link>
            {user && <Link to="/dashboard" onClick={() => setIsOpen(false)}>Dashboard</Link>}
            {!user && <button onClick={signInWithGoogle} className="bg-white text-black py-2 rounded-lg text-xs font-bold uppercase">Initialize Protocol</button>}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- Pages ---

const Landing = () => (
  <div className="pt-24 pb-20 overflow-hidden min-h-screen">
    <div className="max-w-7xl mx-auto px-8 w-full">
      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center mb-32">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-4 mb-12">
            <div className="h-[1px] w-12 bg-gold/50" />
            <span className="text-[10px] tracking-[0.5em] text-gold uppercase font-bold">2026 Sovereign Protocol</span>
          </div>
          
          <h1 className="text-7xl md:text-[8rem] font-serif italic mb-10 leading-[0.85] text-white tracking-tighter">
            Digital <br />
            <span className="text-gold not-italic uppercase font-bold text-6xl md:text-7xl tracking-widest block mt-4">Safe Haven</span>
          </h1>

          <div className="max-w-xl space-y-8 mb-16">
            <p className="text-xl text-white/60 leading-relaxed font-light italic">
              "The 2026 Golden Visa introduces a 5-day fast-track residency for global leaders in AI, Biotech, and Fintech. Secure your future in a nation with no military overhead and absolute fiscal neutrality."
            </p>
          </div>

          <div className="flex flex-wrap gap-8 items-center pt-8 border-t border-white/5">
            <Link to="/metropolis" className="group bg-gold text-black px-12 py-6 font-bold text-xs uppercase tracking-[0.4em] hover:bg-gold-hover transition-all flex items-center gap-4">
              Initialize Stake
              <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
            </Link>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/20 uppercase font-bold tracking-widest">Global Ranking</span>
              <span className="text-xl font-serif text-white">#1 <span className="text-gold/50 text-xs italic">Ease of Business (Africa)</span></span>
            </div>
          </div>
        </motion.div>

        <div className="relative">
           <div className="aspect-[4/5] bg-black border border-white/10 relative overflow-hidden group">
              <img src="https://images.unsplash.com/photo-1543165737-142f1f0a6d5a?auto=format&fit=crop&q=80&w=2070" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[20s] ease-linear grayscale group-hover:grayscale-0" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              
              <div className="absolute bottom-10 left-10 space-y-4">
                 <div className="flex gap-4">
                   <div className="px-4 py-2 bg-black/80 backdrop-blur-md border border-white/10 text-white font-mono text-[10px] uppercase">Status: 5-Day Fast Track</div>
                   <div className="px-4 py-2 bg-gold text-black font-bold text-[10px] uppercase">15% Flat Tax</div>
                 </div>
                 <h2 className="text-3xl font-serif italic text-white">Legislative Sanctuary</h2>
              </div>
           </div>
        </div>
      </div>

      {/* Visa Tiers & Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-32">
        <div className="aura-card p-12 bg-[#0A0A0B] border-gold/20">
          <Crown className="w-10 h-10 text-gold mb-8" />
          <h3 className="text-3xl font-serif italic text-white mb-6">The 2026 Golden Visa</h3>
          <ul className="space-y-6">
            <li className="flex gap-4">
              <div className="w-1.5 h-1.5 bg-gold rounded-full mt-2" />
              <div>
                <span className="text-white font-bold block mb-1">US$1.0M Allocation</span>
                <span className="text-white/40 text-xs uppercase tracking-widest">Investment must be cleared within 12 months.</span>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-1.5 h-1.5 bg-gold rounded-full mt-2" />
              <div>
                <span className="text-white font-bold block mb-1">Target Sectors</span>
                <span className="text-white/40 text-xs uppercase tracking-widest">AI, Fintech, Biotechnology, Renewable Energy, & Global Treasury.</span>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-1.5 h-1.5 bg-gold rounded-full mt-2" />
              <div>
                <span className="text-white font-bold block mb-1">Family Mobility</span>
                <span className="text-white/40 text-xs uppercase tracking-widest">Simultaneous residency for immediate family and dependents.</span>
              </div>
            </li>
          </ul>
        </div>

        <div className="aura-card p-12 bg-[#0A0A0B] border-white/10">
          <TrendingUp className="w-10 h-10 text-gold mb-8" />
          <h3 className="text-3xl font-serif italic text-white mb-6">Fiscal Architecture</h3>
          <ul className="space-y-6">
            <li className="flex gap-4">
              <div className="w-1.5 h-1.5 bg-white/20 rounded-full mt-2" />
              <div>
                <span className="text-white font-bold block mb-1">0% Inheritance Tax</span>
                <span className="text-white/40 text-xs uppercase tracking-widest">Preserve wealth across generations without capital seizure.</span>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-1.5 h-1.5 bg-white/20 rounded-full mt-2" />
              <div>
                <span className="text-white font-bold block mb-1">15% Flat Corporate Tax</span>
                <span className="text-white/40 text-xs uppercase tracking-widest">Simplified fiscal logic for operational business entities.</span>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-1.5 h-1.5 bg-white/20 rounded-full mt-2" />
              <div>
                <span className="text-white font-bold block mb-1">Standard Residency</span>
                <span className="text-white/40 text-xs uppercase tracking-widest">Available at $375,000 for standard real-estate acquisition.</span>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* News & Insights */}
      <div className="mb-32">
        <div className="flex justify-between items-end mb-16">
          <div>
            <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Metropolis Intelligence</h2>
            <h3 className="text-5xl font-serif italic text-white">News & Legal Insights</h3>
          </div>
          <button className="text-gold text-[10px] uppercase tracking-widest font-bold border-b border-gold/40 pb-1 flex items-center gap-2">
            View Live Feed <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { tag: "Safety", title: "Mauritius Retains Top Spot as Safest Country in Africa 2026", desc: "The absence of a domestic military and focus on community-centric metabolic policing keeps crime at historic lows." },
            { tag: "Law", title: "New AI Governance Act Passed to Support Golden Visa Entities", desc: "Legislative framework now allows 100% foreign ownership of intellectual property in specialized metabolic zones." },
            { tag: "Culture", title: "Westernized Luxury Meets Sub-Tropical Peace", desc: "From high-end European fashion hubs to cheap high-quality Chinese imports, the supply chain remains a global outlier." }
          ].map((item, i) => (
            <div key={i} className="group cursor-pointer">
              <div className="text-[9px] text-gold font-bold uppercase tracking-[0.3em] mb-4 block">{item.tag}</div>
              <h4 className="text-xl font-serif italic text-white mb-6 group-hover:text-gold transition-colors">{item.title}</h4>
              <p className="text-white/40 text-sm italic leading-relaxed mb-8">"{item.desc}"</p>
              <div className="flex items-center gap-2 text-white/20 text-[9px] uppercase font-bold tracking-widest">
                <div className="w-4 h-[1px] bg-white/10" />
                Read Analysis 
              </div>
            </div>
          ))}
        </div>
      </div>

      <MauritiusShowcase />

      <div className="mb-32">
         <div className="mb-16">
            <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Sovereign Eye</h2>
            <h3 className="text-5xl font-serif italic text-white">Live Metropolis Stream</h3>
         </div>
         <LiveObservatory />
      </div>
    </div>
  </div>
);

const NFT3DViewer = ({ level, auraColor }: { level: number, auraColor: string }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  return (
    <Canvas shadows dpr={[1, 2]}>
      <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50} />
      <OrbitControls 
        enablePan={false} 
        minDistance={3} 
        maxDistance={10} 
        autoRotate 
        autoRotateSpeed={0.5} 
      />
      
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} castShadow />
      <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
      
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <group position={[0, -1, 0]}>
          {/* Main Tower Body */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1, level * 0.4 + 1, 1]} />
            <meshStandardMaterial 
              color={auraColor || "#C5A059"} 
              metalness={0.8} 
              roughness={0.2} 
              emissive={auraColor || "#C5A059"}
              emissiveIntensity={0.2}
            />
          </mesh>

          {/* Accent Rings */}
          {Array.from({ length: level }).map((_, i) => (
            <mesh key={i} position={[0, i * 0.4 - (level * 0.2), 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.7, 0.02, 16, 100]} />
              <meshStandardMaterial color={auraColor || "#C5A059"} emissive={auraColor || "#C5A059"} emissiveIntensity={0.5} />
            </mesh>
          ))}

          {/* Particle System around the building */}
          <CloudParticles count={20} color={auraColor} />
        </group>
      </Float>

      <ContactShadows 
        position={[0, -2, 0]} 
        opacity={0.4} 
        scale={10} 
        blur={2} 
        far={4.5} 
      />
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
    </Canvas>
  );
};

const CloudParticles = ({ count = 20, color = "#C5A059" }) => {
  const points = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 4;
      p[i * 3 + 1] = Math.random() * 4;
      p[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    return p;
  }, [count]);

  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.1} 
        color={color} 
        transparent 
        opacity={0.6} 
        blending={THREE.AdditiveBlending} 
      />
    </points>
  );
};

const Metropolis = ({ user, profile, auraBalance }: { user: User | null, profile: any, auraBalance: number }) => {
  const [nft, setNft] = useState<any>(null);
  const [isEvolving, setIsEvolving] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

  useEffect(() => {
    if (!user) return;
    
    // Subscribe to NFT (assuming 1 NFT for demo)
    const nftPath = 'nfts';
    const q = query(collection(db, nftPath), where('ownerId', '==', user.uid), limit(1));
    const unsubNft = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setNft({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setNft(null);
      }
    }, (err) => {
       console.error("NFT Fetch Error:", err);
       // Silence the throw to prevent app crash during dev
    });

    return () => {
      unsubNft();
    };
  }, [user]);

  const handleInvest = async () => {
    if (!user) return;
    const amount = 5000;
    const userId = user.uid;
    const investmentId = Math.random().toString(36).substring(7);
    
    try {
      // 1. Create investment record
      const invPath = `investments/${investmentId}`;
      await setDoc(doc(db, 'investments', investmentId), {
        userId,
        estateId: 'demo-estate',
        amount,
        timestamp: new Date().toISOString()
      });

      // 2. Update user profile (simulating aggregation for demo)
      const userRef = doc(db, 'users', userId);
      const newTotal = (profile?.totalInvested || 0) + amount;
      await setDoc(userRef, {
        totalInvested: newTotal,
        hasGoldVisaEligibility: newTotal >= 1000000
      }, { merge: true });

      // 3. Trigger NFT evolution if needed or just update metadata
      if (!nft) {
        // Create initial NFT
        await setDoc(doc(db, 'nfts', `nft-${userId}`), {
          ownerId: userId,
          level: 1,
          traitDescription: "A nascent spark in the metropolis.",
          auraColor: "#ffffff",
          lastEvolution: new Date().toISOString()
        });
      } else {
        // Evolve via Gemini
        setIsEvolving(true);
        const res = await fetch('/api/generate-nft-trait', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentStatus: nft.traitDescription,
            investmentLevel: newTotal
          })
        });
        const data = await res.json();
        
        await updateDoc(doc(db, 'nfts', nft.id), {
          level: nft.level + 1,
          traitDescription: data.traitText,
          auraColor: data.auraColor,
          lastEvolution: new Date().toISOString()
        });
        setIsEvolving(false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'metropolis-transaction');
    }
  };

  return (
    <div className="pt-24 pb-20 max-w-7xl mx-auto px-8">
      <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
        <div>
          <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Aura : Metropolis Node</h2>
          <h3 className="text-5xl font-serif italic text-white flex items-center gap-4">
            Sky Metropolis <span className="text-gold not-italic font-sans text-xs uppercase tracking-[0.2em] px-3 py-1 border border-gold/30 rounded-sm">Archive 01</span>
          </h3>
        </div>
        <div className="flex gap-2 p-1 bg-white/5 border border-white/10 h-max mb-2">
          <button 
            onClick={() => setViewMode('2d')}
            className={`px-4 py-1.5 text-[9px] uppercase tracking-widest font-bold border transition-all ${viewMode === '2d' ? 'bg-gold text-black border-gold shadow-[0_0_15px_rgba(197,160,89,0.3)]' : 'bg-transparent text-white/40 border-transparent hover:text-white'}`}
          >
            Tactical Feed (2D)
          </button>
          <button 
            onClick={() => setViewMode('3d')}
            className={`px-4 py-1.5 text-[9px] uppercase tracking-widest font-bold border transition-all ${viewMode === '3d' ? 'bg-gold text-black border-gold shadow-[0_0_15px_rgba(197,160,89,0.3)]' : 'bg-transparent text-white/40 border-transparent hover:text-white'}`}
          >
            Holographic Map (3D)
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-10">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] mb-2 font-bold font-mono">AURA BALANCE</span>
            <span className="text-3xl font-serif text-gold">{auraBalance.toFixed(2)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] mb-2 font-bold font-mono">Portfolio Value</span>
            <span className="text-3xl font-serif text-white">${profile?.totalInvested?.toLocaleString() || '0'}</span>
          </div>
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] mb-2 font-bold font-mono">Visa Progress</span>
            <span className={`text-3xl font-serif ${profile?.hasGoldVisaEligibility ? 'text-green-500' : 'text-white/20'}`}>
              {profile?.hasGoldVisaEligibility ? 'QUALIFIED' : `${((profile?.totalInvested || 0) / 1000000 * 100).toFixed(1)}%`}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 border border-white/10">
        <div className="md:col-span-8 min-h-[600px] bg-[#0A0A0B] relative group overflow-hidden">
          {viewMode === '2d' ? (
            <>
              <div className="absolute inset-0 grayscale opacity-20 group-hover:opacity-40 group-hover:grayscale-0 transition-all duration-1000 bg-[url('https://images.unsplash.com/photo-1544735716-e3ed28230f71?auto=format&fit=crop&q=80&w=2070')] bg-cover bg-center" />
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(197, 160, 89, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
              
              <AnimatePresence mode="wait">
                {nft && (
                  <motion.div 
                    key={`${nft.id}-${nft.level}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    {/* Dynamic Intense Aura */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ 
                        opacity: [0.1, 0.25, 0.1],
                        scale: [1, 1.2, 1],
                      }}
                      transition={{ 
                        duration: 4, 
                        repeat: Infinity, 
                        ease: "easeInOut" 
                      }}
                      className="absolute w-[500px] h-[500px] rounded-full blur-[140px]" 
                      style={{ backgroundColor: nft.auraColor || '#C5A059' }} 
                    />
                    
                    {/* Evolution Burst Effect */}
                    <motion.div 
                      initial={{ opacity: 0.8, scale: 0.5 }}
                      animate={{ opacity: 0, scale: 2.5 }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="absolute w-64 h-64 border-2 rounded-full z-0"
                      style={{ borderColor: nft.auraColor || '#C5A059' }}
                    />

                    <motion.div 
                      animate={{ 
                        y: [0, -15, 0],
                        rotate: [45, 47, 45]
                      }}
                      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                      className="relative z-10"
                    >
                      <div className="w-64 h-64 border-2 border-gold/20 flex items-center justify-center bg-black/60 backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] transform rotate-45 relative overflow-hidden group/nft">
                        {/* Inner glowing core */}
                        <div 
                          className="absolute inset-0 opacity-20 group-hover/nft:opacity-40 transition-opacity duration-1000"
                          style={{ background: `radial-gradient(circle at center, ${nft.auraColor || '#C5A059'} 0%, transparent 70%)` }}
                        />
                        
                        <div className="transform -rotate-45 flex flex-col items-center">
                           <Building2 className="w-24 h-24 text-gold/40 mb-4" />
                           <div className="flex flex-col items-center gap-1">
                             <div className="px-2 py-0.5 bg-gold/10 border border-gold/20 text-[8px] font-mono text-gold tracking-[0.3em] uppercase">
                               Level {nft.level.toString().padStart(2, '0')}
                             </div>
                             <div className="text-[9px] font-mono text-white/40 tracking-widest whitespace-nowrap">
                               MINT_ID: {nft.id.split('-')[1]?.toUpperCase()}
                             </div>
                           </div>
                        </div>

                        {/* Corner accents */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-gold/40" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-gold/40" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-gold/40" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-gold/40" />
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="absolute inset-0">
               <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0A0B] pointer-events-none z-10" />
               <AnimatePresence mode="wait">
                  {nft ? (
                    <motion.div 
                      key={nft.level}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="w-full h-full"
                    >
                       <NFT3DViewer level={nft.level} auraColor={nft.auraColor} />
                    </motion.div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                       <Cpu className="w-12 h-12 text-white/5 mb-4 animate-pulse" />
                       <span className="text-[10px] text-white/20 uppercase tracking-[0.4em]">Awaiting Construct Sync...</span>
                    </div>
                  )}
               </AnimatePresence>
               
               <div className="absolute bottom-8 right-8 z-20 pointer-events-none">
                  <div className="text-right">
                     <span className="text-[9px] text-gold font-bold uppercase tracking-[0.3em] block mb-1">Spatial Overlay</span>
                     <span className="text-xs text-white/40 font-mono italic">Node Hologram Active</span>
                  </div>
               </div>
            </div>
          )}

          <div className="absolute top-8 left-8 flex gap-4">
            <div className="px-3 py-1 bg-black/60 border border-gold/30 text-gold text-[9px] uppercase tracking-widest font-bold">Coord: 20.34° S, 57.55° E</div>
            <div className="px-3 py-1 bg-gold text-black text-[9px] uppercase tracking-widest font-bold">Active Engine</div>
          </div>

          <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
            <div className="max-w-sm">
              {nft ? (
                <motion.p 
                  key={nft.traitDescription}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-lg italic font-serif text-white/70"
                >
                  "{nft.traitDescription}"
                </motion.p>
              ) : (
                <p className="text-white/30 text-xs tracking-widest uppercase font-bold italic">No active mint detected in this node.</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="md:col-span-4 bg-[#0A0A0B] border-l border-white/10 p-10 flex flex-col justify-between">
          <div className="flex flex-col gap-10">
            <div>
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[11px] uppercase tracking-[0.3em] text-gold font-bold">Investor Console</h3>
                {isEvolving && <span className="text-[9px] text-white/30 animate-pulse font-mono tracking-widest">NEURAL_MINTING...</span>}
              </div>
              
              <div className="space-y-6">
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-[11px] uppercase tracking-widest text-white/40">Next Evolution</span>
                  <span className="text-xs font-mono text-gold">{profile?.totalInvested ? ((profile.totalInvested % 20000) / 200).toFixed(0) : 0}%</span>
                </div>
                <div className="h-[2px] bg-white/5 overflow-hidden">
                  <motion.div 
                    animate={{ width: `${profile?.totalInvested ? (profile.totalInvested % 20000) / 200 : 0}%` }}
                    className="h-full bg-gold"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
               <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold">Protocol Insights</h4>
               <ul className="space-y-4">
                  {[
                    "Secondary yield via luxury hospitality leasing on the North Coast.",
                    "Dynamic asset re-rating based on blockchain throughput.",
                    "Eligibility for 10-year residency and business privileges."
                  ].map((insight, idx) => (
                    <li key={idx} className="flex gap-4 items-start">
                       <div className="w-1 h-1 bg-gold rounded-full mt-2" />
                       <p className="text-[11px] italic text-white/40 leading-relaxed">{insight}</p>
                    </li>
                  ))}
               </ul>
            </div>
          </div>

          <div className="space-y-4 mt-12">
            <button 
              disabled={!user || isEvolving}
              onClick={handleInvest}
              className="w-full py-4 bg-gold text-black font-bold text-xs uppercase tracking-[0.3em] hover:bg-gold-hover disabled:opacity-30 transition-all flex items-center justify-center gap-3"
            >
              <Wallet className="w-4 h-4" />
              Secure Allocation ($5K)
            </button>
            {!user ? (
               <button onClick={signInWithGoogle} className="w-full py-4 border border-gold/30 text-gold font-bold text-xs uppercase tracking-[0.3em] hover:bg-white/5 transition-all">
                 Initialize Protocol
               </button>
            ) : (
               <Link to="/estates" className="w-full py-4 border border-white/10 text-white/40 font-bold text-xs uppercase tracking-[0.3em] hover:text-white transition-all text-center block">
                 View Estate Catalog
               </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Estates = () => {
  const [filter, setFilter] = useState<'all' | 'prospect' | 'acquired'>('all');
  
  const estates = [
    { id: 'v1', name: "Oasis North Villa", type: "Residential", price: 1200000, adminFee: 60000, fund: 85, location: "Grand Baie", status: "prospect", img: 'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?auto=format&fit=crop&q=80&w=2070' },
    { id: 'v2', name: "Azure Heights Penthouse", type: "Residential", price: 850000, adminFee: 42500, fund: 100, location: "Tamarin", status: "acquired", img: 'https://images.unsplash.com/photo-1596701062351-8c2c14d1fcd1?auto=format&fit=crop&q=80&w=2070' },
    { id: 'c1', name: "Port Louis Commercial Node", type: "Commercial", price: 2100000, adminFee: 105000, fund: 100, location: "Port Louis", status: "acquired", img: 'https://images.unsplash.com/photo-1544735716-e3ed28230f71?auto=format&fit=crop&q=80&w=2070' },
    { id: 'v3', name: "Emerald Cove Estate", type: "Residential", price: 3400000, adminFee: 170000, fund: 12, location: "Belle Mare", status: "prospect", img: 'https://images.unsplash.com/photo-1552083375-1447ce886485?auto=format&fit=crop&q=80&w=2070' },
  ];

  const filtered = estates.filter(e => filter === 'all' || e.status === filter);

  return (
    <div className="pt-32 pb-20 max-w-7xl mx-auto px-8">
      <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
        <div>
          <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Sovereign Portfolio</h2>
          <h3 className="text-5xl font-serif italic text-white">Distributed Catalog</h3>
        </div>
        <div className="flex bg-white/5 border border-white/10 p-1">
           {['all', 'prospect', 'acquired'].map((f) => (
             <button 
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-6 py-2 text-[10px] uppercase tracking-widest transition-all ${filter === f ? 'bg-gold text-black font-bold' : 'text-white/30 hover:text-white'}`}
             >
               {f}
             </button>
           ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {filtered.map((e) => (
          <div key={e.id} className="aura-card overflow-hidden group border border-white/5 bg-[#0A0A0B]">
            <div className="h-64 overflow-hidden relative">
              <img src={e.img} alt={e.name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 grayscale opacity-40 group-hover:opacity-100 group-hover:grayscale-0" />
              <div className="absolute top-4 left-4 flex gap-2">
                 <div className="bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white/50">{e.location}</div>
                 <div className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${e.status === 'acquired' ? 'bg-green-500 text-black' : 'bg-gold text-black'}`}>
                   {e.status}
                 </div>
              </div>
            </div>
            <div className="p-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                   <h3 className="text-xl font-serif italic text-white mb-1">{e.name}</h3>
                   <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">{e.type} Node</span>
                </div>
                <div className="text-right">
                   <div className="text-gold font-mono text-lg font-bold">${(e.price / 1000000).toFixed(1)}M</div>
                   <div className="text-[9px] text-white/20 uppercase font-mono">Incl. 5% Fees</div>
                </div>
              </div>

              <div className="space-y-6 mb-10">
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Protocol Funding</span>
                  <span className="text-xs font-mono text-gold">{e.fund}%</span>
                </div>
                <div className="h-[1px] bg-white/5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${e.fund}%` }}
                    transition={{ duration: 2 }}
                    className={`h-full ${e.fund === 100 ? 'bg-green-500' : 'bg-gold'}`}
                  />
                </div>
              </div>

              {e.status === 'prospect' ? (
                <button className="w-full py-4 bg-gold text-black font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-gold-hover transition-all">
                  Initialize Acquisition
                </button>
              ) : (
                <Link to={e.type === 'Commercial' ? '/media' : '/metropolis'} className="w-full py-4 border border-green-500/30 text-green-500 font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-green-500 hover:text-black transition-all text-center block">
                  Access Node Services
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Roadmap = () => (
  <div className="pt-32 pb-20 max-w-4xl mx-auto px-8">
    <div className="text-center mb-24">
       <h2 className="text-[11px] uppercase tracking-[0.4em] font-bold text-gold mb-4">The Evolution Timeline</h2>
       <h3 className="text-6xl font-serif italic text-white flex items-center justify-center gap-4">Archive & Vision</h3>
    </div>
    
    <div className="space-y-20 relative">
      <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-white/5 ml-4 hidden md:block" />
      {[
        { phase: "Phase 1: Foundation", date: "Q2 2026", label: "Archive Protocol", items: ["AuraToken Deployment", "NFT Genesis Engine", "First 3 Estate Offerings"] },
        { phase: "Phase 2: Expansion", date: "Q4 2026", label: "Sky Node Scaling", items: ["Custom Business Creation", "Estate Governance DAO", "Secondary NFT Marketplace"] },
        { phase: "Phase 3: Residency", date: "Q2 2027", label: "Sovereign Link", items: ["Direct Mauritius Visa Integration", "Meta-Estate Construction", "Cross-Chain Liquidity Pools"] }
      ].map((p, i) => (
        <div key={i} className="relative md:pl-20">
          <div className="absolute left-0 top-0 w-8 h-8 rounded-sm bg-bg-panel border border-gold/30 flex items-center justify-center -translate-x-1/2 z-10 hidden md:flex">
             <div className="w-1 h-1 bg-gold rounded-full" />
          </div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="aura-card p-12 bg-[#0A0A0B]"
          >
            <span className="text-gold text-[10px] font-mono font-bold uppercase tracking-[0.2em] mb-4 block">{p.date} • {p.label}</span>
            <h3 className="text-3xl font-serif italic mb-8 text-white">{p.phase}</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {p.items.map((item, ii) => (
                <li key={ii} className="flex items-center gap-4 text-white/40 text-[11px] italic">
                  <div className="w-1.5 h-[1px] bg-gold/50" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      ))}
    </div>
  </div>
);

const MapPortal = () => {
  const [selectedVilla, setSelectedVilla] = useState<any>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const navigate = useNavigate();

  if (MAP_KEYS.length === 0) {
    return (
      <div className="pt-40 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="w-12 h-12 text-gold mb-6 opacity-20" />
        <h2 className="text-2xl font-serif italic text-white mb-4">Sovereign Map Locked</h2>
        <p className="text-white/40 max-w-md mx-auto italic text-sm mb-8">
          The high-resolution satellite mesh requires an active Google Maps Platform Key.
        </p>
        <div className="aura-card p-8 border-gold/20 max-w-lg mx-auto text-left">
           <p className="text-xs text-white/60 mb-4 font-bold uppercase tracking-widest">Setup Protocol:</p>
           <ol className="text-xs text-white/40 space-y-3 list-decimal pl-4">
              <li>Retrieve API Key from Google Cloud Console</li>
              <li>Open Settings (Gear Icon) → Secrets</li>
              <li>Add <code>GOOGLE_MAPS_PLATFORM_KEY</code></li>
           </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 max-w-7xl mx-auto px-8 min-h-screen">
      <div className="flex justify-between items-end mb-16">
        <div>
          <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Sovereign Coordinates</h2>
          <h3 className="text-5xl font-serif italic text-white">Island Node Network</h3>
        </div>
        <div className="text-right flex gap-10">
           <div className="flex flex-col">
              <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">Island Nodes</span>
              <span className="text-3xl font-serif text-white">{VILLAS.length}</span>
           </div>
           <div className="flex flex-col">
              <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">Network Status</span>
              <span className="text-3xl font-serif text-green-500">OPTIMAL</span>
           </div>
        </div>
      </div>

      <div className="h-[700px] border border-white/10 relative aura-card overflow-hidden">
        <MapWithFallback>
          <div className="absolute inset-x-8 top-8 z-10 pointer-events-none">
             <div className="max-w-xs bg-black/80 backdrop-blur-md border border-gold/20 p-4 pointer-events-auto">
                <p className="text-[9px] text-gold/60 uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
                   <Zap className="w-3 h-3" /> System Alert
                </p>
                <p className="text-[10px] text-white/60 italic">If the map fails to load with a "RefererNotAllowedMapError", please ensure your Google Maps API key is unrestricted or allows this domain.</p>
             </div>
          </div>
          <Map
            defaultCenter={MAURITIUS_CENTER}
            defaultZoom={10}
            mapId="AURA_MAP_ID"
            disableDefaultUI={true}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
            gestureHandling={'greedy'}
          >
            {VILLAS.map(v => (
              <AdvancedMarker 
                key={v.id} 
                position={v.coords}
                onClick={() => {
                  setSelectedVilla(v);
                  setInfoOpen(true);
                }}
              >
                <div className="relative group">
                   <div className="w-10 h-10 bg-gold rounded-full flex items-center justify-center border-4 border-black shadow-[0_0_20px_rgba(197,160,89,0.5)] group-hover:scale-110 transition-transform">
                      <Building2 className="w-4 h-4 text-black" />
                   </div>
                   <div className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {v.name}
                   </div>
                </div>
              </AdvancedMarker>
            ))}

            {infoOpen && selectedVilla && (
              <InfoWindow 
                position={selectedVilla.coords} 
                onCloseClick={() => setInfoOpen(false)}
                headerDisabled
              >
                <div className="p-4 bg-[#0A0A0B] text-white border border-white/10 w-64 -m-2">
                   <img src={selectedVilla.img} className="w-full h-32 object-cover mb-4 grayscale" alt={selectedVilla.name} />
                   <h4 className="text-lg font-serif italic mb-2">{selectedVilla.name}</h4>
                   <p className="text-[10px] text-white/50 mb-4 uppercase tracking-widest">{selectedVilla.location}</p>
                   <div className="flex justify-between items-center mb-6">
                      <span className="text-gold font-mono text-lg font-bold">${(selectedVilla.price / 1000000).toFixed(1)}M</span>
                   </div>
                   <button 
                    onClick={() => navigate(`/villa/${selectedVilla.id}`)}
                    className="w-full py-3 bg-gold text-black text-[10px] font-bold uppercase tracking-widest hover:bg-gold-hover transition-colors"
                   >
                     View Full Specifications
                   </button>
                </div>
              </InfoWindow>
            )}
          </Map>
        </MapWithFallback>
      </div>
    </div>
  );
};

const VillaDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const villa = VILLAS.find(v => v.id === id);
  const [shares, setShares] = useState(1);
  const [minting, setMinting] = useState(false);
  const [ownedNfts, setOwnedNfts] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser || !id) return;
    const path = 'ownership_nfts';
    const q = query(collection(db, path), where('ownerId', '==', auth.currentUser.uid), where('estateId', '==', id));
    return onSnapshot(q, (snap) => {
      setOwnedNfts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  }, [id]);

  if (!villa) return <div className="pt-40 text-center text-white/20">Villa not found</div>;

  const totalCost = (villa.price * (shares / 100));

  const handleMint = async () => {
    if (!auth.currentUser) {
      signInWithGoogle();
      return;
    }
    setMinting(true);
    try {
      await addDoc(collection(db, 'ownership_nfts'), {
        estateId: villa.id,
        ownerId: auth.currentUser.uid,
        sharePercentage: shares,
        mintedAt: new Date().toISOString(),
        metadata: {
          villaName: villa.name,
          location: villa.location,
          img: villa.img
        }
      });
      alert(`Success! Minted ${shares}% fractional NFT for ${villa.name}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'ownership_nfts');
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="pt-32 pb-20 max-w-7xl mx-auto px-8 min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
         <div>
            <div className="aspect-[4/5] bg-black border border-white/10 overflow-hidden aura-card sticky top-32">
               <img src={villa.img} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" alt={villa.name} />
               <div className="absolute top-6 left-6 flex gap-2">
                  <div className="bg-black/80 backdrop-blur-md border border-white/10 px-4 py-2 text-[10px] font-bold text-gold uppercase tracking-[0.2em]">Fractional Asset</div>
               </div>
            </div>
         </div>
         
         <div className="flex flex-col justify-center">
            <div className="mb-12">
               <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Node Specification</h2>
               <h3 className="text-6xl font-serif italic text-white mb-6 leading-tight">{villa.name}</h3>
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-white/30 uppercase tracking-widest text-[10px] font-bold">
                     <MapPin className="w-4 h-4 text-gold" />
                     {villa.location}, Mauritius
                  </div>
                  <div className="h-4 w-[1px] bg-white/10" />
                  <div className="text-gold font-mono text-2xl font-bold">${villa.price.toLocaleString()}</div>
               </div>
            </div>

            <div className="space-y-10 mb-16">
               <p className="text-lg text-white/50 leading-relaxed font-light italic">"{villa.desc}"</p>
               
               <div className="grid grid-cols-2 gap-8">
                  {[
                    { label: "Ownership Type", val: "Fractional / Full" },
                    { label: "Visa Eligibility", val: "Gold Approved" },
                    { label: "Project Phase", val: "Distributed Node" },
                    { label: "Metabolic Yield", val: "8.4% Est." }
                  ].map((s, i) => (
                    <div key={i} className="border-b border-white/5 pb-4">
                       <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest mb-1 block">{s.label}</span>
                       <span className="text-white text-sm italic">{s.val}</span>
                    </div>
                  ))}
               </div>
            </div>

            {/* Tokenization Interface */}
            <div className="aura-card p-10 bg-[#0A0A0B] border-gold/20 mb-10">
               <div className="flex items-center justify-between mb-8">
                  <h4 className="text-xs uppercase tracking-[0.3em] font-bold text-gold flex items-center gap-3">
                     <Zap className="w-4 h-4" /> Fractional Tokenization
                  </h4>
                  <div className="text-[10px] text-white/40 font-mono">LIQUIDITY: OPTIMAL</div>
               </div>
               
               <div className="space-y-8">
                  <div>
                     <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Share Percentage</span>
                        <span className="text-xl font-serif text-white">{shares}%</span>
                     </div>
                     <input 
                        type="range" 
                        min="1" 
                        max="100" 
                        value={shares} 
                        onChange={(e) => setShares(parseInt(e.target.value))}
                        className="w-full accent-gold bg-white/5 h-1 rounded-full appearance-none cursor-pointer"
                     />
                     <div className="flex justify-between mt-2 text-[9px] text-white/20 font-bold uppercase tracking-widest">
                        <span>1% (MIN)</span>
                        <span>100% (FULL)</span>
                     </div>
                  </div>

                  <div className="p-6 bg-white/2 border border-white/5 flex justify-between items-center">
                     <div>
                        <span className="text-[9px] text-white/30 uppercase font-bold tracking-widest block mb-1">Acquisition Cost</span>
                        <span className="text-2xl font-serif text-white">${totalCost.toLocaleString()}</span>
                     </div>
                     <div className="text-right">
                        <span className="text-[9px] text-white/30 uppercase font-bold tracking-widest block mb-1">Estimated APY</span>
                        <span className="text-2xl font-serif text-green-500">8.4%</span>
                     </div>
                  </div>

                  <button 
                    onClick={handleMint}
                    disabled={minting}
                    className="w-full py-5 bg-gold text-black font-bold text-xs uppercase tracking-[0.4em] hover:bg-gold-hover transition-all flex items-center justify-center gap-3"
                  >
                    {minting ? "MINTING_PROTOCOL_ACTIVE..." : "MINT FRACTIONAL NFT"}
                  </button>
               </div>
            </div>

            {ownedNfts.length > 0 && (
              <div className="mb-10">
                 <h4 className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/30 mb-6 flex items-center gap-3">
                    <Layers className="w-3 h-3" /> Your Fractional Stakes
                 </h4>
                 <div className="grid grid-cols-1 gap-4">
                    {ownedNfts.map(nft => (
                       <div key={nft.id} className="p-6 border border-white/5 bg-white/2 flex justify-between items-center">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 border border-gold/30 flex items-center justify-center bg-gold/5">
                                <Cpu className="w-4 h-4 text-gold" />
                             </div>
                             <div>
                                <div className="text-white text-sm font-serif italic">{nft.sharePercentage}% Ownership Node</div>
                                <div className="text-[9px] text-white/20 font-mono uppercase">{nft.id.slice(0, 12)}...</div>
                             </div>
                          </div>
                          <button className="text-gold text-[9px] uppercase font-bold tracking-widest border-b border-gold/20 pb-0.5">Manage Assets</button>
                       </div>
                    ))}
                 </div>
              </div>
            )}

            <div className="flex gap-6">
               <button className="flex-1 py-5 border border-white/10 text-white/50 font-bold text-xs uppercase tracking-[0.4em] hover:bg-white/5 transition-all">
                  Contact Specialist
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

const GroceryStore = () => {
  const [cart, setCart] = useState<any[]>([]);
  const items = [
    { id: 1, name: 'Artisan Island Fruit', price: 24, category: 'Fresh', img: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=2070' },
    { id: 2, name: 'Premium Espresso Roast', price: 45, category: 'Pantry', img: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=2070' },
    { id: 3, name: 'Mauritian Spice Blend', price: 18, category: 'Spices', img: 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&q=80&w=2070' },
    { id: 4, name: 'Golden Honey Reserve', price: 89, category: 'Elite', img: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=2070' }
  ];

  const total = cart.reduce((acc, curr) => acc + curr.price, 0);

  return (
    <div className="pt-32 pb-20 max-w-7xl mx-auto px-8 min-h-screen">
      <div className="flex justify-between items-end mb-16">
        <div>
          <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Metropolis Provisions</h2>
          <h3 className="text-5xl font-serif italic text-white">Sovereign Grocery</h3>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-right">
              <span className="text-[10px] text-white/30 uppercase tracking-[0.2em]">Total</span>
              <div className="text-3xl font-serif text-gold">${total}</div>
           </div>
           <button className="w-16 h-16 bg-gold text-black flex items-center justify-center relative">
              <ShoppingBag className="w-6 h-6" />
              {cart.length > 0 && <span className="absolute top-3 right-3 w-4 h-4 bg-black text-white text-[9px] flex items-center justify-center rounded-full">{cart.length}</span>}
           </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {items.map(i => (
          <div key={i.id} className="aura-card p-6 bg-[#0A0A0B]">
            <img src={i.img} alt={i.name} className="w-full h-48 object-cover mb-6 grayscale hover:grayscale-0 transition-all" />
            <h4 className="text-lg font-serif italic mb-4">{i.name}</h4>
            <div className="flex justify-between items-center">
              <span className="text-gold font-mono">${i.price}</span>
              <button onClick={() => setCart([...cart, i])} className="p-2 border border-white/10 hover:border-gold transition-all"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MediaHub = ({ user }: { user: User | null }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"cinema" | "chat">("chat");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(20));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse());
    });
  }, [user]);

  const handleSend = async (e: any) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    await addDoc(collection(db, "messages"), {
      senderId: user.uid,
      senderName: user.displayName,
      content: newMessage,
      theme: "General",
      timestamp: serverTimestamp()
    });
    setNewMessage("");
  };

  return (
    <div className="pt-32 pb-20 max-w-7xl mx-auto px-8 min-h-screen">
      <div className="flex justify-between items-end mb-16">
        <h3 className="text-5xl font-serif italic text-white flex items-center gap-8">
           Media Hub
           <div className="flex gap-2 p-1 bg-white/5 border border-white/10">
              <button onClick={() => setActiveTab('chat')} className={`px-6 py-2 text-[10px] uppercase tracking-widest ${activeTab === 'chat' ? 'bg-gold text-black' : 'text-white/30'}`}>Chat</button>
              <button onClick={() => setActiveTab('cinema')} className={`px-6 py-2 text-[10px] uppercase tracking-widest ${activeTab === 'cinema' ? 'bg-gold text-black' : 'text-white/30'}`}>Cinema</button>
           </div>
        </h3>
      </div>
      <div className="h-[600px] border border-white/10 overflow-hidden flex">
        {activeTab === 'chat' ? (
          <div className="flex-1 flex flex-col bg-[#0A0A0B]">
            <div className="flex-1 p-10 overflow-y-auto space-y-4">
              {messages.map(m => (
                <div key={m.id} className={`flex flex-col ${m.senderId === user?.uid ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-white/30 mb-1">{m.senderName}</span>
                  <div className="p-4 bg-white/5 border border-white/10 text-sm italic italic">"{m.content}"</div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSend} className="p-6 border-t border-white/10 flex gap-4">
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)} className="flex-1 bg-transparent border border-white/10 px-4 py-2" placeholder="Signal..." />
              <button className="px-6 bg-gold text-black uppercase text-[10px] font-bold">Send</button>
            </form>
          </div>
        ) : (
          <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-4xl">
              <LiveObservatory />
            </div>
            <div className="mt-8 text-center">
              <p className="text-white/40 text-xs tracking-widest uppercase italic font-bold">Node Stream: Mauritius Archipelago Observation Axis</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Citadel = ({ user, profile }: { user: User | null, profile: any }) => {
  const isEligible = (profile?.totalInvested || 0) >= 1000000 || profile?.hasGoldPass;
  const navigate = useNavigate();

  const buyGoldPass = async () => {
    if (!user || !profile) return;
    const cost = 60000; // 24 ETH equivalent in Aura for demo
    if (profile.auraBalance < cost) {
       alert("Insufficient AURA. Entry protocol requires 24 ETH equivalent.");
       return;
    }
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
       auraBalance: increment(-cost),
       hasGoldPass: true
    });
  };

  if (!user) {
    return (
      <div className="pt-40 text-center">
         <Lock className="w-12 h-12 text-gold mx-auto mb-6 opacity-20" />
         <p className="text-white/40 italic">Initialize protocol to view the Citadel Axis.</p>
      </div>
    );
  }

  if (!isEligible) {
    return (
      <div className="pt-40 pb-20 max-w-4xl mx-auto px-8 text-center min-h-[70vh] flex flex-col justify-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gold/5 border border-gold/20 rounded-full mx-auto mb-10 shadow-[0_0_50px_rgba(197,160,89,0.1)]">
           <Crown className="w-8 h-8 text-gold" />
        </div>
        <h2 className="text-sm uppercase tracking-[0.5em] font-bold text-gold mb-6">Restricted Access</h2>
        <h3 className="text-5xl font-serif italic text-white mb-10">The Private Citadel</h3>
        <p className="text-lg text-white/40 mb-14 leading-relaxed max-w-2xl mx-auto font-light">
          "Exclusivity is the true currency of the Metropolis. Entry is reserved for Sovereign Citizens or holders of the Gold Citadel Pass."
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
           <div className="aura-card p-10 bg-[#0A0A0B] border-gold/10 text-left">
              <h4 className="text-xl font-serif italic text-white mb-4">Sovereign Citizenship</h4>
              <p className="text-xs text-white/30 mb-8 leading-relaxed uppercase tracking-widest">Invest $1.0M in island nodes to unlock perpetual access and Gold Visa eligibility.</p>
              <button 
                onClick={() => navigate('/estates')}
                className="w-full py-4 border border-gold/40 text-gold font-bold text-[10px] uppercase tracking-widest hover:bg-gold hover:text-black transition-all"
              >
                Expand Portfolio
              </button>
           </div>
           
           <div className="aura-card p-10 bg-[#0A0A0B] border-white/5 text-left relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                 <Zap className="w-20 h-20 text-gold" />
              </div>
              <h4 className="text-xl font-serif italic text-white mb-4">Citadel Gold Pass</h4>
              <p className="text-xs text-white/30 mb-8 leading-relaxed uppercase tracking-widest">Direct admission for visitors. Instant metabolic privileges and private lounge access.</p>
              <div className="flex justify-between items-end mb-6">
                 <div className="text-2xl font-serif text-white">24 ETH</div>
                 <div className="text-[10px] text-gold font-mono uppercase tracking-widest">≈ 60,000 AURA</div>
              </div>
              <button 
                onClick={buyGoldPass}
                className="w-full py-4 bg-gold text-black font-bold text-[10px] uppercase tracking-widest hover:bg-gold-hover transition-all"
              >
                Acquire Pass
              </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 max-w-7xl mx-auto px-8">
      <div className="flex justify-between items-end mb-16">
        <div>
           <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Sovereign Axis</h2>
           <h3 className="text-5xl font-serif italic text-white">The Citadel Club</h3>
        </div>
        <div className="flex items-center gap-4 bg-green-500/10 border border-green-500/20 px-6 py-3">
           <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
           <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Entry Validated</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {[
          { title: "Deep Liquidity Venue", desc: "Private off-mesh trading for high-volume island assets and NFT blocks.", icon: TrendingUp },
          { title: "Governance Council", desc: "Direct voting rights on urban scaling and node prioritization in the North sector.", icon: Gavel },
          { title: "Counselor Briefings", desc: "Confidential sessions with top-tier Mauritian legal and investment metabolic agents.", icon: MessageCircle }
        ].map((item, i) => (
          <div key={i} className="aura-card p-12 bg-[#0A0A0B] hover:border-gold/30 transition-all group">
            <item.icon className="w-10 h-10 text-gold mb-12 group-hover:scale-110 transition-transform" />
            <h4 className="text-2xl font-serif italic text-white mb-6 underline underline-offset-8 decoration-gold/10">{item.title}</h4>
            <p className="text-white/40 text-sm leading-relaxed italic leading-relaxed">"{item.desc}"</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const Gallery = () => (
  <div className="pt-32 pb-20 max-w-7xl mx-auto px-8 min-h-screen">
    <div className="mb-16">
      <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Digital Archive</h2>
      <h3 className="text-5xl font-serif italic text-white flex items-center gap-6">
        Metropolis Art Market
        <div className="px-4 py-1.5 bg-gold/10 border border-gold/20 text-gold text-[10px] uppercase font-bold tracking-widest">
           Curated Selection
        </div>
      </h3>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="aura-card aspect-[4/5] relative overflow-hidden group bg-[#0A0A0B] border border-white/5">
          <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-10 group-hover:opacity-30 transition-opacity" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Layers className="w-24 h-24 text-white/5 group-hover:scale-110 group-hover:text-gold/10 transition-all duration-700" />
          </div>
          
          <div className="absolute inset-x-6 bottom-6 p-6 bg-black/60 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
             <div className="text-[9px] text-gold font-mono tracking-widest uppercase mb-2 font-bold">NODE_ARCHIVE_0{i}</div>
             <div className="text-xl font-serif italic text-white mb-4">Metabolic Evolution #{1024 + i}</div>
             <div className="flex justify-between items-center">
                <span className="text-white/40 text-[10px] font-mono">EST: 2.4 ETH</span>
                <button className="px-4 py-2 bg-gold text-black text-[9px] font-bold uppercase tracking-widest">Bid Now</button>
             </div>
          </div>

          <div className="absolute top-6 right-6">
             <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <Sparkles className="w-3 h-3 text-gold/50" />
             </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Dashboard = ({ user, profile, auraBalance }: { user: User | null, profile: any, auraBalance: number }) => {
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const path = 'ownership_nfts';
    const q = query(collection(db, path), where('ownerId', '==', user.uid));
    return onSnapshot(q, (snap) => {
      setNfts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  }, [user]);

  if (!user) return <div className="pt-40 text-center text-white/20">Protocol initialization required.</div>;

  return (
    <div className="pt-32 pb-20 max-w-7xl mx-auto px-8 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
        <div>
          <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Metropolis Registry</h2>
          <h3 className="text-5xl font-serif italic text-white flex items-center gap-6">
            Sovereign Dashboard
            <div className="px-4 py-1 bg-gold/10 border border-gold/30 text-gold text-[10px] font-bold uppercase tracking-widest">Metabolic Level: {profile?.hasGoldVisaEligibility ? "ELITE" : "MEMBER"}</div>
          </h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-2 gap-10">
           <div className="text-right">
              <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mb-2 block">Total Invested</span>
              <div className="text-3xl font-serif text-white">${profile?.totalInvested?.toLocaleString() || '0'}</div>
           </div>
           <div className="text-right">
              <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mb-2 block">AURA Assets</span>
              <div className="text-3xl font-serif text-gold">{auraBalance.toFixed(2)}</div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
           <section className="mb-16">
              <h4 className="text-xs uppercase tracking-[0.3em] font-bold text-white/20 mb-8 flex items-center gap-4">
                 <Building2 className="w-4 h-4" /> Real Estate Assets (NFT Stakes)
              </h4>
              
              {loading ? (
                <div className="h-40 flex items-center justify-center text-white/20 italic">Scanning decentralized registry...</div>
              ) : nfts.length === 0 ? (
                <div className="aura-card p-12 bg-[#0A0A0B] text-center border-dashed border-white/10">
                   <p className="text-white/40 italic mb-8">"No property nodes linked to this identity protocol."</p>
                   <Link to="/map" className="inline-block py-4 px-10 bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:border-gold transition-all">Explore Node Network</Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {nfts.map((nft) => (
                      <div key={nft.id} className="aura-card bg-[#0A0A0B] overflow-hidden group">
                         <div className="h-40 relative">
                            <img src={nft.metadata?.img} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                            <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md px-3 py-1 border border-white/10 text-[9px] text-gold font-bold uppercase tracking-widest">
                               {nft.sharePercentage}% NODE STAKE
                            </div>
                         </div>
                         <div className="p-8">
                            <h5 className="text-xl font-serif italic text-white mb-2">{nft.metadata?.villaName}</h5>
                            <p className="text-[10px] text-white/40 mb-6 uppercase tracking-widest">{nft.metadata?.location}</p>
                            <div className="flex justify-between items-center pt-6 border-t border-white/5">
                               <div className="flex items-center gap-2">
                                  <Cpu className="w-3 h-3 text-gold/50" />
                                  <span className="text-[9px] font-mono text-white/20 uppercase">{nft.id.slice(0, 16)}...</span>
                               </div>
                               <button className="text-gold text-[9px] font-bold uppercase tracking-widest hover:underline">Marketplace</button>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
              )}
           </section>

           <section>
              <h4 className="text-xs uppercase tracking-[0.3em] font-bold text-white/20 mb-8 flex items-center gap-4">
                 <Trophy className="w-4 h-4" /> Residency Milestones
              </h4>
              <div className="space-y-6">
                 {[
                   { label: "Identity Verified", status: "COMPLETED", date: "System Entry" },
                   { label: "First Stake Acquired", status: nfts.length > 0 ? "COMPLETED" : "PENDING", date: nfts.length > 0 ? "Verified" : "--" },
                   { label: "Portfolio Threshold ($1.0M)", status: (profile?.totalInvested || 0) >= 1000000 ? "COMPLETED" : "IN PROGRESS", date: `${((profile?.totalInvested || 0) / 10000).toFixed(1)}%` },
                   { label: "Gold Visa Fast-Track", status: (profile?.totalInvested || 0) >= 1000000 ? "READY" : "LOCKED", date: "Priority Access" }
                 ].map((m, i) => (
                   <div key={i} className="flex justify-between items-center p-6 bg-[#0A0A0B] border border-white/5 hover:border-gold/20 transition-all">
                      <div className="flex items-center gap-6">
                         <div className={`w-3 h-3 rounded-full ${m.status === 'COMPLETED' ? 'bg-green-500 shadow-[0_0_100px_rgba(34,197,94,0.3)]' : 'bg-white/10'}`} />
                         <div>
                            <div className="text-white text-sm font-serif italic">{m.label}</div>
                            <div className="text-[9px] text-white/20 font-bold uppercase tracking-widest">{m.date}</div>
                         </div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${m.status === 'COMPLETED' || m.status === 'READY' ? 'text-gold' : 'text-white/10'}`}>{m.status}</span>
                   </div>
                 ))}
              </div>
           </section>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <div className="aura-card p-10 bg-gold/5 border-gold/30">
              <Sparkles className="w-8 h-8 text-gold mb-8" />
              <h4 className="text-2xl font-serif italic text-white mb-4">Sovereign Benefits</h4>
              <p className="text-sm text-white/50 leading-relaxed italic mb-8">
                 "As a Metropolis Citizen, your assets generate metabolic yield while paving the way for perpetual residency in Mauritius."
              </p>
              <ul className="space-y-4 mb-10">
                 <li className="flex gap-4 text-xs italic text-white/40">
                    <Zap className="w-4 h-4 text-gold flex-shrink-0" />
                    Priority access to new Node launches.
                 </li>
                 <li className="flex gap-4 text-xs italic text-white/40">
                    <Zap className="w-4 h-4 text-gold flex-shrink-0" />
                    Direct council voting privileges.
                 </li>
              </ul>
              <button className="w-full py-4 border border-gold text-gold text-[10px] uppercase font-bold tracking-widest hover:bg-gold hover:text-black transition-all">Print Passport</button>
           </div>
        </div>
      </div>
    </div>
  );
};

const PageWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [auraBalance, setAuraBalance] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      
      // Cleanup previous profile listener if exists
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (u) {
        const userRef = doc(db, 'users', u.uid);
        
        // Use onSnapshot for real-time balance and profile tracking
        unsubProfile = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
             const data = snap.data();
             setProfile(data);
             setAuraBalance(data.auraBalance || 0);
          } else {
             setDoc(userRef, {
               uid: u.uid,
               displayName: u.displayName || 'Sovereign Citizen',
               photoURL: u.photoURL,
               totalInvested: 0,
               auraBalance: 100, // Initial welcome grant
               hasGoldVisaEligibility: false,
               hasGoldPass: false,
               createdAt: new Date().toISOString()
             }).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${u.uid}`));
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
        });
      } else {
        setProfile(null);
        setAuraBalance(0);
      }
    });

    // Simulate metabolic mining for demo
    const interval = setInterval(() => {
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        updateDoc(userRef, {
          auraBalance: increment(0.01)
        }).catch(() => {}); // Squelch noise during logout
      }
    }, 10000);

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen font-sans">
      <Navbar user={user} auraBalance={auraBalance} />
      
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<PageWrapper><Landing /></PageWrapper>} />
          <Route path="/metropolis" element={<PageWrapper><Metropolis user={user} profile={profile} auraBalance={auraBalance} /></PageWrapper>} />
          <Route path="/estates" element={<PageWrapper><Estates /></PageWrapper>} />
          <Route path="/roadmap" element={<PageWrapper><Roadmap /></PageWrapper>} />
          <Route path="/market" element={<PageWrapper><Gallery /></PageWrapper>} />
          <Route path="/map" element={<PageWrapper><MapPortal /></PageWrapper>} />
          <Route path="/grocery" element={<PageWrapper><GroceryStore /></PageWrapper>} />
          <Route path="/media" element={<PageWrapper><MediaHub user={user} /></PageWrapper>} />
          <Route path="/citadel" element={<PageWrapper><Citadel user={user} profile={profile} /></PageWrapper>} />
          <Route path="/villa/:id" element={<PageWrapper><VillaDetails /></PageWrapper>} />
          <Route path="/dashboard" element={<PageWrapper><Dashboard user={user} profile={profile} auraBalance={auraBalance} /></PageWrapper>} />
        </Routes>
      </AnimatePresence>

      <footer className="py-20 bg-black border-t border-white/5 mt-20">
        <div className="max-w-7xl mx-auto px-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full border border-gold flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-gold rounded-full" />
                </div>
                <span className="text-xl font-serif italic text-white tracking-widest">METROPOLIS</span>
              </div>
              <p className="text-white/30 text-[10px] leading-relaxed max-w-sm italic uppercase tracking-wider">
                The world's first sovereign real-estate ecosystem, blending sub-tropical sanctuary with hyper-efficient digital capital.
              </p>
            </div>
            <div>
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-gold mb-6">Navigation</h4>
              <ul className="space-y-4 text-[10px] text-white/40 font-medium uppercase tracking-widest">
                <li className="hover:text-gold cursor-pointer transition-colors">Economic Node</li>
                <li className="hover:text-gold cursor-pointer transition-colors">Residential Axis</li>
                <li className="hover:text-gold cursor-pointer transition-colors">Governance API</li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-gold mb-6">System Protocol</h4>
              <p className="text-[9px] text-white/20 uppercase tracking-[0.2em] leading-loose">
                SYSTEM STATUS: <span className="text-green-500">NEURAL-MINT ACTIVE</span> <br />
                TPS: 144,002 | LATENCY: 12MS <br />
                MAURITIUS HUB IP: 197.224.0.0/14
              </p>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
            <div className="flex-1">
              <p className="text-[9px] text-white/40 uppercase tracking-[0.2em] font-medium mb-4">
                © 2026 GEOMETROPOLIS PROTOCOL. ALL ASSETS ARE BACKED BY GOLD REQUISITIONS.
              </p>
              <div className="flex gap-6 text-[9px] uppercase tracking-widest text-white/20">
                 <a href="#" className="hover:text-gold transition-colors">Whitepaper</a>
                 <a href="#" className="hover:text-gold transition-colors">Digital Constitution</a>
                 <a href="#" className="hover:text-gold transition-colors">Privacy Node</a>
              </div>
            </div>
            <div className="lg:max-w-xl text-left lg:text-right">
              <p className="text-[8px] text-white/20 uppercase tracking-[0.15em] leading-loose font-bold">
                Intellectual Property & Legal Notice: All source code, architectural logic, visual components, proprietary algorithms, and UI/UX patterns within this platform are the exclusive intellectual property of AuraMetropolis. 
                Unauthorized use, reproduction, reverse engineering, adaptation, or redistribution of any part of this system is strictly prohibited. 
                Any individual or entity found using components of this platform without explicit authorization will be subject to civil prosecution for damages to the fullest extent of the law.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
