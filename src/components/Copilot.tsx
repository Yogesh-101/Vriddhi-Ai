import React, { useState, useEffect, useRef } from 'react';
import { Send, X, RefreshCw, Sparkles, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useRole } from '../context/RoleContext';
import {
  askCopilot,
  dispatchDataRefresh,
  dispatchInvoiceDraft,
  type InvoiceDraft,
} from '../lib/ai-api';

const SUGGESTIONS = [
  'Create invoice for Alpha Corp — 40 hrs @ ₹5000, due in 15 days',
  'Send reminders for all overdue invoices',
  'What is my revenue and profit this month?',
  'Go to receivables',
];

export function Copilot({ metrics }: { metrics: Record<string, unknown> }) {
  const { activeTab, setActiveTab } = useRole();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: "Namaste! I'm your AI Finance Copilot. I can **create GST invoices** from plain English, **send overdue reminders**, **mark invoices paid**, audit compliance, and navigate anywhere. Try: \"Create invoice for Alpha Corp — 40 hours @ ₹5000\"",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading, isListening]);

  const processCopilotResponse = async (userMsg: string) => {
    setLoading(true);
    try {
      const data = await askCopilot({ query: userMsg, metrics });

      if (data.navigateTo) {
        setActiveTab(data.navigateTo);
      }

      if (data.invoiceDraft?.items?.length) {
        dispatchInvoiceDraft(data.invoiceDraft as InvoiceDraft);
        if (!data.navigateTo) setActiveTab('invoices');
      }

      if (data.actionResult?.details?.length) {
        dispatchDataRefresh();
      }

      let reply = data.answer || "I couldn't process that right now.";
      if (data.navigateTo) {
        reply += `\n\n*Opened **${data.navigateTo.toUpperCase()}** workspace.*`;
      }
      if (data.invoiceDraft?.items?.length) {
        reply += `\n\n*Invoice draft ready — review line items in the GST Invoices form.*`;
      }

      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);

      if (data.navigateTo) {
        playTextToSpeech(`Opening ${data.navigateTo}`);
      } else if (data.action?.type === 'send_overdue_reminders') {
        playTextToSpeech('Payment reminders dispatched.');
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Unable to reach AI server. Ensure you are logged in and GEMINI_API_KEY is configured.',
        },
      ]);
    }
    setLoading(false);
  };

  const handleSend = async (text?: string) => {
    const userMsg = (text ?? query).trim();
    if (!userMsg) return;
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setQuery('');
    await processCopilotResponse(userMsg);
  };

  const playTextToSpeech = (text: string) => {
    if ('speechSynthesis' in window) {
      const cleanText = text.replace(/[*#_`]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-IN';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

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
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-IN';

      rec.onstart = () => setIsListening(true);

      rec.onresult = async (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setIsListening(false);
        if (transcript) {
          setMessages((prev) => [...prev, { role: 'user', text: transcript }]);
          await processCopilotResponse(transcript);
        }
      };

      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);

      (window as any)._speechRecInst = rec;
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  const stopSpeechRecognition = () => {
    if ((window as any)._speechRecInst) {
      try {
        (window as any)._speechRecInst.stop();
      } catch {
        /* ignore */
      }
    }
    setIsListening(false);
  };

  return (
    <>
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
        <Sparkles className="h-5 w-5 drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)]" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="fixed bottom-24 right-6 w-[26rem] max-h-[620px] flex flex-col shadow-2xl border border-gray-100 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 overflow-hidden z-50"
          >
            <Card className="flex flex-col h-full border-none shadow-none rounded-none bg-inherit p-0">
              <CardHeader className="brand-gradient text-white py-4 px-5 flex flex-row items-center justify-between rounded-t-2xl">
                <div className="flex items-center space-x-2">
                  <div className="p-1 bg-white/20 rounded-lg">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold tracking-wide">AI Finance Copilot</CardTitle>
                    <span className="text-[10px] text-emerald-200 font-mono tracking-wider flex items-center gap-1">
                      <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" />
                      AGENT MODE — ACTIONS ENABLED
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/10 rounded-full"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-zinc-950/60 min-h-[300px] max-h-[380px]">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] p-3 text-xs leading-relaxed shadow-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl rounded-br-none font-medium'
                          : 'bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700/50 text-[#111827] dark:text-zinc-100 rounded-2xl rounded-bl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {messages.length <= 2 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSend(s)}
                        className="text-[10px] px-2.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors text-left"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {isListening && (
                  <div className="flex flex-col items-center p-4 bg-rose-50/70 dark:bg-zinc-800/80 border border-rose-100 dark:border-zinc-700 rounded-2xl animate-pulse">
                    <Mic className="h-5 w-5 text-[#22C55E] animate-pulse mb-2" />
                    <span className="text-xs text-[#22C55E] font-bold">Listening…</span>
                  </div>
                )}

                {loading && !isListening && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-zinc-800 border text-xs p-3 rounded-2xl rounded-bl-none flex items-center gap-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#22C55E]" />
                      <span>Running AI agent…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              <CardFooter className="p-3 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800">
                <div className="flex w-full space-x-2">
                  <Input
                    placeholder='e.g. "Create invoice for Beta Inc — consulting ₹2L"'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={loading || isListening}
                    className="flex-1 rounded-full bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-xs h-9"
                  />
                  <Button
                    size="icon"
                    onClick={toggleListening}
                    disabled={loading}
                    className={`rounded-full h-9 w-9 ${isListening ? 'bg-[#22C55E] text-white animate-pulse' : 'bg-indigo-50 dark:bg-zinc-800 text-indigo-600'}`}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={() => handleSend()}
                    disabled={loading || !query.trim() || isListening}
                    className="rounded-full h-9 w-9 bg-[#111827] dark:bg-zinc-100 text-white dark:text-zinc-900"
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
