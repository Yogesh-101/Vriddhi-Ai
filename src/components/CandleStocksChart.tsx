import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, Settings, Eye, EyeOff, Zap, Play, Pause, ChevronDown, Check, Info } from 'lucide-react';

interface Candle {
  id: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  type: 'bull' | 'bear';
}

interface StockPreset {
  name: string;
  symbol: string;
  basePrice: number;
  volatility: number;
  trend: 'up' | 'down' | 'neutral';
  change: number;
}

const STOCK_PRESETS: StockPreset[] = [
  { name: 'Vriddhi.Ai Index', symbol: 'VRIDDHI.AI', basePrice: 15420.50, volatility: 0.003, trend: 'up', change: 4.85 },
  { name: 'NIFTY 50 Index', symbol: 'NIFTY50', basePrice: 23550.20, volatility: 0.0015, trend: 'neutral', change: 0.32 },
  { name: 'Stark Industries', symbol: 'STARK', basePrice: 420.75, volatility: 0.008, trend: 'up', change: 12.42 },
  { name: 'Reliance Industries', symbol: 'RELIANCE', basePrice: 2910.40, volatility: 0.002, trend: 'neutral', change: -0.65 },
  { name: 'Tata Motors', symbol: 'TATAMOTORS', basePrice: 975.30, volatility: 0.004, trend: 'up', change: 1.80 }
];

