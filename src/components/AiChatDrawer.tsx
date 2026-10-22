import React, { useState, useRef, useEffect } from 'react';
import { ColumnMeta } from '../types';
import { MessageSquare, Send, X, Bot, User, Sparkles, Loader2, ArrowRight } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnMeta[];
  filteredRows: Record<string, any>[];
  targetMetricCol: string;
}

export const AiChatDrawer: React.FC<AiChatDrawerProps> = ({
  isOpen,
  onClose,
  columns,
  filteredRows,
  targetMetricCol,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm TrendAI. I have real-time access to your filtered dataset (${filteredRows.length} rows loaded). Ask me anything about patterns, specific records, correlations, or anomalies!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      // Build summary metadata
      const numericCols = columns.filter((c) => c.type === 'number');
      const numericMetrics: Record<string, any> = {};
      numericCols.forEach((col) => {
        const vals = filteredRows.map((r) => Number(r[col.name])).filter((v) => !isNaN(v) && isFinite(v));
        if (vals.length) {
          let sum = 0;
          let min = vals[0];
          let max = vals[0];
          for (let i = 0; i < vals.length; i++) {
            const v = vals[i];
            sum += v;
            if (v < min) min = v;
            if (v > max) max = v;
          }
          numericMetrics[col.name] = {
            sum: Math.round(sum),
            avg: Number((sum / vals.length).toFixed(2)),
            min: Number(min.toFixed(2)),
            max: Number(max.toFixed(2)),
          };
        }
      });

      const categoricalTopValues: Record<string, string[]> = {};
      columns
        .filter((c) => c.type === 'string' && c.sampleValues)
        .forEach((c) => {
          categoricalTopValues[c.name] = c.sampleValues.slice(0, 4);
        });

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query.trim(),
          schema: columns.map((c) => ({ name: c.name, type: c.type })),
          summaryStats: {
            rowCount: filteredRows.length,
            numericMetrics,
            categoricalTopValues,
          },
          sampleRows: filteredRows.slice(0, 6),
          chatHistory: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get answer from AI');
      }

      const data = await res.json();
      const botMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content: data.answer || 'I could not generate an answer.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: `⚠️ Error: ${err.message || 'Could not communicate with server.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 sm:hidden transition-opacity"
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 max-w-full bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#ff4b4b] flex items-center justify-center text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Ask TrendAI</h3>
            <p className="text-[11px] text-slate-400">Context aware of {filteredRows.length} rows</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {[
          'Summarize top anomalies',
          'Which category has best ROI?',
          'What is the average growth rate?',
        ].map((chip) => (
          <button
            key={chip}
            onClick={() => handleSend(chip)}
            className="text-[11px] bg-white border border-slate-200 hover:border-red-400 text-slate-600 px-2.5 py-1 rounded-full whitespace-nowrap shadow-xs cursor-pointer transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#ff4b4b] text-white rounded-tr-none'
                  : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/60'
              }`}
            >
              <div className="whitespace-pre-line">{m.content}</div>
              <div
                className={`text-[9px] mt-1 text-right ${
                  m.role === 'user' ? 'text-red-200' : 'text-slate-400'
                }`}
              >
                {m.timestamp}
              </div>
            </div>
            {m.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
            <span>TrendAI is analyzing rows...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask about this dataset..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="bg-[#ff4b4b] hover:bg-[#e03a3a] disabled:opacity-40 text-white p-2 rounded-lg transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  </>
  );
};
