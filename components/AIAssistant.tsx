
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Key, ExternalLink, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getPayrollAdvice, getGeminiApiKey, setGeminiApiKey } from '../services/geminiService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm your BharatPay Compliance Assistant. I can help with questions about EPF, ESI, Gratuity, and Income Tax rules in India. What's on your mind today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyStatusMsg, setKeyStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if key is current
    getGeminiApiKey().then(currentKey => {
      setKeyInput(currentKey);
    });
  }, [showKeyModal]);

  useEffect(() => {
    if (loading && scrollRef.current) {
      // Auto-scroll to bottom while AI is generating
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [loading]);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        // Scroll to bottom for user message
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      } else {
        // Scroll to the START of the assistant response as requested
        // Using a small timeout to ensure DOM layout is updated
        setTimeout(() => {
          lastMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [messages]);

  const handleSaveKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      await setGeminiApiKey('');
      setKeyStatusMsg({ type: 'error', text: 'API key cleared. AI features will require a valid key.' });
      return;
    }
    await setGeminiApiKey(trimmed);
    setKeyStatusMsg({ type: 'success', text: 'API Key saved successfully! You can now use Compliance AI.' });
    setTimeout(() => {
      setShowKeyModal(false);
      setKeyStatusMsg(null);
    }, 1500);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    const advice = await getPayrollAdvice(userMsg);
    setMessages(prev => [...prev, { role: 'assistant', content: advice || "I'm sorry, I couldn't process that request." }]);
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden text-slate-900 relative">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Bot size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Compliance Expert AI</h3>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Powered by Gemini</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <Sparkles size={14} className="text-amber-400" />
            Up-to-date with FY 2024-25 laws
          </div>
          <button
            onClick={() => {
              getGeminiApiKey().then(k => setKeyInput(k));
              setKeyStatusMsg(null);
              setShowKeyModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200/70 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-300/60"
            title="Configure Gemini API Key"
          >
            <Key size={13} className="text-blue-600" />
            <span>API Key</span>
          </button>
        </div>
      </div>


      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50"
      >
        {messages.map((msg, i) => (
          <div 
            key={i} 
            ref={i === messages.length - 1 ? lastMessageRef : null}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-blue-600 text-white'
                }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-white border border-slate-200 text-slate-700 shadow-sm rounded-tl-none'
                }`}>
                {msg.content.split('\n').map((line, idx) => (
                  <p key={idx} className={idx > 0 ? 'mt-2' : ''}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-2xl rounded-tl-none flex gap-1">
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        <div className="relative">
          <input
            type="text"
            placeholder="Ask about EPF ceiling, TDS rates, Gratuity formula..."
            title="Search or Ask AI"
            aria-label="Ask about EPF ceiling, TDS rates, Gratuity formula..."
            className="w-full pl-4 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-slate-900"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            title="Send Message"
            aria-label="Send Message"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors shadow-lg shadow-blue-100"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-center text-slate-400">
          AI advice should be verified with official legal documentation or a professional consultant.
        </p>
      </div>

      {/* Gemini API Key Configuration Modal */}
      {showKeyModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Key size={18} />
                </div>
                <h4 className="font-bold text-slate-800 text-base">Gemini API Key</h4>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                BharatPay Pro uses Google's Gemini AI engine for instant payroll and labor compliance assistance.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Enter Gemini API Key
                </label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800"
                />
              </div>

              {keyStatusMsg && (
                <div className={`p-3 rounded-xl flex items-start gap-2 text-xs ${
                  keyStatusMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {keyStatusMsg.type === 'success' ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <span>{keyStatusMsg.text}</span>
                </div>
              )}

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1.5">
                <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                  How to get a key?
                </span>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  You can generate a free API key in seconds from Google AI Studio.
                </p>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline mt-1"
                >
                  Open Google AI Studio <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveKey}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-200 transition-colors"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
