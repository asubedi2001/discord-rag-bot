import React, { useState, useRef, useEffect } from "react";
import { sendQuery } from "../lib/api";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
}

interface ChatProps {
  readonly token: string;
}

export default function Chat({ token }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // smooth scroll to last message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  async function handleSubmit() {
    const query = input.trim();
    if (!query || isLoading) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: query }]);
    setInput("");
    setIsLoading(true);

    try {
      // sendQuery returns the full Ollama-generated response string (data.response)
      const response = await sendQuery(token, query);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "bot", content: response }]);
    } catch (err) {
      console.error("Failed to send query to AI engine:", err);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "bot", content: "Sorry, something went wrong connecting to the AI engine." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // submit on Enter
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0e0f17]">

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 shrink-0">
        <h2 className="text-sm font-semibold text-white">Chat</h2>
        <p className="text-xs text-slate-500 mt-0.5">Ask questions about your uploaded documents</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin min-h-0">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#5865F2]/10 border border-[#5865F2]/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-[#5865F2]/50" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-8 13H8v-2h4v2zm4-4H8V9h8v2z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">Ask about your documents…</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {/* Bot avatar */}
            {msg.role === "bot" && (
              <div className="w-7 h-7 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/30 flex items-center justify-center shrink-0 mr-3 mt-1">
                <svg className="w-3.5 h-3.5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
                </svg>
              </div>
            )}

            <div
              className={`
                max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                ${msg.role === "user"
                  ? "bg-[#5865F2] text-white rounded-tr-sm"
                  : "bg-[#1a1b28] border border-white/5 text-slate-200 rounded-tl-sm"
                }
              `}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Bot typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/30 flex items-center justify-center shrink-0 mr-3 mt-1">
              <svg className="w-3.5 h-3.5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
              </svg>
            </div>
            <div className="bg-[#1a1b28] border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 py-4 border-t border-white/5 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
          className="flex items-end gap-2 bg-[#1a1b28] border border-white/10 rounded-2xl px-4 py-3 focus-within:border-[#5865F2]/50 transition-colors"
        >
          <textarea
            ref={textareaRef}
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your documents… (Enter to send)"
            rows={1}
            disabled={isLoading}
            className="
              flex-1 bg-transparent resize-none text-sm text-slate-200 placeholder-slate-600
              focus:outline-none leading-relaxed min-h-[24px]
              disabled:opacity-50
            "
            aria-label="Chat input"
          />
          <button
            id="btn-send-message"
            type="submit"
            disabled={isLoading || !input.trim()}
            className="
              w-8 h-8 shrink-0 flex items-center justify-center rounded-xl
              bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3c45a5]
              disabled:opacity-40 disabled:cursor-not-allowed
              text-white transition-all duration-150
              shadow-md shadow-[#5865F2]/30
            "
            aria-label="Send message"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          </button>
        </form>
        <p className="text-[10px] text-slate-700 text-center mt-2">Shift+Enter for new line</p>
      </div>
    </div>
  );
}
