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
    name: "Metropolis North Sanctuary", 
    type: "Residential Node", 
    price: 1250000, 
    location: "Grand Baie", 
    coords: { lat: -20.0101, lng: 57.5802 },
    img: 'https://images.unsplash.com/photo-1589519160732-57fc498494f8?auto=format&fit=crop&q=80&w=2070',
    desc: "A futuristic smart-villa integrated with the Aura Mesh, offering 100% renewable energy and high-speed satellite uplink. Managed by the Citadel Logistics Node."
  },
  { 
    id: 'az-2', 
    name: "Ebène Cybercity Tower", 
    type: "Commercial Node", 
    price: 4850000, 
    location: "Ebène", 
    coords: { lat: -20.2425, lng: 57.4883 },
    img: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&q=80&w=2070',
    desc: "The heartbeat of Mauritian Fintech. A multi-tenant digital hub for global corporations and AI startups. High-yield commercial asset."
  },
  { 
    id: 'pl-1', 
    name: "Royal Port Louis Waterfront", 
    type: "Hospitality Node", 
    price: 3100000, 
    location: "Port Louis", 
    coords: { lat: -20.1609, lng: 57.5050 },
    img: 'https://images.unsplash.com/photo-1544731612-de7f96afe55f?auto=format&fit=crop&q=80&w=2070',
    desc: "A luxury hospitality asset at the center of the financial district, yielding high metabolic returns through business stays and global conferencing."
  },
  { 
    id: 'em-3', 
    name: "Le Morne Sovereign Estate", 
    type: "Exclusive Node", 
    price: 8400000, 
    location: "Le Morne", 
    coords: { lat: -20.4500, lng: 57.3200 },
    img: 'https://images.unsplash.com/photo-1589330273594-fade1ee91647?auto=format&fit=crop&q=80&w=2070',
    desc: "Ultra-high-net-worth sanctuary at the foot of the historic Le Morne mountain. The pinnacle of Mauritian prestige and history."
  }
];