export function CandleStocksChart({ isBackground = false }: { isBackground?: boolean }) {
  const [selectedStock, setSelectedStock] = useState<StockPreset>(STOCK_PRESETS[0]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState(selectedStock.basePrice);
  const [isLive, setIsLive] = useState(true);
  const [showIndicators, setShowIndicators] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [opacity, setOpacity] = useState(0.04); // subtle background default
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [elementWidth, setElementWidth] = useState(1200);

  // Sync width on window resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setElementWidth(entry.contentRect.width || 1200);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Generate initial historic candles on mount/stock-change
  useEffect(() => {
    const initialCandles: Candle[] = [];
    let price = selectedStock.basePrice - (150 * selectedStock.basePrice * selectedStock.volatility);
    
    for (let i = 0; i < 50; i++) {
      const volMultiplier = 1 + Math.random() * 2;
      const spread = price * selectedStock.volatility;
      
      const change = (Math.random() - (selectedStock.trend === 'up' ? 0.44 : selectedStock.trend === 'down' ? 0.56 : 0.5)) * spread;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * (spread * 0.4);
      const low = Math.min(open, close) - Math.random() * (spread * 0.4);
      const type = close >= open ? 'bull' : 'bear';
      const volume = Math.round(5000 + Math.random() * 15000 * volMultiplier);

      const timeLabel = new Date(Date.now() - (50 - i) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      initialCandles.push({
        id: `candle-init-${selectedStock.symbol}-${i}`,
        time: timeLabel,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume,
        type
      });

      price = close;
    }

    setCandles(initialCandles);
    setCurrentPrice(parseFloat(price.toFixed(2)));
  }, [selectedStock]);

  // Realtime Live Ticks Generator
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setCandles((prevCandles) => {
        if (prevCandles.length === 0) return prevCandles;
        const mutableCandles = [...prevCandles];
        const lastCandle = { ...mutableCandles[mutableCandles.length - 1] };

        // Volatility spread
        const spread = currentPrice * selectedStock.volatility;
        const change = (Math.random() - (selectedStock.trend === 'up' ? 0.47 : selectedStock.trend === 'down' ? 0.53 : 0.5)) * (spread * 0.2);
        
        let newClose = lastCandle.close + change;
        if (newClose < 0) newClose = 1;

        // Update the current last candlestick with dynamic fluctuating updates
        lastCandle.close = parseFloat(newClose.toFixed(2));
        lastCandle.high = parseFloat(Math.max(lastCandle.high, newClose).toFixed(2));
        lastCandle.low = parseFloat(Math.min(lastCandle.low, newClose).toFixed(2));
        lastCandle.type = lastCandle.close >= lastCandle.open ? 'bull' : 'bear';
        lastCandle.volume += Math.round(Math.random() * 50);

        mutableCandles[mutableCandles.length - 1] = lastCandle;
        setCurrentPrice(lastCandle.close);

        // Every few ticks (approx. 16 seconds), seal current candle and push a new empty one
        if (Math.random() > 0.85) {
          const nextOpen = lastCandle.close;
          const nextTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const newCandle: Candle = {
            id: `candle-tick-${selectedStock.symbol}-${Date.now()}-${Math.random()}`,
            time: nextTime,
            open: nextOpen,
            high: nextOpen,
            low: nextOpen,
            close: nextOpen,
            volume: Math.round(3000 + Math.random() * 10000),
            type: 'bull'
          };
          if (mutableCandles.length > 60) {
            mutableCandles.shift();
          }
          return [...mutableCandles, newCandle];
        }

        return mutableCandles;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isLive, currentPrice, selectedStock]);

  // Stock calculations
  const stats = useMemo(() => {
    if (candles.length < 2) return { min: 0, max: 100, sma: [] };
    const values = candles.map((c) => [c.low, c.high]).flat();
    const min = Math.min(...values) * 0.998;
    const max = Math.max(...values) * 1.002;

    // Simple 7-period Moving Average
    const sma: number[] = [];
    for (let i = 0; i < candles.length; i++) {
      if (i < 6) {
        sma.push(candles[i].close);
      } else {
        const sum = candles.slice(i - 6, i + 1).reduce((acc, c) => acc + c.close, 0);
        sma.push(sum / 7);
      }
    }

    return { min, max, sma };
  }, [candles]);

  // Coordinate scaling
  const getCoords = (price: number, index: number, total: number) => {
    const x = (index / (total - 1)) * (elementWidth - 80) + 40;
    const range = stats.max - stats.min;
    // Inverse y coordinate since SVG starts top-left
    const y = 350 - ((price - stats.min) / (range || 1)) * 260; 
    return { x, y };
  };

  const netPercentChange = useMemo(() => {
    if (candles.length < 2) return 0;
    const initialPrice = candles[0].open;
    const change = ((currentPrice - initialPrice) / initialPrice) * 100;
    return parseFloat(change.toFixed(2));
  }, [candles, currentPrice]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full overflow-hidden select-none transition-all duration-300"
      style={{ minHeight: isBackground ? '100%' : '440px' }}
    >
      {/* Background Mode Overlay: Controls backdrop layout opacity properties dynamically */}
      {!isBackground && (
        <div 
          className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-500" 
          style={{ opacity: opacity }}
        >
          <div className="absolute inset-0 bg-radial-gradient-glowing pointer-events-none"></div>
        </div>
      )}

      {/* Floating Control Panel Card - highly designed like terminal systems */}
      {!isBackground && (
        <div className="relative z-20 max-w-5xl mx-auto px-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-[#E5E7EB] dark:border-zinc-800/80 shadow-[0_10px_30px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-3">
            {/* Stock Presets selection dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#111827] dark:text-zinc-100 bg-gray-50 hover:bg-gray-150 dark:bg-zinc-950 dark:hover:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 transition-all cursor-pointer"
              >
                <span className="text-zinc-400 font-mono font-medium">{selectedStock.symbol}</span>
                <span className="font-heading truncate max-w-[130px]">{selectedStock.name}</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isSelectorOpen ? 'rotate-185' : 'rotate-0'}`} />
              </button>

              <AnimatePresence>
                {isSelectorOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsSelectorOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute left-0 mt-2 w-72 bg-white dark:bg-zinc-950 border border-[#E5E7EB] dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-20"
                    >
                      <div className="p-2 border-b border-[#E5E7EB] dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950 flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-gray-500 uppercase px-2">Select Market Preset</span>
                        <Zap className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                      </div>
                      <div className="p-1 space-y-0.5">
                        {STOCK_PRESETS.map((preset) => (
                          <button
                            key={preset.symbol}
                            onClick={() => {
                              setSelectedStock(preset);
                              setIsSelectorOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-3.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                              selectedStock.symbol === preset.symbol 
                                ? 'bg-[#22C55E]/15 text-[#22C55E] font-bold' 
                                : 'hover:bg-gray-50 dark:hover:bg-zinc-900 text-[#111827] dark:text-zinc-300'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <span className="block font-semibold">{preset.name}</span>
                              <span className="block font-mono text-[10px] text-zinc-400">{preset.symbol}</span>
                            </div>
                            <div className="text-right font-mono">
                              <span className="block">₹{preset.basePrice.toLocaleString()}</span>
                              <span className={`text-[9px] font-bold block ${preset.change >= 0 ? 'text-[#22C55E]' : 'text-[#22C55E]'}`}>
                                {preset.change >= 0 ? '+' : ''}{preset.change}%
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Price badge with real flickering action */}
            <div className={`flex flex-col font-mono text-xs p-1 px-3.5 rounded-xl border ${
              netPercentChange >= 0 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-[#22C55E]' 
                : 'bg-rose-500/10 border-rose-500/20 text-[#22C55E]'
            }`}>
              <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider leading-none">Live Price</div>
              <div className="text-sm font-extrabold flex items-center gap-1 mt-0.5">
                ₹{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                {netPercentChange >= 0 ? <TrendingUp className="h-3.5 w-3.5 animate-bounce" /> : <TrendingDown className="h-3.5 w-3.5" />}
              </div>
            </div>

            <div className="hidden lg:flex flex-col font-mono text-xs text-[#6B7280]">
              <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider leading-none">Session Variance</div>
              <span className={`text-xs mt-0.5 font-bold ${netPercentChange >= 0 ? 'text-[#22C55E]' : 'text-[#22C55E]'}`}>
                {netPercentChange >= 0 ? '+' : ''}{netPercentChange}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Backgound visibility custom scroll */}
            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-zinc-950 p-1 rounded-xl border border-gray-100 dark:border-zinc-800">
              <span className="text-[10px] uppercase font-bold text-zinc-400 px-1 font-mono">Backdrop Blur:</span>
              <input 
                type="range" 
                min="0.01" 
                max="0.45" 
                step="0.01"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#22C55E] dark:bg-zinc-800"
                title="Fade stocks chart background level"
              />
              <span className="text-[10px] text-[#6B7280] font-mono w-7 font-bold text-center">
                {Math.round(opacity * 100)}%
              </span>
            </div>

            {/* Display indicators controls */}
            <div className="flex items-center bg-gray-50 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800 p-1 text-xs font-mono">
              <button 
                onClick={() => setShowIndicators(!showIndicators)}
                className={`p-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer ${showIndicators ? 'bg-[#111827] text-white dark:bg-[#22C55E] dark:text-black font-bold' : 'text-[#6B7280]'}`}
                title="Toggle Moving Average Indicators"
              >
                MA Line
              </button>
              <button 
                onClick={() => setShowGrid(!showGrid)}
                className={`p-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer ${showGrid ? 'bg-[#111827] text-white dark:bg-[#22C55E] dark:text-black font-bold' : 'text-[#6B7280]'}`}
                title="Toggle grid overlay"
              >
                Grid
              </button>
            </div>

            {/* Live simulation control bar */}
            <button 
              onClick={() => setIsLive(!isLive)}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                isLive 
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/25 border-emerald-500/40 text-[#22C55E]' 
                  : 'bg-zinc-500/10 hover:bg-zinc-500/25 border-zinc-500/40 text-[#6B7280]'
              }`}
              title={isLive ? "Pause continuous stock updates" : "Resume simulated ticks"}
            >
              {isLive ? <Pause className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* SVG Canvas for Candles and Indicators */}
      <div className={isBackground ? "relative w-full h-full" : "relative max-w-5xl mx-auto px-4 mt-3"}>
        {/* Detail telemetry bar on hover */}
        {!isBackground && (
        <AnimatePresence>
          {hoveredCandle && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-2 left-6 right-6 z-10 flex flex-wrap justify-between items-center p-3.5 bg-zinc-950 text-white rounded-2xl border border-white/10 shadow-xl font-mono text-[11px]"
            >
              <div className="flex gap-4">
                <span>TIME: <strong className="text-sky-300">{hoveredCandle.time}</strong></span>
                <span>OPEN: <strong className="text-zinc-200">₹{hoveredCandle.open}</strong></span>
                <span>HIGH: <strong className="text-green-400">₹{hoveredCandle.high}</strong></span>
                <span>LOW: <strong className="text-red-400">₹{hoveredCandle.low}</strong></span>
                <span>CLOSE: <strong className="text-amber-300">₹{hoveredCandle.close}</strong></span>
              </div>
              <div className="flex gap-4">
                <span>VOL: <strong className="text-indigo-300">{hoveredCandle.volume.toLocaleString()}</strong></span>
                <span>CHANGE: <strong className={hoveredCandle.close >= hoveredCandle.open ? 'text-[#22C55E]' : 'text-[#22C55E]'}>
                  {(((hoveredCandle.close - hoveredCandle.open) / hoveredCandle.open) * 100).toFixed(2)}%
                </strong></span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}

        <svg 
          viewBox={`0 0 ${elementWidth} 380`} 
          className={`w-full overflow-hidden ${
            isBackground 
              ? 'bg-transparent border-none' 
              : 'bg-white/40 dark:bg-zinc-900/40 backdrop-blur-[1px] border border-[#E5E7EB]/50 dark:border-zinc-800/50 rounded-[32px]'
          }`}
          style={{ minHeight: isBackground ? '100%' : '350px' }}
        >
          {/* Grids background */}
          {showGrid && (
            <>
              {[...Array(6)].map((_, i) => {
                const y = 50 + i * 54;
                const priceVal = stats.max - (i / 5) * (stats.max - stats.min);
                return (
                  <g key={`grid-y-${i}`}>
                    <line 
                      x1="40" 
                      y1={y} 
                      x2={elementWidth - 40} 
                      y2={y} 
                      stroke="currentColor" 
                      strokeDasharray="4 6" 
                      className="text-gray-200 dark:text-zinc-800 opacity-60" 
                    />
                    <text 
                      x={elementWidth - 35} 
                      y={y + 4} 
                      className="text-[9px] font-mono fill-zinc-400 text-right font-extrabold"
                    >
                      {priceVal.toFixed(1)}
                    </text>
                  </g>
                );
              })}
              {[...Array(9)].map((_, i) => {
                const x = 40 + i * ((elementWidth - 80) / 8);
                return (
                  <line 
                    key={`grid-x-${i}`}
                    x1={x} 
                    y1="30" 
                    x2={x} 
                    y2="330" 
                    stroke="currentColor" 
                    strokeDasharray="4 6" 
                    className="text-gray-200 dark:text-zinc-800 opacity-60" 
                  />
                );
              })}
            </>
          )}

          {/* Volume bars (Bottom aligned) */}
          {candles.map((candle, idx) => {
            const { x } = getCoords(candle.close, idx, candles.length);
            const w = Math.max(1.5, (elementWidth - 80) / candles.length - 3);
            const h = (candle.volume / 25000) * 55;
            const y = 330 - h;
            return (
              <rect 
                key={`vol-${idx}`}
                x={x - w / 2}
                y={y}
                width={w}
                height={h}
                className={candle.type === 'bull' ? 'fill-emerald-500/15' : 'fill-rose-500/15'}
              />
            );
          })}

          {/* Candlestick visualization loop */}
          {candles.map((candle, idx) => {
            const openCoords = getCoords(candle.open, idx, candles.length);
            const closeCoords = getCoords(candle.close, idx, candles.length);
            const highCoords = getCoords(candle.high, idx, candles.length);
            const lowCoords = getCoords(candle.low, idx, candles.length);

            const candleWidth = Math.max(2, (elementWidth - 80) / candles.length - 4);
            const candleHeight = Math.max(2, Math.abs(openCoords.y - closeCoords.y));
            const bodyY = Math.min(openCoords.y, closeCoords.y);

            const isHovered = hoveredIndex === idx;

            return (
              <motion.g 
                key={candle.id}
                layout
                transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                onMouseEnter={() => {
                  setHoveredCandle(candle);
                  setHoveredIndex(idx);
                }}
                onMouseLeave={() => {
                  setHoveredCandle(null);
                  setHoveredIndex(null);
                }}
                className="cursor-pointer"
              >
                {/* Wick path */}
                <motion.line 
                  layout
                  initial={false}
                  animate={{
                    x1: openCoords.x,
                    y1: highCoords.y,
                    x2: openCoords.x,
                    y2: lowCoords.y,
                  }}
                  transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                  stroke={candle.type === 'bull' ? '#22C55E' : '#22C55E'}
                  strokeWidth={isHovered ? 2.5 : 1.2}
                />
                
                {/* Candle body */}
                <motion.rect 
                  layout
                  initial={false}
                  animate={{
                    x: openCoords.x - candleWidth / 2,
                    y: bodyY,
                    width: candleWidth,
                    height: candleHeight,
                  }}
                  transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                  rx={candleWidth > 4 ? 1.5 : 0.5}
                  fill={candle.type === 'bull' ? '#22C55E' : '#22C55E'}
                  className="transition-all duration-150"
                  style={{
                    filter: isHovered ? 'brightness(1.15) drop-shadow(0 0 4px currentColor)' : 'none',
                    opacity: isHovered ? 1.0 : 0.90
                  }}
                />

                {/* Vertical interactive column capture area */}
                <rect 
                  x={openCoords.x - (elementWidth - 80) / candles.length / 2}
                  y="20"
                  width={(elementWidth - 80) / candles.length}
                  height="310"
                  fill="transparent"
                />
              </motion.g>
            );
          })}

          {/* Simple 7-period EMA Line Overlay */}
          {showIndicators && candles.length > 7 && (
            <motion.path 
              animate={{
                d: candles.map((candle, idx) => {
                  const coord = getCoords(stats.sma[idx], idx, candles.length);
                  return `${idx === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`;
                }).join(' ')
              }}
              transition={{ type: 'spring', stiffness: 220, damping: 28 }}
              fill="none"
              className="stroke-indigo-500 dark:stroke-indigo-400"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                filter: 'drop-shadow(0 1px 2px rgba(99, 102, 241, 0.5))'
              }}
            />
          )}

          {/* Live closing Price horizontal line marker */}
          {candles.length > 0 && (
            <g className="transition-all duration-300">
              <motion.line 
                initial={false}
                animate={{
                  y1: getCoords(currentPrice, candles.length - 1, candles.length).y,
                  y2: getCoords(currentPrice, candles.length - 1, candles.length).y
                }}
                transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                x1="40" 
                x2={elementWidth - 40} 
                stroke={netPercentChange >= 0 ? '#22C55E' : '#22C55E'}
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <motion.circle 
                initial={false}
                animate={{
                  cy: getCoords(currentPrice, candles.length - 1, candles.length).y
                }}
                transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                cx={elementWidth - 40} 
                r="4.5" 
                fill={netPercentChange >= 0 ? '#22C55E' : '#22C55E'}
                className="animate-ping"
              />
              <motion.circle 
                initial={false}
                animate={{
                  cy: getCoords(currentPrice, candles.length - 1, candles.length).y
                }}
                transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                cx={elementWidth - 40} 
                r="3" 
                fill={netPercentChange >= 0 ? '#22C55E' : '#22C55E'}
              />
            </g>
          )}
        </svg>

        {/* Timings reference labels */}
        {!isBackground && (
          <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400 font-extrabold px-6 py-2.5">
            <span>{candles[0]?.time || '09:15 AM'} UTC (Start of Frame)</span>
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3 text-indigo-500" />
              Tick Speed: 2s (Interval updating active)
            </span>
            <span>{candles[candles.length - 1]?.time || '03:30 PM'} UTC (Active Closing Tracker)</span>
          </div>
        )}
      </div>
    </div>
  );
}
