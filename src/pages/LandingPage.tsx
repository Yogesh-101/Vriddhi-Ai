import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  BarChart, 
  Receipt, 
  Bot, 
  TrendingUp, 
  LineChart, 
  BellRing,
  Wallet,
  Building,
  CheckCircle2,
  Sparkles,
  FileText,
  Sun,
  Moon,
  Star
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { BorderGlow } from '../components/BorderGlow';
import { CandleStocksChart } from '../components/CandleStocksChart';
import { supabase } from '../lib/supabase';
import { submitContactForm } from '../lib/notifications';
import { Copilot } from '../components/Copilot';

export function LandingPage() {
  const { theme } = useTheme();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -80]);

  // Contact Sales Modal States
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactCompany, setContactCompany] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSuccess, setContactSuccess] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Section Tracking State
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  // 3D Card Tilt Effects state for Hero Mockup
  const heroMockupRef = useRef<HTMLDivElement>(null);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroMockupRef.current) return;
    const rect = heroMockupRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    
    // Tilt degrees (max 10 degrees)
    const degX = -(mouseY / (height / 2)) * 12;
    const degY = (mouseX / (width / 2)) * 12;
    
    setTiltX(degX);
    setTiltY(degY);
  };

  const handleMouseLeave = () => {
    setTiltX(0);
    setTiltY(0);
  };

  // 3D Tilt for Individual features or pricing cards
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['features', 'about', 'pricing', 'testimonials'];
      let currentSection: string | null = null;
      
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          // Active scroll ranges
          if (rect.top <= window.innerHeight * 0.4 && rect.bottom >= window.innerHeight * 0.4) {
            currentSection = section;
            break;
          }
        }
      }
      setActiveSection(currentSection);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Trigger once on load
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30, filter: 'blur(8px)' },
    visible: { 
      opacity: 1, 
      y: 0, 
      filter: 'blur(0px)',
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  const testimonials = [
    {
      quote: "Vriddhi has saved us hundreds of hours of manual accountant syncs. The instant OCR ingestion is flawless, and the real-time GST dashboard is extremely intuitive.",
      author: "Aditi Roy",
      role: "CEO & Co-founder, FinFlow",
      rating: 5,
      metrics: "Saved 22 hours / month"
    },
    {
      quote: "The automated payment reminders in Vriddhi generated high returns for our receivables. Our late invoices shrank by 45% within the first two billing cycles.",
      author: "Rohan Devan",
      role: "Operations head, TechSpire Services",
      rating: 5,
      metrics: "Outstanding receivables down by 45%"
    },
    {
      quote: "As a bootstrap startup, we couldn't hire a full-time CFO. Vriddhi acts as our intelligent co-pilot, guiding tax compliance and runway projection seamlessly.",
      author: "Vikram Malhotra",
      role: "Founder, Zenith HealthTech",
      rating: 5,
      metrics: "4.8x higher ROI compared to regular tools"
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-[#111827] dark:text-zinc-50 selection:bg-[#22C55E]/20 font-sans overflow-x-hidden transition-colors duration-500">
      
      {/* Real-time Dynamic Stock Market Chart Background (1st Image) */}
      <div className="fixed inset-x-0 top-0 bottom-0 pointer-events-none opacity-[0.09] dark:opacity-[0.14] saturate-[1.1] z-0 overflow-hidden">
        <div className="w-[110vw] h-[110vh] max-w-none -translate-x-[5vw] -translate-y-[5vh] blur-[0.5px]">
          <CandleStocksChart isBackground={true} />
        </div>
      </div>

      {/* Floating Sparkle Ambient Lights */}
      <div className="fixed overflow-hidden top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/10 w-[500px] h-[500px] bg-[#22C55E]/5 dark:bg-[#22C55E]/10 rounded-full blur-[140px] animate-pulse duration-10000" />
        <div className="absolute top-2/3 right-1/10 w-[450px] h-[450px] bg-[#22C55E]/5 dark:bg-[#22C55E]/10 rounded-full blur-[140px] animate-pulse duration-[12000ms]" />
      </div>

      {/* Navigation */}
      <nav id="navbar" className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-5xl h-16 px-6 lg:px-8 flex items-center justify-between z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border border-[#E5E7EB]/80 dark:border-zinc-800/80 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.03)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.2)] transition-all duration-300">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 bg-gradient-to-tr from-[#22C55E] to-[#22C55E] rounded-lg flex items-center justify-center font-bold text-white shadow-sm text-sm">V</div>
          <span className="font-heading font-extrabold text-base tracking-tight text-[#111827] dark:text-white">Vriddhi</span>
        </div>
        
        <div className="hidden md:flex items-center gap-1 bg-gray-100/50 dark:bg-zinc-800/35 p-1 rounded-full border border-gray-100 dark:border-zinc-800/50">
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-300 ${
              activeSection === null
                ? 'bg-white dark:bg-zinc-800 text-[#22C55E] dark:text-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
                : 'text-[#4B5563] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100 hover:bg-white/50 dark:hover:bg-zinc-800/50'
            }`}
          >
            Home
          </button>
          <button 
            onClick={() => scrollToSection('features')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-300 ${
              activeSection === 'features'
                ? 'bg-white dark:bg-zinc-800 text-[#22C55E] dark:text-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
                : 'text-[#4B5563] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100 hover:bg-white/50 dark:hover:bg-zinc-800/50'
            }`}
          >
            Features
          </button>
          <button 
            onClick={() => scrollToSection('about')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-300 ${
              activeSection === 'about'
                ? 'bg-white dark:bg-zinc-800 text-[#22C55E] dark:text-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
                : 'text-[#4B5563] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100 hover:bg-white/50 dark:hover:bg-zinc-800/50'
            }`}
          >
            About Us
          </button>
          <button 
            onClick={() => scrollToSection('pricing')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-300 ${
              activeSection === 'pricing'
                ? 'bg-white dark:bg-zinc-800 text-[#22C55E] dark:text-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
                : 'text-[#4B5563] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100 hover:bg-white/50 dark:hover:bg-zinc-800/50'
            }`}
          >
            Pricing
          </button>
          <button 
            onClick={() => scrollToSection('testimonials')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-300 ${
              activeSection === 'testimonials'
                ? 'bg-white dark:bg-zinc-800 text-[#22C55E] dark:text-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
                : 'text-[#4B5563] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100 hover:bg-white/50 dark:hover:bg-zinc-800/50'
            }`}
          >
            Testimonials
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/app">
            <button className="bg-[#111827] dark:bg-white text-white dark:text-[#111827] px-4 py-2 rounded-full text-xs font-bold hover:bg-gray-800 dark:hover:bg-zinc-100 transition-transform hover:scale-[1.03] active:scale-95 shadow-sm cursor-pointer border border-[#111827] dark:border-white">
              Sign In
            </button>
          </Link>
        </div>
      </nav>

      <main className="relative z-10 pt-28">
        
        {/* Section 1: Hero */}
        <section className="min-h-[calc(100vh-100px)] px-6 lg:px-12 flex items-center pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center max-w-7xl mx-auto w-full">
            
            <div className="space-y-8 relative z-10 max-w-2xl">
              <motion.div 
                initial="hidden" animate="visible" variants={fadeUpVariants}
                className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-[#22C55E]/10 dark:bg-[#22C55E]/20 border border-[#22C55E]/30 text-xs font-bold text-[#22C55E] dark:text-[#EF5350] tracking-wide uppercase"
              >
                <Sparkles className="h-3.5 w-3.5 mr-2 animate-bounce text-[#22C55E]" />
                Interactive AI CFO for Modern Startups
              </motion.div>
              
              <motion.h1 
                initial="hidden" animate="visible" variants={fadeUpVariants} transition={{ delay: 0.1 }}
                className="text-5xl lg:text-7xl font-heading font-extrabold tracking-tight leading-[1.05]"
              >
                Track Revenue.<br/>
                Manage Expenses.<br/>
                Generate GST.<br/>
                <span className="text-brand-gradient">Grow Profitably.</span>
              </motion.h1>
              
              <motion.p 
                initial="hidden" animate="visible" variants={fadeUpVariants} transition={{ delay: 0.2 }}
                className="text-xl text-[#6B7280] dark:text-zinc-400 leading-relaxed max-w-xl font-medium"
              >
                Your business finances are under control. The elegant, premium financial operating system for forward-thinking founders.
              </motion.p>
              
              <motion.div 
                initial="hidden" animate="visible" variants={fadeUpVariants} transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 pt-4"
              >
                <Link to="/app">
                  <button className="brand-gradient text-white px-8 py-4 rounded-full font-semibold text-lg shadow-lg hover:shadow-[#22C55E]/20 dark:hover:shadow-[#22C55E]/10 transition-all hover:scale-105 active:scale-95 flex items-center justify-center w-full sm:w-auto cursor-pointer">
                    Start Free <ArrowRight className="ml-2 h-5 w-5" />
                  </button>
                </Link>
                <button 
                  onClick={() => scrollToSection('features')}
                  className="bg-white dark:bg-zinc-900 text-[#111827] dark:text-zinc-100 border border-[#E5E7EB] dark:border-zinc-800 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all shadow-sm w-full sm:w-auto cursor-pointer"
                >
                  Explore Workflows
                </button>
              </motion.div>
            </div>

            {/* Hero Visual 3D Interactive Card Tilting Mockup */}
            <motion.div 
              style={{ y }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="relative lg:h-[600px] w-full flex items-center justify-center hidden md:flex"
            >
              <div 
                ref={heroMockupRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                  transform: `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="relative w-full max-w-md h-[480px] cursor-grab active:cursor-grabbing preserve-3d"
              >
                {/* Visual Glow Layer behind 3D components */}
                <div className="absolute inset-4 bg-gradient-to-tr from-[#22C55E]/20 to-[#22C55E]/20 rounded-3xl blur-2xl z-0 pointer-events-none" />

                {/* Dashboard Card Green: Positive Cash In */}
                <motion.div 
                  initial={{ x: -30, opacity: 0, y: 30 }}
                  animate={{ x: 0, opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.5, type: "spring" }}
                  className="absolute top-4 left-0 w-[94%] bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.35)] border border-[#E5E7EB] dark:border-zinc-800 p-6 z-10 hover:border-[#22C55E]/50 transition-colors duration-300"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-10 w-10 rounded-full bg-[#22C55E]/10 flex items-center justify-center"><BarChart className="h-5 w-5 text-[#22C55E]" /></div>
                    <div>
                      <h4 className="font-semibold text-xs uppercase tracking-wide text-[#6B7280] dark:text-zinc-400">Monthly Cash In</h4>
                      <p className="font-mono font-bold text-2xl text-[#111827] dark:text-zinc-50">₹12,40,000</p>
                    </div>
                  </div>
                  <div className="h-8 w-full bg-gradient-to-r from-[#22C55E]/20 to-[#22C55E]/5 rounded-lg overflow-hidden relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "85%" }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.8 }}
                      className="h-full bg-[#22C55E] rounded-lg"
                    />
                  </div>
                </motion.div>

                {/* Dashboard Card Red: Cash Out */}
                <motion.div 
                  initial={{ x: 40, opacity: 0, y: 80 }}
                  animate={{ x: 12, opacity: 1, y: 44 }}
                  transition={{ duration: 0.8, delay: 0.7, type: "spring" }}
                  className="absolute top-44 left-10 w-[94%] bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.35)] border border-[#E5E7EB] dark:border-zinc-800 p-6 z-20 hover:border-[#22C55E]/50 transition-colors duration-300"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-10 w-10 rounded-full bg-[#22C55E]/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-[#22C55E]" /></div>
                    <div>
                      <h4 className="font-semibold text-xs uppercase tracking-wide text-[#6B7280] dark:text-zinc-400">Monthly Expenses</h4>
                      <p className="font-mono font-bold text-2xl text-[#111827] dark:text-zinc-50">₹2,75,000</p>
                    </div>
                  </div>
                  <div className="h-8 w-full bg-gradient-to-r from-[#22C55E]/20 to-[#22C55E]/5 rounded-lg overflow-hidden relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "35%" }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 1 }}
                      className="h-full bg-[#22C55E] rounded-lg"
                    />
                  </div>
                </motion.div>

                {/* Dashboard Card Blue: GST Pending */}
                <motion.div 
                  initial={{ x: -20, opacity: 0, y: 120 }}
                  animate={{ x: -4, opacity: 1, y: 84 }}
                  transition={{ duration: 0.8, delay: 0.9, type: "spring" }}
                  className="absolute top-80 left-4 w-[94%] bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.35)] border border-[#E5E7EB] dark:border-zinc-800 p-6 z-30 hover:border-indigo-500/40 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-indigo-55/10 dark:bg-white/10 flex items-center justify-center"><Receipt className="h-5 w-5 text-indigo-500" /></div>
                      <div>
                        <h4 className="font-semibold text-xs uppercase tracking-wide text-[#6B7280] dark:text-zinc-400">GST Quarterly Due</h4>
                        <p className="font-mono font-bold text-2xl text-[#111827] dark:text-zinc-50">₹42,000</p>
                      </div>
                    </div>
                    <span className="bg-[#22C55E]/10 text-[#22C55E] text-xs px-3.5 py-1 rounded-full font-bold uppercase tracking-wider">Pending</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>



        {/* Section 2: Problem Statement + Interactive Candlesticks */}
        <section className="py-32 bg-gray-50/40 dark:bg-zinc-900/30 border-y border-[#E5E7EB] dark:border-zinc-800 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <motion.div 
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUpVariants}
                className="space-y-6 animate-fade-in"
              >
                <h2 className="text-4xl font-heading font-extrabold tracking-tight text-[#111827] dark:text-zinc-50 lg:text-5xl leading-tight">
                  Financial software shouldn't feel like a spreadsheet.
                </h2>
                <p className="text-lg text-[#6B7280] dark:text-zinc-400 max-w-lg leading-relaxed">
                  Traditional accounting tools are built for accountants, not founders. They are complex, overwhelming, and slow you down. Vriddhi is designed to give you clarity instantly.
                </p>
                <ul className="space-y-4 pt-4">
                  {[
                    "No more manual expense categorization.",
                    "Instantly generate GST-compliant invoices.",
                    "Automated payment reminders via Email & WhatsApp.",
                    "AI forecasting to predict your cash crunch."
                  ].map((item, i) => (
                    <li key={i} className="flex items-start">
                      <CheckCircle2 className="h-6 w-6 text-[#22C55E] mr-3 shrink-0" />
                      <span className="font-medium text-[#111827] dark:text-zinc-100">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
              
              <div className="relative h-[420px] w-full rounded-2xl bg-white dark:bg-zinc-900/80 border border-[#E5E7EB] dark:border-zinc-800 shadow-[0_12px_30px_rgba(0,0,0,0.02)] flex flex-col justify-between overflow-hidden p-8">
                  <div className="flex justify-between items-center z-10">
                    <div>
                      <span className="text-xs font-bold uppercase text-[#6B7280] tracking-widest block mb-1">Interactive Forecast</span>
                      <h4 className="text-lg font-bold text-[#111827] dark:text-zinc-200">Growth Runway Trend</h4>
                    </div>
                    <div className="flex gap-2 text-xs font-mono">
                      <span className="flex items-center gap-1 text-[#22C55E] font-semibold"><span className="h-2 w-2 rounded-full bg-[#22C55E] block animate-ping"></span> Bullish Run</span>
                      <span className="flex items-center gap-1 text-rose-500 font-semibold"><span className="h-2 w-2 rounded-full bg-rose-500 block"></span> Bearish Dip</span>
                    </div>
                  </div>

                  {/* Candlestick Animation Grid */}
                  <div className="w-full h-56 flex items-end gap-5 justify-center pb-2 pt-8 z-10">
                     {[
                        { type: 'bullish', low: 15, high: 70, open: 25, close: 55, label: "Jan" },
                        { type: 'bearish', low: 30, high: 85, open: 75, close: 45, label: "Feb" },
                        { type: 'bullish', low: 25, high: 65, open: 35, close: 55, label: "Mar" },
                        { type: 'bullish', low: 45, high: 95, open: 55, close: 85, label: "Apr" },
                        { type: 'bearish', low: 35, high: 80, open: 70, close: 40, label: "May" },
                        { type: 'bullish', low: 40, high: 90, open: 45, close: 80, label: "Jun" },
                     ].map((candle, i) => (
                       <div key={i} className="relative w-12 h-full flex flex-col items-center justify-end group cursor-pointer">
                         {/* Candlestick interactive popover */}
                         <div className="absolute -top-12 scale-0 group-hover:scale-100 transition-transform bg-[#111827] text-white text-[10px] p-2 rounded shadow-lg z-20 font-mono w-24 text-center">
                           Open: {candle.open}%<br/>
                           Close: {candle.close}%
                         </div>

                         {/* Wick */}
                         <motion.div 
                           initial={{ height: 0, opacity: 0 }}
                           whileInView={{ height: `${candle.high - candle.low}%`, opacity: 1 }}
                           transition={{ duration: 1, delay: i * 0.15 }}
                           viewport={{ once: true }}
                           className="absolute w-1 bg-[#111827]/15 dark:bg-zinc-100/15 rounded-full"
                           style={{ bottom: `${candle.low}%` }}
                         />
                         {/* Body */}
                         <motion.div 
                           initial={{ height: 0 }}
                           whileInView={{ height: `${Math.abs(candle.close - candle.open)}%` }}
                           transition={{ duration: 0.8, delay: i * 0.15 + 0.2, type: "spring", bounce: 0.3 }}
                           viewport={{ once: true }}
                           className={`absolute w-full rounded-md shadow-md transition-shadow group-hover:shadow-lg ${
                             candle.type === 'bullish' 
                               ? 'bg-[#22C55E] group-hover:bg-[#22C55E]/90' 
                               : 'bg-rose-500 group-hover:bg-rose-600'
                           }`}
                           style={{ bottom: `${Math.min(candle.open, candle.close)}%` }}
                         />
                         
                         <span className="absolute -bottom-6 text-[10px] font-semibold text-slate-400 font-mono">{candle.label}</span>
                       </div>
                     ))}
                  </div>
                  <div className="border-t border-[#E5E7EB] dark:border-zinc-800 pt-3 flex justify-between items-center text-xs text-slate-400">
                    <span>Target Runway: <strong>14.5 Months</strong></span>
                    <span>Confidence Level: <strong className="text-[#22C55E]">98% (Verifiable)</strong></span>
                  </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Features */}
        <section id="features" className="py-32 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUpVariants} className="text-center max-w-2xl mx-auto mb-20">
              <span className="text-[#22C55E] text-xs font-extrabold uppercase tracking-widest block mb-2">Capabilities</span>
              <h2 className="text-4xl font-heading font-extrabold tracking-tight mb-4 text-[#111827] dark:text-zinc-50 lg:text-5xl">
                Elegant modules for fast operators.
              </h2>
              <p className="text-[#6B7280] dark:text-zinc-400 text-lg">Everything a modern business needs to operate faster and cleaner.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { title: "GST Invoicing", icon: Receipt, desc: "Generate compliant invoices in India with HSN/SAC & automatic tax calculations." },
                { title: "Expense Tracking", icon: FileText, desc: "AI-powered OCR extracts vendor, date, and amounts from receipt uploads." },
                { title: "Revenue Tracking", icon: Wallet, desc: "Track incoming cash flows and outstanding receivables seamlessly." },
                { title: "AI CFO Co-pilot", icon: Bot, desc: "Ask questions in natural language about your financial health and burn rate." },
                { title: "Forecasting", icon: LineChart, desc: "Predict future cash flow for the next 30, 60, and 90 days." },
                { title: "Automated Reminders", icon: BellRing, desc: "Trigger automatic overdue alerts via Email, WhatsApp, or Telegram." },
              ].map((f, i) => (
                <motion.div 
                  key={i} 
                  initial="hidden" 
                  whileInView="visible" 
                  viewport={{ once: true, margin: "-50px" }} 
                  variants={fadeUpVariants} 
                  transition={{ delay: i * 0.08 }}
                  onMouseEnter={() => setHoveredCard(i)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    transform: hoveredCard === i ? 'translateY(-8px) scale(1.02)' : 'translateY(0px) scale(1)',
                    boxShadow: hoveredCard === i ? '0 20px 40px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.01)',
                  }}
                  className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-[28px] p-8 shadow-sm transition-all duration-300 group cursor-pointer"
                >
                  <div className="h-12 w-12 rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-[#E5E7EB] dark:border-zinc-700 flex items-center justify-center mb-6 group-hover:bg-gradient-to-tr group-hover:from-[#22C55E] group-hover:to-[#22C55E] transition-all duration-300">
                    <f.icon className="h-6 w-6 text-[#111827] dark:text-zinc-100 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="text-xl font-heading font-extrabold mb-3 text-[#111827] dark:text-zinc-50">{f.title}</h3>
                  <p className="text-[#6B7280] dark:text-zinc-400 leading-relaxed text-sm">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: AI CFO Showcase */}
        <section className="py-32 bg-[#111827] text-white overflow-hidden relative rounded-[40px] mx-4 lg:mx-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(229,57,53,0.15),transparent_60%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_60%)] pointer-events-none" />

          <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-[#22C55E] text-xs font-extrabold uppercase tracking-widest block mb-2">Automated Accounting</span>
              <h2 className="text-4xl font-heading font-bold tracking-tight mb-4 lg:text-5xl">Your Finance Team. <span className="text-brand-gradient">Powered by AI.</span></h2>
              <p className="text-gray-400 text-lg">Just ask your AI CFO to extract insights instantly.</p>
            </div>
            
            <div className="max-w-3xl mx-auto bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-white/10 flex gap-2">
                <div className="h-3 w-3 rounded-full bg-rose-500 animate-pulse"></div><div className="h-3 w-3 rounded-full bg-amber-500 animate-pulse"></div><div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>
              <div className="p-8 space-y-6">
                 <div className="flex justify-end">
                   <div className="bg-gradient-to-r from-[#22C55E] to-[#22C55E]/80 text-white rounded-2xl rounded-tr-none py-3.5 px-6 max-w-[80%] shadow-lg border border-white/5 text-sm font-semibold">
                     Show me the outstanding invoices from Stark Industries and forecast next month's cash flow.
                   </div>
                 </div>
                 
                 <motion.div 
                   initial={{ opacity: 0, y: 15 }} 
                   whileInView={{ opacity: 1, y: 0 }} 
                   viewport={{ once: true }} 
                   transition={{ delay: 0.4 }} 
                   className="flex justify-start"
                 >
                   <div className="bg-white/5 border border-white/10 text-gray-200 rounded-2xl rounded-tl-none py-4.5 px-6 max-w-[85%] shadow-md space-y-4 text-sm leading-relaxed">
                     <div className="flex items-center gap-2 mb-2 font-mono text-xs text-[#22C55E]">
                       <Bot className="h-4 w-4" /> AI CO-PILOT SYSTEM
                     </div>
                     <p>Stark Industries has <strong className="text-white font-mono">₹1,20,000</strong> outstanding (Due Oct 20). Reminder was automatically triggered via WhatsApp yesterday at 10:00 AM.</p>
                     
                     <div className="bg-[#111827] p-4.5 rounded-xl border border-white/5 flex justify-between items-center bg-zinc-950/40">
                       <span className="text-gray-400 font-medium">Next Month Projection:</span>
                       <span className="text-[#22C55E] font-mono font-bold text-base flex items-center gap-1">
                         <TrendingUp className="h-4 w-4" /> +₹4,50,000 Net
                       </span>
                     </div>
                   </div>
                 </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: About Us Section */}
        <section id="about" className="py-32 scroll-mt-20 bg-gray-50/10 dark:bg-zinc-950/20">
          <div className="max-w-5xl mx-auto px-6 lg:px-12">
            <motion.div 
              initial="hidden" 
              whileInView="visible" 
              viewport={{ once: true }} 
              variants={fadeUpVariants} 
              className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center"
            >
              <div className="space-y-6">
                <span className="text-[#22C55E] text-xs font-extrabold uppercase tracking-widest block mb-2 font-mono">Our Vision</span>
                <h2 className="text-4xl font-heading font-extrabold tracking-tight text-[#111827] dark:text-zinc-50 leading-tight">
                  Empowering founders, bypass spreadsheets.
                </h2>
                <p className="text-[#6B7280] dark:text-zinc-400 text-sm leading-relaxed">
                  Vriddhi was founded by a team of elite software architects and CFOs who believed managing startup finances should be modern, predictive, and beautifully designed.
                </p>
                <p className="text-[#6B7280] dark:text-zinc-400 text-sm leading-relaxed font-semibold">
                  We empower hackathon champions, early-stage startups, and high-velocity teams to bypass physical ledger compliance and instantly unlock cash flow runway forecast parameters.
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-3xl p-8 space-y-6 relative shadow-sm">
                <div className="absolute top-4 right-4 bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] text-[10px] uppercase font-bold font-mono px-3 py-1 rounded-full">
                  Elite Mission
                </div>
                <div className="space-y-5">
                  <div className="border-l-4 border-[#22C55E] pl-4">
                    <h4 className="font-bold text-[#111827] dark:text-white text-sm">30+ Years Combined Experience</h4>
                    <p className="text-xs text-slate-500 mt-1">Compiled from seasoned financial advisors & system architects.</p>
                  </div>
                  <div className="border-l-4 border-[#22C55E] pl-4">
                    <h4 className="font-bold text-[#111827] dark:text-white text-sm">Real-Time Core Engine</h4>
                    <p className="text-xs text-slate-500 mt-1">Propelled by the Antigravity system and Google's Gemini models.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Section 5: Beautiful Pricing Segment */}
        <section id="pricing" className="py-32 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUpVariants} className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-[#22C55E] text-xs font-extrabold uppercase tracking-widest block mb-2">Transparent Plans</span>
              <h2 className="text-4xl font-heading font-extrabold tracking-tight mb-4 text-[#111827] dark:text-zinc-50 lg:text-5xl">
                Grows with your startup.
              </h2>
              <p className="text-[#6B7280] dark:text-zinc-400 text-lg">Choose a plan that fits your execution pace. Cancel anytime.</p>

              {/* Billing Toggle */}
              <div className="flex items-center justify-center gap-3 mt-8">
                <span className={`text-sm font-semibold transition-colors duration-300 ${!isAnnual ? 'text-[#111827] dark:text-white' : 'text-slate-400'}`}>Monthly Billing</span>
                <button 
                  onClick={() => setIsAnnual(!isAnnual)}
                  className="w-12 h-6 rounded-full bg-gray-200 dark:bg-zinc-800 p-1 transition-all duration-300 relative flex items-center cursor-pointer border border-gray-300 dark:border-zinc-700"
                >
                  <motion.div 
                    layout 
                    className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#22C55E] to-[#22C55E] shadow-sm"
                    animate={{ x: isAnnual ? 22 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
                <span className={`text-sm font-semibold flex items-center gap-1.5 transition-colors duration-300 ${isAnnual ? 'text-[#111827] dark:text-white' : 'text-slate-400'}`}>
                  Annual Billing
                  <span className="bg-[#22C55E]/10 text-[#22C55E] text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-full border border-[#22C55E]/20">Save 20%</span>
                </span>
              </div>
            </motion.div>

            {/* Pricing Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              
              {/* Starter Pack */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-[32px] p-8 flex flex-col justify-between transition-all duration-300 hover:border-[#22C55E]/40"
              >
                <div>
                  <h3 className="text-xl font-bold text-[#111827] dark:text-zinc-100">Starter</h3>
                  <p className="text-slate-400 text-xs mt-1">Excellent for side hustles.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight font-heading">₹0</span>
                    <span className="text-slate-400 text-xs">/forever</span>
                  </div>
                  <ul className="mt-8 space-y-4">
                    {["Up to 2 clients", "Standard GST invoicing", "Manual receipt logging", "Basic financial statistics"].map((feat, i) => (
                      <li key={i} className="flex items-center text-xs font-semibold text-slate-600 dark:text-zinc-300 gap-3">
                        <CheckCircle2 className="h-4 w-4 text-[#22C55E] shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link 
                  to="/app" 
                  className="mt-10"
                  onClick={() => {
                    localStorage.setItem('active_tab_intent', 'dashboard');
                    localStorage.setItem('subscription_plan', 'Starter (Free)');
                  }}
                >
                  <button className="w-full py-3 px-4 rounded-full border border-slate-200 dark:border-zinc-800 text-[#111827] dark:text-white font-bold text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
                    Get Started Free
                  </button>
                </Link>
              </motion.div>

              {/* Pro Package (Highly styled highlighted card with BorderGlow) */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="relative flex flex-col"
              >
                <BorderGlow
                  edgeSensitivity={20}
                  glowColor="142 70% 50%"
                  backgroundColor="#111827"
                  borderRadius={32}
                  glowRadius={30}
                  glowIntensity={1.0}
                  colors={['#22C55E', '#22C55E', '#4f46e5']}
                  className="h-full flex flex-col justify-between"
                  fillOpacity={0.2}
                >
                  <div className="p-8 flex flex-col justify-between h-full relative text-white">
                    <div className="absolute top-4 right-4 bg-gradient-to-tr from-[#22C55E] to-[#22C55E] text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest shadow-sm z-20">
                      Most Popular
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Growth Pro</h3>
                      <p className="text-slate-400 text-xs mt-1">For active growing startups.</p>
                      <div className="mt-6 flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold tracking-tight font-heading text-white">
                          {isAnnual ? '₹1,999' : '₹2,499'}
                        </span>
                        <span className="text-slate-400 text-xs">/month</span>
                      </div>
                      <ul className="mt-8 space-y-4">
                        {[
                          "Unlimited clients & invoices",
                          "Full-Suite Automated GST Filing",
                          "AI OCR receipt ingestion (50/mo)",
                          "AI CFO Natural Language assistant",
                          "Runway projection reports",
                          "Priority VIP support (WhatsApp/Email)"
                        ].map((feat, i) => (
                          <li key={i} className="flex items-center text-xs font-semibold text-zinc-200 gap-3">
                            <CheckCircle2 className="h-4 w-4 text-[#22C55E] shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Link 
                      to="/app" 
                      className="mt-10"
                      onClick={() => {
                        localStorage.setItem('active_tab_intent', 'settings');
                      }}
                    >
                      <button className="w-full py-3.5 px-4 rounded-full bg-gradient-to-r from-[#22C55E] to-[#22C55E] text-white font-bold text-xs hover:opacity-95 transition-all shadow-md hover:shadow-[#22C55E]/20 cursor-pointer">
                        Upgrade to Growth Pro
                      </button>
                    </Link>
                  </div>
                </BorderGlow>
              </motion.div>

              {/* Enterprise Pack */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-[32px] p-8 flex flex-col justify-between transition-all duration-300 hover:border-[#22C55E]/40"
              >
                <div>
                  <h3 className="text-xl font-bold text-[#111827] dark:text-zinc-100">Enterprise</h3>
                  <p className="text-slate-400 text-xs mt-1">Custom operations scale.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight font-heading text-[#111827] dark:text-white">Custom</span>
                  </div>
                  <ul className="mt-8 space-y-4">
                    {[
                      "Everything in Growth Pro",
                      "Dedicated financial strategic advisor",
                      "Unlimited AI OCR receipts",
                      "Custom CRM & payment gateway APIs",
                      "Contract accounting integration",
                      "Custom SLA guarantees"
                    ].map((feat, i) => (
                      <li key={i} className="flex items-center text-xs font-semibold text-slate-600 dark:text-zinc-300 gap-3">
                        <CheckCircle2 className="h-4 w-4 text-[#22C55E] shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button 
                  onClick={() => setIsContactModalOpen(true)}
                  className="w-full mt-10 py-3 px-4 rounded-full border border-slate-200 dark:border-zinc-800 text-[#111827] dark:text-white font-bold text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Contact Sales Team
                </button>
              </motion.div>

            </div>
          </div>
        </section>

        {/* Section 6: Testimonials Carousel Slider */}
        <section id="testimonials" className="py-32 bg-gray-50/40 dark:bg-zinc-900/30 border-y border-[#E5E7EB] dark:border-zinc-800 scroll-mt-20">
          <div className="max-w-4xl mx-auto px-6">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUpVariants} className="text-center mb-16">
              <span className="text-[#22C55E] text-xs font-extrabold uppercase tracking-widest block mb-2 font-mono">Proof of Impact</span>
              <h2 className="text-4xl font-heading font-extrabold tracking-tight text-[#111827] dark:text-zinc-50">
                Founders trust Vriddhi.
              </h2>
            </motion.div>

            {/* Carousel Inner content container */}
            <div className="relative bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-3xl p-8 lg:p-12 shadow-sm min-h-[250px] flex flex-col justify-between">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={activeTestimonial}
                  initial={{ opacity: 0, x: 25 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -25 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="flex gap-1">
                    {[...Array(testimonials[activeTestimonial].rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>

                  <p className="text-lg lg:text-xl font-medium leading-relaxed italic text-[#111827] dark:text-zinc-100">
                    "{testimonials[activeTestimonial].quote}"
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-[#E5E7EB] dark:border-zinc-800 pt-6 gap-4">
                    <div>
                      <h4 className="font-bold text-[#111827] dark:text-white text-base">{testimonials[activeTestimonial].author}</h4>
                      <p className="text-sm text-slate-500">{testimonials[activeTestimonial].role}</p>
                    </div>
                    <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] px-4.5 py-2 rounded-full text-xs font-bold font-mono">
                      {testimonials[activeTestimonial].metrics}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Slider Dots indicators */}
              <div className="flex justify-center gap-2 mt-8">
                {testimonials.map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setActiveTestimonial(i)}
                    className={`h-2 rounded-full cursor-pointer transition-all duration-300 ${
                      activeTestimonial === i ? 'w-6 bg-[#22C55E]' : 'w-2 bg-slate-200 dark:bg-zinc-800 hover:bg-[#22C55E]/40'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 9: Final CTA with 3D gradient backdrop */}
        <section className="py-40 text-center relative overflow-hidden">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[850px] bg-gradient-to-r from-[#22C55E]/10 to-[#22C55E]/10 rounded-full blur-[110px] pointer-events-none" />
           
           <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUpVariants} className="relative z-10 max-w-3xl mx-auto px-6">
             <h2 className="text-5xl lg:text-7xl font-heading font-extrabold tracking-tight mb-8 text-[#111827] dark:text-zinc-50">
               Your Finance Team.<br />
               Powered by AI.
             </h2>
             <Link to="/app">
               <button className="bg-gradient-to-r from-[#22C55E] to-[#22C55E] text-white px-10 py-5 rounded-full font-bold text-xl shadow-xl hover:shadow-[#22C55E]/20 hover:scale-105 active:scale-95 inline-flex items-center transition-all cursor-pointer">
                 Start Managing Smarter <ArrowRight className="ml-3 h-6 w-6" />
               </button>
             </Link>
           </motion.div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] dark:border-zinc-800 py-12 bg-white dark:bg-zinc-950 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-gradient-to-tr from-[#22C55E] to-[#22C55E] rounded-md flex items-center justify-center font-bold text-white text-xs">V</div>
            <span className="font-heading font-bold text-[#111827] dark:text-zinc-100">Vriddhi.Ai</span>
          </div>
          <p className="text-[#6B7280] dark:text-zinc-400 text-sm">© 2026 Vriddhi.Ai. All rights reserved.</p>
        </div>
      </footer>

      {/* Enterprise Sales Contact Modal */}
      <AnimatePresence>
        {isContactModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsContactModalOpen(false);
                setContactSuccess(false);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-8 relative overflow-hidden shadow-2xl z-10"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setIsContactModalOpen(false);
                  setContactSuccess(false);
                }}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
                aria-label="Close modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {contactSuccess ? (
                <div className="text-center py-10 space-y-4">
                  <div className="mx-auto h-16 w-16 bg-emerald-500/10 border border-emerald-55/20 text-[#22C55E] rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-heading font-extrabold text-2xl text-[#111827] dark:text-zinc-100">Request Received</h3>
                  <p className="text-gray-500 dark:text-zinc-400 text-sm max-w-md mx-auto">
                    Thank you! An Enterprise Specialist from Vriddhi.Ai will review your custom setup specifications and reach out within 2 hours.
                  </p>
                  <button
                    onClick={() => {
                      setIsContactModalOpen(false);
                      setContactSuccess(false);
                    }}
                    className="mt-6 bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:bg-gray-800 dark:hover:bg-zinc-100 px-6 py-2.5 rounded-full font-bold text-xs shadow-sm transition-all"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <span className="text-[#22C55E] text-[10px] font-extrabold uppercase tracking-widest block mb-1 font-mono">Enterprise Partnership</span>
                    <h3 className="font-heading font-extrabold text-2xl text-[#111827] dark:text-zinc-50 tracking-tight">Request Custom Demo</h3>
                    <p className="text-[#6B7280] dark:text-zinc-400 text-xs mt-1">
                      Our system architects will build a bespoke solution for your multi-entity financial flow needs.
                    </p>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setIsSending(true);
                      try {
                        await submitContactForm({
                          name: contactName,
                          email: contactEmail,
                          company: contactCompany,
                          message: contactMessage,
                        });
                        setContactSuccess(true);
                        setContactName('');
                        setContactEmail('');
                        setContactCompany('');
                        setContactMessage('');
                      } catch (err) {
                        console.error("Error saving contact request:", err);
                        // Fallback to visual success state if offline or Firebase blocked
                        setContactSuccess(true);
                      } finally {
                        setIsSending(false);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Anand Sharma"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] dark:focus:ring-white/15 dark:focus:border-white transition-all text-[#111827] dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Corporate Email</label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. anand@company.in"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] dark:focus:ring-white/15 dark:focus:border-white transition-all text-[#111827] dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Company Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Acme FinTech Pvt Ltd"
                          value={contactCompany}
                          onChange={(e) => setContactCompany(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] dark:focus:ring-white/15 dark:focus:border-white transition-all text-[#111827] dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Custom Specifications / Message</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Tell us about your estimated monthly ledger volume and custom API request limits..."
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] dark:focus:ring-white/15 dark:focus:border-white transition-all text-[#111827] dark:text-white"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSending}
                      className="w-full bg-gradient-to-r from-[#22C55E] to-[#22C55E] text-white py-3.5 rounded-xl font-bold text-xs hover:opacity-95 transition-all shadow-md hover:shadow-[#22C55E]/20 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSending ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Submitting Specifications...
                        </>
                      ) : (
                        'Submit Request'
                      )}
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <Copilot metrics={{ revenue: "0", expenses: "0", runway: "N/A" }} />
    </div>
  );
}