const ART_MARKET = [
  { id: 'art-1', title: "Ethereal Dodo", artist: "Inspired by Vaco", price: 4500, img: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=2070", desc: "A vibrant tribute to the island's lost emblem, blending traditional colors with metabolic digital textures. Featured at the Sapna Gallery." },
  { id: 'art-2', title: "Sugarcane Sunset", artist: "Mauritian Collective", price: 2800, img: "https://images.unsplash.com/photo-1518998053502-53cc83b9ceb1?auto=format&fit=crop&q=80&w=2070", desc: "Abstract representation of the vast sugarcane fields of the North during the golden hour. A staple of Mauritian contemporary art." },
  { id: 'art-3', title: "Metropolis Grid 01", artist: "Aura AI Artist", price: 1200, img: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=2070", desc: "Generative art mapping the metabolic flows of Ebène Cybercity's data infrastructure. Part of the Phygital asset series." }
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
  console.error('[Metropolis Protocol Error]', JSON.stringify(errInfo));
  // We no longer throw here to prevent app crash loops. 
  // Instead, we just log it for system diagnosis.
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
    { url: "https://images.unsplash.com/photo-1534067783941-51c9c23eccfd", label: "Le Morne UNESCO Heritage", type: "Sanctuary of High Prestige" },
    { url: "https://images.unsplash.com/photo-1514565131-fce0801e5785", label: "Ebène Cybercity by Night", type: "The Metabolic Financial Axis" },
    { url: "https://images.unsplash.com/photo-1544731211-0903347fdaa4", label: "Port Louis Port Authority", type: "Global Logistics Hub" },
    { url: "https://images.unsplash.com/photo-1552083375-1447ce886485", label: "Grand Baie Yacht Club", type: "Elite Lifestyle Node" },
  ];

  return (
    <section className="py-32">
       <div className="flex flex-col md:flex-row justify-between items-end mb-16 px-8 gap-8">
          <div>
            <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Sovereign Visuals</h2>
            <h3 className="text-5xl font-serif italic text-white leading-tight">Mauritius: The Silicon <br /> Island of the South</h3>
          </div>
          <div className="max-w-md text-right">
             <p className="text-xs text-white/40 italic leading-relaxed">
               "Strategically positioned between Africa and Asia, Mauritius offers more than just postcard views. It is a metabolic hub of high-speed connectivity, fiscal security, and unrivaled quality of life."
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
               <img src={img.url} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" alt={img.label} referrerPolicy="no-referrer" />
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
  const [showAuthOptions, setShowAuthOptions] = useState(false);
  
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
          <Link to="/market" className="tracking-archive text-white/50 hover:text-white transition-colors">Art Market</Link>
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
            <div className="relative">
              <button 
                onClick={() => setShowAuthOptions(!showAuthOptions)}
                className="px-6 py-2 border border-gold/30 rounded-none text-[10px] tracking-widest text-gold hover:bg-gold hover:text-black transition-all font-bold uppercase"
              >
                Access Hub
              </button>
              
              <AnimatePresence>
                {showAuthOptions && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-12 right-0 w-64 bg-[#0A0A0B] border border-white/10 p-4 shadow-2xl flex flex-col gap-2"
                  >
                    <button onClick={signInWithGoogle} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white text-[9px] uppercase tracking-widest font-bold flex items-center gap-3 px-4 border border-white/5">
                      <Globe className="w-3 h-3 text-gold" /> Google / Email
                    </button>
                    <button onClick={() => alert('Web3 Mail initialization...')} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white text-[9px] uppercase tracking-widest font-bold flex items-center gap-3 px-4 border border-white/5">
                      <MessageCircle className="w-3 h-3 text-gold" /> Web3 Mail (EtherMail)
                    </button>
                    <button onClick={() => alert('Wallet Connect requested...')} className="w-full py-3 bg-gold text-black text-[9px] uppercase tracking-widest font-bold flex items-center gap-3 px-4 border border-gold">
                      <Wallet className="w-3 h-3" /> Connect Wallet
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
            <span className="text-[10px] tracking-[0.5em] text-gold uppercase font-bold">Aura Metropolis Protocol</span>
          </div>
          
          <h1 className="text-7xl md:text-[7rem] font-serif italic mb-10 leading-[0.85] text-white tracking-tighter">
            Mauritius <br />
            <span className="text-gold not-italic uppercase font-bold text-6xl md:text-7xl tracking-widest block mt-4">Metropolis</span>
          </h1>

          <div className="max-w-xl space-y-8 mb-16">
            <p className="text-xl text-white/60 leading-relaxed font-light italic border-l border-gold/30 pl-6">
              "The 2026 Golden Visa introduces a 5-day fast-track residency for global leaders. Aura Metropolis is a multi-platform ecosystem enabling fractional property ownership, secure grocery provision, and elite art curation. Access the Mesh via standard Email, encrypted Web3 Mail (EtherMail), or direct Wallet Connection."
            </p>
          </div>

          <div className="flex flex-wrap gap-8 items-center pt-8 border-t border-white/5">
            <Link to="/metropolis" className="group bg-gold text-black px-12 py-6 font-bold text-xs uppercase tracking-[0.4em] hover:bg-gold-hover transition-all flex items-center gap-4">
              Connect to Mesh
              <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
            </Link>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/20 uppercase font-bold tracking-widest">Platform Utility</span>
              <span className="text-xl font-serif text-white">4 Main Nodes <span className="text-gold/50 text-xs italic">Property, Art, Food, Citizenship</span></span>
            </div>
          </div>
        </motion.div>

        <div className="relative">
           <div className="aspect-[4/5] bg-black border border-white/10 relative overflow-hidden group">
              <img src="https://images.unsplash.com/photo-1544731612-de7f96afe55f?auto=format&fit=crop&q=80&w=2070" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[20s] ease-linear grayscale group-hover:grayscale-0" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              
              <div className="absolute bottom-10 left-10 space-y-4">
                 <div className="flex gap-4">
                   <div className="px-4 py-2 bg-black/80 backdrop-blur-md border border-white/10 text-white font-mono text-[10px] uppercase">Corporate Status: Hub of Africa</div>
                   <div className="px-4 py-2 bg-gold text-black font-bold text-[10px] uppercase">Investor Safe Haven</div>
                 </div>
                 <h2 className="text-3xl font-serif italic text-white">Ebène Cybercity Axis</h2>
                 <p className="text-[10px] text-white/40 italic max-w-xs uppercase tracking-widest">Representing the pinnacle of digital infrastructure in the Southern hemisphere.</p>
              </div>
           </div>
        </div>
      </div>

      {/* Functionality Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-32">
        {[
          { icon: Building2, title: "Sovereign Estates", desc: "Fractionalize high-value Mauritian real estate into liquid NFTs. Own a piece of paradise for as little as $5K." },
          { icon: ShoppingBag, title: "Art Marketplace", desc: "A curated digital gallery of contemporary Mauritian fine art, sculptures, and digital metabolic assets." },
          { icon: ShoppingCart, title: "Groceries Node", desc: "On-mesh provision of premium local and international goods, secured by Citadel logistics." },
          { icon: Crown, title: "Citadel Citizenship", desc: "Unlock the 2026 Golden Visa through cumulative mesh investment. 5-day residency fast-track." }
        ].map((feat, idx) => (
          <div key={idx} className="aura-card p-8 bg-[#0A0A0B] border-white/5 flex flex-col gap-6 group hover:border-gold/20 transition-all">
            <feat.icon className="w-8 h-8 text-gold opacity-50 group-hover:opacity-100 transition-opacity" />
            <h4 className="text-lg font-serif italic text-white">{feat.title}</h4>
            <p className="text-xs text-white/40 leading-relaxed uppercase tracking-widest">{feat.desc}</p>
          </div>
        ))}
      </div>

      {/* Visa Tiers & Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-32">
        <div className="aura-card p-12 bg-[#0A0A0B] border-gold/20">
          <Crown className="w-10 h-10 text-gold mb-8" />
          <h3 className="text-3xl font-serif italic text-white mb-6">The 2026 Residency Protocol</h3>
          <ul className="space-y-6">
            <li className="flex gap-4">
              <div className="w-1.5 h-1.5 bg-gold rounded-full mt-2" />
              <div>
                <span className="text-white font-bold block mb-1">Golden Visa Admission (US$1.0M)</span>
                <span className="text-white/40 text-xs uppercase tracking-widest">Achieve high-net-worth status through property, art, or direct treasury allocation.</span>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-1.5 h-1.5 bg-gold rounded-full mt-2" />
              <div>
                <span className="text-white font-bold block mb-1">Standard Residency ($375K)</span>
                <span className="text-white/40 text-xs uppercase tracking-widest">Entry-level mesh acquisition for long-term sustainable living.</span>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-1.5 h-1.5 bg-gold rounded-full mt-2" />
              <div>
                <span className="text-white font-bold block mb-1">Metabolic Tax Status</span>
                <span className="text-white/40 text-xs uppercase tracking-widest">15% Flat Corporate Tax, 0% Inheritance Tax, 100% Repatriation.</span>
              </div>
            </li>
          </ul>
        </div>

        <div className="aura-card p-12 bg-[#0A0A0B] border-white/10">
          <TrendingUp className="w-10 h-10 text-gold mb-8" />
          <h3 className="text-3xl font-serif italic text-white mb-6">Aura Tokenomics</h3>
          <ul className="space-y-6">
            <li className="flex gap-4">
              <div className="w-1.5 h-1.5 bg-white/20 rounded-full mt-2" />
              <div>
                <span className="text-white font-bold block mb-1">Total Supply: 1,000,000,000 AURA</span>
                <span className="text-white/40 text-xs uppercase tracking-widest">Fixed supply protocol ensuring scarcity and value retention.</span>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-1.5 h-1.5 bg-white/20 rounded-full mt-2" />
              <div>
                <span className="text-white font-bold block mb-1">80% Property Collateralized</span>
                <span className="text-white/40 text-xs uppercase tracking-widest">Token value is anchored to the prime real-estate index of Mauritius.</span>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-1.5 h-1.5 bg-white/20 rounded-full mt-2" />
              <div>
                <span className="text-white font-bold block mb-1">Metabolic Deflation</span>
                <span className="text-white/40 text-xs uppercase tracking-widest">2% transaction fee burned on every mesh exchange (Art/Grocery/Land).</span>
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

      {/* Visual Context Summary */}
      <div className="mb-32 p-12 bg-white/2 border border-white/5 aura-card">
         <h4 className="text-[10px] text-gold uppercase tracking-[0.4em] font-bold mb-8 italic flex items-center gap-2">
           <Zap className="w-3 h-3" /> Photographic Narratives for Global Investors
         </h4>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
               <h5 className="text-white font-serif italic mb-4">Metropolitan Infrastructure & Prestige</h5>
               <p className="text-xs text-white/50 leading-relaxed italic">
                 The visuals across Aura Metropolis are carefully selected to demonstrate the dual nature of Mauritius. 
                 The towering glass structures of **Ebène Cybercity** represent a stable, high-tech financial district 
                 comparable to Singapore or Dubai. Simultaneously, the **UNESCO heritage of Le Morne Brabant** 
                 communicates an unshakeable legacy and the island's unique position as a sanctuary of both 
                 history and progress. For the investor, these represent **Asset Stability** and **Cultural Capital**.
               </p>
            </div>
            <div>
               <h5 className="text-white font-serif italic mb-4">Luxury Lifestyle & Fiscal Security</h5>
               <p className="text-xs text-white/50 leading-relaxed italic">
                 Images of the **Grand Baie coastline** and **elite art pieces** serve as proxies for the high-end 
                 lifestyle utility available to Sovereign Citizens. The art marketplace items—ranging from 
                 traditional island motifs to abstract digital renders—signal a market that is mature, 
                 diversified, and ready for blockchain-backed asset appreciation. This is the **Metropolis Promise**: 
                 Total integration of lifestyle and ledger.
               </p>
            </div>
         </div>
      </div>

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
  const [filter, setFilter] = useState<'all' | 'Residential Node' | 'Hospitality Node' | 'Commercial Node' | 'Exclusive Node'>('all');
  
  const filtered = VILLAS.filter(v => filter === 'all' || v.type === filter);

  return (
    <div className="pt-32 pb-20 max-w-7xl mx-auto px-8">
      <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
        <div>
          <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Sovereign Portfolio</h2>
          <h3 className="text-5xl font-serif italic text-white">Metropolitan Assets</h3>
        </div>
        <div className="flex flex-wrap bg-white/5 border border-white/10 p-1">
           {['all', 'Residential Node', 'Hospitality Node', 'Commercial Node', 'Exclusive Node'].map((f) => (
             <button 
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 text-[8px] uppercase tracking-widest transition-all ${filter === f ? 'bg-gold text-black font-bold' : 'text-white/30 hover:text-white'}`}
             >
               {f.replace(' Node', '')}
             </button>
           ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {filtered.map((e) => (
          <div key={e.id} className="aura-card overflow-hidden group border border-white/5 bg-[#0A0A0B] flex flex-col h-full">
            <div className="h-64 overflow-hidden relative">
              <img src={e.img} alt={e.name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 grayscale opacity-40 group-hover:opacity-100 group-hover:grayscale-0" referrerPolicy="no-referrer" />
              <div className="absolute top-4 left-4 flex gap-2">
                 <div className="bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white/50">{e.location}</div>
                 <div className="bg-gold text-black px-3 py-1 text-[9px] font-bold uppercase tracking-widest">
                   Live Asset
                 </div>
              </div>
            </div>
            <div className="p-10 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div>
                   <h3 className="text-xl font-serif italic text-white mb-1">{e.name}</h3>
                   <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">{e.type}</span>
                </div>
                <div className="text-right">
                   <div className="text-gold font-mono text-lg font-bold">${(e.price / 1000000).toFixed(1)}M</div>
                   <div className="text-[9px] text-white/20 uppercase font-mono tracking-tighter italic">Secured Node</div>
                </div>
              </div>

              <p className="text-xs text-white/40 italic leading-relaxed mb-8 flex-1">"{e.desc}"</p>

              <div className="space-y-6 mb-10">
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Protocol Funding</span>
                  <span className="text-xs font-mono text-gold">100%</span>
                </div>
                <div className="h-[1px] bg-white/5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `100%` }}
                    transition={{ duration: 2 }}
                    className="h-full bg-green-500"
                  />
                </div>
              </div>

              <Link to={`/villa/${e.id}`} className="w-full py-4 bg-gold text-black font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-gold-hover transition-all text-center block">
                Initialize Asset View
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const GroceryStore = () => {
  const [cart, setCart] = useState<any[]>([]);
  const items = [
    { id: 1, name: 'Sovereign Island Fruit Box', price: 120, category: 'Fresh', img: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=2070' },
    { id: 2, name: 'Cybercity Espresso Reserve', price: 85, category: 'Provision', img: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=2070' },
    { id: 3, name: 'Metropolis Spice Index', price: 45, category: 'Vault', img: 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&q=80&w=2070' },
    { id: 4, name: 'Citadel Honey (Grade A)', price: 210, category: 'Elite', img: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=2070' }
  ];

  const total = cart.reduce((acc, curr) => acc + curr.price, 0);

  return (
    <div className="pt-32 pb-20 max-w-7xl mx-auto px-8 min-h-screen">
      <div className="flex justify-between items-end mb-16 px-4">
        <div>
          <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Citadel Logistics</h2>
          <h3 className="text-5xl font-serif italic text-white leading-tight">Metropolis <br /> Provisions Node</h3>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-right">
              <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">MESH_BALANCE</span>
              <div className="text-3xl font-serif text-gold">${total}</div>
           </div>
           <button className="w-16 h-16 bg-gold text-black flex items-center justify-center relative shadow-[0_0_20px_rgba(197,160,89,0.3)]">
              <ShoppingCart className="w-6 h-6" />
              {cart.length > 0 && <span className="absolute top-3 right-3 w-4 h-4 bg-black text-white text-[9px] flex items-center justify-center rounded-sm font-bold">{cart.length}</span>}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {items.map(i => (
          <div key={i.id} className="aura-card p-8 bg-[#0A0A0B] border-white/5 flex flex-col h-full group hover:border-gold/20 transition-all">
            <div className="aspect-square mb-8 overflow-hidden relative">
               <img src={i.img} alt={i.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-[2s]" referrerPolicy="no-referrer" />
               <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all" />
            </div>
            <span className="text-[9px] text-gold font-bold uppercase tracking-widest mb-2 italic">Class: {i.category}</span>
            <h4 className="text-xl font-serif italic text-white mb-6 flex-1">{i.name}</h4>
            <div className="flex justify-between items-center pt-6 border-t border-white/5">
              <span className="text-lg font-mono text-white/60">${i.price}</span>
              <button onClick={() => setCart([...cart, i])} className="p-3 border border-white/10 hover:bg-gold hover:text-black transition-all">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Roadmap = () => (
  <div className="pt-32 pb-20 max-w-5xl mx-auto px-8">
    <div className="text-center mb-24">
       <h2 className="text-[11px] uppercase tracking-[0.4em] font-bold text-gold mb-4">The Evolution Timeline</h2>
       <h3 className="text-6xl font-serif italic text-white flex items-center justify-center gap-4">Drafting the Future</h3>
    </div>
    
    <div className="space-y-20 relative px-4 md:px-0">
      <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-white/5 ml-4 hidden md:block" />
      {[
        { 
          phase: "Phase 1: Genesis protocol", 
          date: "Q2 2026", 
          label: "Metropolis Foundation", 
          items: [
            "AURA Token TGE on Mauritius-aligned liquidity pools.",
            "Fractional Estate Node engine goes live for initial Grand Baie assets.",
            "Citizen Dashboard v1 with metabolic data visualization.",
            "Legal sandbox integration for 5-day visa fast-tracking.",
            "Web3 Auth & Wallet Connect deployment."
          ] 
        },
        { 
          phase: "Phase 2: Mesh Expansion", 
          date: "Q4 2026", 
          label: "Sovereign Scalability", 
          items: [
            "Launch of the Art Marketplace with high-fidelity 3D NFT viewer.",
            "Grocery & Provision node integration for direct mesh-to-door logistics.",
            "Ebène Cybercity Corporate DAO for metabolic business governance.",
            "Tier-1 banking bridge for seamless fiat-to-AURA conversion.",
            "Introduction of the 'Dodo' governance token."
          ] 
        },
        { 
          phase: "Phase 3: Sovereign Autonomy", 
          date: "Q2 2027", 
          label: "The Eternal Mesh", 
          items: [
            "Full Golden Visa automation via the Citadel Axis.",
            "Meta-Estate construction where virtual ownership influences physical ROI.",
            "Global Metropolis Link: Onboarding other sovereign jurisdictions.",
            "Sovereign AI Counselor for automated tax and portfolio optimization.",
            "Metropolis decentralized cloud storage node launch."
          ] 
        }
      ].map((p, i) => (
        <div key={i} className="relative md:pl-24">
          <div className="absolute left-0 top-0 w-8 h-8 rounded-sm bg-black border border-gold/60 flex items-center justify-center -translate-x-1/2 z-10 hidden md:flex shadow-[0_0_15px_rgba(197,160,89,0.3)]">
             <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
          </div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="aura-card p-12 bg-[#0A0A0B] border-white/5 hover:border-gold/20 transition-all"
          >
            <div className="flex justify-between items-start mb-10 border-b border-white/5 pb-6">
              <div>
                <span className="text-gold text-[10px] font-mono font-bold uppercase tracking-[0.2em] mb-2 block">{p.date}</span>
                <h3 className="text-3xl font-serif italic text-white">{p.phase}</h3>
              </div>
              <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest border border-white/10 px-3 py-1">{p.label}</span>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {p.items.map((item, ii) => (
                <li key={ii} className="flex gap-4 items-start text-white/50 text-[11px] italic leading-relaxed">
                  <div className="w-1.5 h-[1.5px] bg-gold mt-2 opacity-50" />
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

const ArtMarketplace = () => {
  const [selectedArt, setSelectedArt] = useState<any>(null);
  
  return (
    <div className="pt-32 pb-20 max-w-7xl mx-auto px-8 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
        <div>
          <h2 className="text-sm uppercase tracking-[0.4em] font-bold text-gold mb-4">Sovereign Curation</h2>
          <h3 className="text-5xl font-serif italic text-white leading-tight">Mauritian Fine Art <br /> & Digital Assets</h3>
        </div>
        <div className="max-w-xs text-right">
           <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2 italic">Aura Art Index: +12.4% ARR</p>
           <div className="h-[1px] bg-gold/30 w-full" />
           <p className="text-[9px] text-white/20 mt-2 uppercase tracking-widest leading-relaxed">Verified by the Sapna Gallery & Mauritius Arts Collective.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {ART_MARKET.map((art) => (
          <motion.div 
            key={art.id} 
            whileHover={{ y: -10 }}
            className="aura-card overflow-hidden bg-[#0A0A0B] border-white/5 flex flex-col h-full cursor-pointer"
            onClick={() => setSelectedArt(art)}
          >
            <div className="aspect-square overflow-hidden relative group">
              <img src={art.img} alt={art.title} className="w-full h-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-110" referrerPolicy="no-referrer" />
              <div className="absolute top-4 left-4">
                 <div className="bg-black/80 backdrop-blur-md px-3 py-1 text-[9px] font-bold text-gold uppercase tracking-widest border border-gold/20">Authenticated</div>
              </div>
            </div>
            <div className="p-8 flex-1 flex flex-col">
              <span className="text-[9px] text-white/30 uppercase tracking-[0.3em] font-bold mb-2 italic">{art.artist}</span>
              <h4 className="text-2xl font-serif italic text-white mb-4">{art.title}</h4>
              <p className="text-xs text-white/40 mb-8 leading-relaxed italic">"{art.desc}"</p>
              <div className="mt-auto pt-6 border-t border-white/5 flex justify-between items-center">
                 <div className="flex flex-col">
                    <span className="text-[8px] text-white/20 uppercase font-bold tracking-widest">ASKING PRICE</span>
                    <span className="text-xl font-serif text-white">${art.price.toLocaleString()}</span>
                 </div>
                 <button className="px-6 py-2 bg-white text-black font-bold text-[9px] uppercase tracking-widest hover:bg-gold transition-colors">Place Bid</button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Visual Context Summary */}
      <div className="mt-32 p-12 bg-white/2 border border-white/5 aura-card">
         <h4 className="text-[10px] text-gold uppercase tracking-[0.4em] font-bold mb-8">Asset Visual Context Summary</h4>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
               <h5 className="text-white font-serif italic mb-4">Investment Landscape Visuals</h5>
               <p className="text-xs text-white/40 leading-relaxed italic">
                 The images displayed throughout the platform are curated to reflect the strategic and aesthetic value of Mauritius. 
                 From the **UNESCO heritage site of Le Morne Brabant**, symbolizing deep historical rootedness and prestige, to the **cyber-punk efficiency of Ebène Cybercity**, 
                 which showcases the island's readiness for high-frequency digital commerce. The vistas of **Grand Baie** represent the lifestyle 
                 standard expected by global elites seeking both sanctuary and luxury.
               </p>
            </div>
            <div>
               <h5 className="text-white font-serif italic mb-4">Cultural & Asset Curation</h5>
               <p className="text-xs text-white/40 leading-relaxed italic">
                 The Art Marketplace features works that bridge the gap between traditional Mauritian motifs—like the **Vaco-inspired abstract Dodos**—and 
                 **modern generative digital assets**. This combination signals a market that respects its heritage while aggressively 
                 pioneering the future of digital-physical ownership (Phygital assets). 
                 Each image serves as a visual proof-of-concept for the high-end, secure, and technologically advanced environment of the Aura Metropolis.
               </p>
            </div>
         </div>
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
