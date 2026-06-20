import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, RefreshCw, Sparkles, Mic, MicOff, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useRole } from '../context/RoleContext';

const matchNavigationIntent = (text: string): string | null => {
  const norm = text.toLowerCase();
  if (norm.includes('dashboard') || norm.includes('overview') || norm.includes('home') || norm.includes('main')) {
    return 'dashboard';
  }
  if (norm.includes('invoice') || norm.includes('gst') || norm.includes('billing') || norm.includes('cgst') || norm.includes('sgst')) {
    return 'invoices';
  }
  if (norm.includes('transaction') || norm.includes('ledger') || norm.includes('bank statement') || norm.includes('spend') || norm.includes('deposit')) {
    return 'transactions';
  }
  if (norm.includes('receivable') || norm.includes('payable') || norm.includes('outstanding') || norm.includes('dues')) {
    return 'receivables';
  }
  if (norm.includes('client') || norm.includes('vendor') || norm.includes('customer') || norm.includes('supplier')) {
    return 'clients';
  }
  if (norm.includes('settings') || norm.includes('setting') || norm.includes('preference') || norm.includes('admin panel') || norm.includes('user role') || norm.includes('role')) {
    return 'settings';
  }
  if (norm.includes('forecast') || norm.includes('cash flow') || norm.includes('runway') || norm.includes('projection') || norm.includes('predict') || norm.includes('trend')) {
    return 'reports';
  }
  if (norm.includes('ocr') || norm.includes('document') || norm.includes('scan') || norm.includes('receipt') || norm.includes('extract') || norm.includes('upload')) {
    return 'documents';
  }
  return null;
};

export function Copilot({ metrics }: { metrics: any }) {
  const { activeTab, setActiveTab } = useRole();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string }[]>([
    { role: 'assistant', text: "Namaste! I'm your Vriddhi AI Copilot. I can analyze your cash flow, summarize outstanding GST, or answer any financial questions. Try typing or speaking 'Go to cash flow forecast'!" }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading, isListening]);

  // Handle Text Submission
  const handleSend = async () => {
    if (!query.trim()) return;
    const userMsg = query;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setQuery('');
    setLoading(true);

    const matchTab = matchNavigationIntent(userMsg);
    if (matchTab) {
      setActiveTab(matchTab);
    }

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg, metrics })
      });
      const data = await res.json();
      
      if (data.navigateTo) {
        setActiveTab(data.navigateTo);
        setMessages(prev => [
          ...prev, 
          { 
            role: 'assistant', 
            text: `${data.answer}\n\n*🔄 Switched workspace tab to **${data.navigateTo.toUpperCase()}** based on your command.*` 
          }
        ]);
        playTextToSpeech(`Navigating to the ${data.navigateTo} workspace.`);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: data.answer || "I couldn't process that right now." }]);
      }
    } catch (e) {
      if (matchTab) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          text: `Switched page to **${matchTab.toUpperCase()}** locally. Swapping tabs is supported in offline mode!` 
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: "Offline Alert: Unable to connect to AI server. Please make sure your GEMINI_API_KEY is configured." }]);
      }
    }
    setLoading(false);
  };

  const playTextToSpeech = (text: string) => {
    if ('speechSynthesis' in window) {
      const cleanText = text.replace(/[*#_`]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-IN'; // Indian-English standard for professional accent
      utterance.rate = 1.0;
      window.speechSynthesis.cancel(); // clear previous speech before speaking
      window.speechSynthesis.speak(utterance);
    }
  };

  // voice assistant activation
  const toggleListening = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please type your query!");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-IN';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = async (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        if (transcript) {
          setIsListening(false);
          setMessages(prev => [...prev, { role: 'user', text: transcript }]);
          setLoading(true);

          const matchTab = matchNavigationIntent(transcript);
          if (matchTab) {
            setActiveTab(matchTab);
          }

          try {
            const res = await fetch('/api/copilot', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: transcript, metrics })
            });
            const data = await res.json();
            
            if (data.navigateTo) {
              setActiveTab(data.navigateTo);
              setMessages(prev => [
                ...prev, 
                { 
                  role: 'assistant', 
                  text: `${data.answer}\n\n*🔄 Voice action triggered! Switched to **${data.navigateTo.toUpperCase()}**.*` 
                }
              ]);
              playTextToSpeech(`Opening the ${data.navigateTo} workspace.`);
            } else {
              setMessages(prev => [...prev, { role: 'assistant', text: data.answer || "I received your voice: " + transcript }]);
              playTextToSpeech(data.answer || "Answer processed.");
            }
          } catch (e) {
            if (matchTab) {
              setMessages(prev => [...prev, { 
                role: 'assistant', 
                text: `Voice recognized: "${transcript}". Navigated you to **${matchTab.toUpperCase()}** successfully.` 
              }]);
              playTextToSpeech(`Showing ${matchTab}`);
            } else {
              setMessages(prev => [...prev, { role: 'assistant', text: "Unable to process voice online. Voice captured: " + transcript }]);
            }
          }
          setLoading(false);
        }
      };

      rec.onerror = (err: any) => {
        console.error("Speech Recognition Error", err);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      (window as any)._speechRecInst = rec;
      rec.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const stopSpeechRecognition = () => {
    if ((window as any)._speechRecInst) {
      try {
        (window as any)._speechRecInst.stop();
      } catch (e) {}
    }
    setIsListening(false);
  };

  return (
    <>
      {/* Interactive, Visually Appealing Floating Trigger Button */}
      <motion.button
        id="copilot-ambient-trigger"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl brand-gradient text-white flex items-center justify-center p-0 transition-all z-40 outline-none focus:ring-4 focus:ring-rose-500/30 cursor-pointer overflow-hidden border border-white/20"
        whileHover={{ scale: 1.1, rotate: 6 }}
        whileTap={{ scale: 0.92 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      >
        <span className="absolute inset-0 bg-gradient-to-tr from-[#22C55E]/40 to-[#22C55E]/40 opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-full" />
        
        <Sparkles className="h-5 w-5 drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)]" />
      </motion.button>

      {/* Chat Window Container */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-24 right-6 w-96 max-h-[580px] flex flex-col shadow-2xl border border-gray-100 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 overflow-hidden z-50"
          >
            <Card className="flex flex-col h-full border-none shadow-none rounded-none bg-inherit p-0">
              <CardHeader className="brand-gradient text-white py-4 px-5 flex flex-row items-center justify-between rounded-t-2xl">
                <div className="flex items-center space-x-2">
                  <div className="p-1 bg-white/20 rounded-lg animate-pulse">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold tracking-wide">AI Finance Copilot</CardTitle>
                    <span className="text-[10px] text-emerald-200 font-mono tracking-wider flex items-center gap-1">
                      <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" />
                      SYSTEM ONLINE
                    </span>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white hover:bg-white/10 rounded-full transition-colors" 
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-zinc-950/60 min-h-[280px] max-h-[360px]">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div 
                      className={`max-w-[80%] p-3 text-xs leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl rounded-br-none font-medium' 
                          : 'bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700/50 text-[#111827] dark:text-zinc-100 rounded-2xl rounded-bl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                
                {/* Voice listening feedback overlay with glowing grow/shrink candle bars */}
                {isListening && (
                  <div className="flex flex-col items-center justify-center p-5 bg-rose-50/70 dark:bg-zinc-800/80 border border-rose-100 dark:border-zinc-700 rounded-2xl animate-pulse space-y-3">
                    <span className="text-xs text-[#22C55E] dark:text-rose-400 font-bold flex items-center gap-1.5 tracking-wide animate-bounce">
                      <Mic className="h-4 w-4 text-[#22C55E] dark:text-rose-400 animate-pulse" /> Listening to your voice...
                    </span>
                    <div className="flex items-end space-x-[3px] h-7">
                      {[...Array(8)].map((_, idx) => (
                        <motion.div
                          key={idx}
                          animate={{ height: [4, idx % 2 === 0 ? 24 : 16, 4] }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.5 + idx * 0.08,
                            ease: "easeInOut"
                          }}
                          className={`w-[3px] rounded-full ${idx % 2 === 0 ? 'bg-[#22C55E]' : 'bg-[#22C55E]'}`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-400">Speak "Go to Cash Flow" or "Open Invoices"</span>
                  </div>
                )}

                {loading && !isListening && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 text-[#111827] dark:text-[#E5E7EB] shadow-sm p-3 rounded-2xl rounded-bl-none text-xs flex items-center space-x-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#22C55E]" />
                      <span>Analyzing general ledger...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </CardContent>
              
              <CardFooter className="p-3 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800">
                <div className="flex w-full space-x-2">
                  <Input 
                    placeholder="Type or click Mic to command..." 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={loading || isListening}
                    className="flex-1 rounded-full bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-xs text-[#111827] dark:text-zinc-50 focus-visible:ring-[#22C55E]/50 h-9"
                  />
                  
                  {/* MIC Dynamic Voice Activation Button */}
                  <Button 
                    size="icon" 
                    onClick={toggleListening} 
                    disabled={loading}
                    className={`rounded-full h-9 w-9 shadow-md flex items-center justify-center transition-all cursor-pointer ${
                      isListening 
                      ? 'bg-[#22C55E] hover:bg-[#D32F2F] text-white animate-pulse ring-4 ring-[#22C55E]/25 border-none' 
                      : 'bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-zinc-700 h-9 w-9 border-none'
                    }`}
                    title={isListening ? "Listening... click to stop" : "Speak voice command"}
                  >
                    <Mic className={`h-4 w-4 ${isListening ? 'animate-bounce' : ''}`} />
                  </Button>

                  <Button 
                    size="icon" 
                    onClick={handleSend} 
                    disabled={loading || !query.trim() || isListening} 
                    className="rounded-full h-9 w-9 bg-[#111827] dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 flex items-center justify-center"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
