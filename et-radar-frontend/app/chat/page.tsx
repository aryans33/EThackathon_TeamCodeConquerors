/* eslint-disable */
"use client"
import React, { useState, useEffect, useRef } from "react"
import { Send, Bot } from "lucide-react"
import { getSessionId } from "@/lib/session"
import { DEMO_MODE } from "@/lib/api"

interface Message {
  role: 'user' | 'assistant'
  content: string
  ts: number
  isError?: boolean
}

const CHIPS = [
  "What are today's top signals?",
  "Analyse my portfolio risk",
  "Which stocks show breakout patterns today?",
  "Explain the biggest bulk deal today"
]

const DEMO_RESPONSES: Record<string, string> = {
  "signals": "Based on today's activity, I'm seeing strong signals for **TATAMOTORS** with 84% confidence — Q3 PAT beat estimates by 48% driven by EV segment growth.\n\n**HDFCBANK** also shows institutional accumulation with a ₹1,642 bulk buy from Goldman Sachs.",
  "portfolio": "Your portfolio shows a 14.7% XIRR which is healthy. However, there's a 62% overlap between Mirae Asset Large Cap and HDFC Mid Cap — consider consolidating one of them.",
  "default": "I'm analysing the latest market data for you. Today's NSE saw broad-based buying in Banking and Auto sectors.\n\nKey signals include:\n• 2 earnings beats\n• 1 bulk deal worth noting."
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [hasPortfolio, setHasPortfolio] = useState(false)
  const [includePortfolio, setIncludePortfolio] = useState(true)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('et_radar_portfolio')
      if (stored || DEMO_MODE) {
        setHasPortfolio(true)
      }
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSubmit = () => {
    if (!inputValue.trim() || isLoading) return
    const msg = inputValue.trim()
    setInputValue("")
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    streamMessage(msg)
  }

  const handleChipClick = (msg: string) => {
    if (isLoading) return
    streamMessage(msg)
  }

  const streamMessage = async (userMessage: string) => {
    setMessages(prev => [...prev, {role:'user', content:userMessage, ts:Date.now()}])
    setIsLoading(true)
    setStreamingContent('')
    
    if (DEMO_MODE) {
      await new Promise(r => setTimeout(r, 600))
      const lowerMsg = userMessage.toLowerCase()
      let responseKey = "default"
      if (lowerMsg.includes("signal") || lowerMsg.includes("breakout") || lowerMsg.includes("bulk")) {
        responseKey = "signals"
      } else if (lowerMsg.includes("portfolio") || lowerMsg.includes("risk")) {
        responseKey = "portfolio"
      }
      
      const targetText = DEMO_RESPONSES[responseKey]
      let currentText = ""
      for (let i = 0; i < targetText.length; i++) {
        currentText += targetText[i]
        setStreamingContent(currentText)
        await new Promise(r => setTimeout(r, 20))
      }
      
      setMessages(prev => [...prev, {role:'assistant', content:currentText, ts:Date.now()}])
      setStreamingContent('')
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/chat`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          message: userMessage,
          session_id: getSessionId(),
          include_portfolio: includePortfolio
        })
      })
      
      if (!res.ok) throw new Error('API error')
      
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      
      while (true) {
        const {done, value} = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullContent += chunk
        setStreamingContent(fullContent)
      }
      
      setMessages(prev => [...prev, {role:'assistant', content:fullContent, ts:Date.now()}])
      setStreamingContent('')
    } catch (e) {
      setMessages(prev => [...prev, {role:'assistant', content:'AI is temporarily unavailable. Please try again.', ts:Date.now(), isError:true}])
    } finally {
      setIsLoading(false)
    }
  }

  const renderMarkdown = (text: string) => {
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-brand-text font-semibold">$1</strong>')
      .replace(/• (.*?)(?=\n|$)/g, '<div class="flex items-start gap-2 mt-1"><div class="w-1.5 h-1.5 rounded-full bg-brand-green mt-1.5 shrink-0"></div><span class="flex-1">$1</span></div>')
      .replace(/\n\n/g, '<div class="h-3"></div>')
      .replace(/\n(?!\<div)/g, '<br/>')
    return { __html: html }
  }

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-brand-card/30 border border-brand-border rounded-xl overflow-hidden shadow-2xl">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border bg-brand-bg">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-brand-text tracking-tight">ET Radar AI</h1>
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-green"></span>
          </div>
        </div>

        {hasPortfolio && (
          <label className="flex items-center gap-3 cursor-pointer group">
            <span className="text-sm font-medium text-brand-muted group-hover:text-brand-muted transition-colors">Portfolio context</span>
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={includePortfolio}
                onChange={() => setIncludePortfolio(!includePortfolio)}
              />
              <div className={`block w-10 h-6 rounded-full transition-colors duration-300 ${includePortfolio ? 'bg-brand-green' : 'bg-slate-700'}`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${includePortfolio ? 'transform translate-x-4' : ''}`}></div>
            </div>
          </label>
        )}
      </div>

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-brand-bg scroll-smooth">
        {messages.length === 0 && !isLoading && !streamingContent ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center animate-in fade-in zoom-in duration-500">
            <h2 className="text-3xl font-bold text-brand-text mb-3 tracking-tight">What would you like to know?</h2>
            <p className="text-brand-muted mb-10 text-base">Ask about signals, your portfolio, or any NSE/BSE stock</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
              {CHIPS.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleChipClick(chip)}
                  className="rounded-full border border-brand-border bg-brand-card px-5 py-3 text-sm text-brand-muted hover:border-brand-green hover:text-brand-text transition-all text-left shadow-sm hover:shadow-brand-green/10"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto pb-4 pt-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-end gap-3 max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-brand-green/20 border border-brand-green/40 flex items-center justify-center shrink-0 mb-1 shadow-inner">
                      <span className="text-brand-green text-xs font-bold">ET</span>
                    </div>
                  )}
                  
                  <div className={`px-5 py-3.5 text-[14.5px] leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-[#1e3a5f] rounded-2xl rounded-tr-sm text-brand-text' 
                      : msg.isError 
                        ? 'bg-brand-red/10 border border-brand-red/20 rounded-2xl rounded-tl-sm text-brand-red'
                        : 'bg-brand-card border border-brand-border rounded-2xl rounded-tl-sm text-brand-muted'
                  }`}>
                    {msg.role === 'assistant' && !msg.isError ? (
                      <div dangerouslySetInnerHTML={renderMarkdown(msg.content)} className="whitespace-pre-wrap" />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
                <span className={`text-[11px] font-medium text-slate-500 mt-2 ${msg.role === 'user' ? 'mr-1' : 'ml-12'}`}>
                  {formatTime(msg.ts)}
                </span>
              </div>
            ))}
            
            {/* Streaming Message State */}
            {(isLoading || streamingContent) && (
              <div className="flex flex-col items-start animate-in fade-in duration-300">
                <div className="flex items-end gap-3 max-w-[85%] md:max-w-[75%] flex-row">
                  <div className="w-8 h-8 rounded-full bg-brand-green/20 border border-brand-green/40 flex items-center justify-center shrink-0 mb-1 shadow-inner">
                    <span className="text-brand-green text-xs font-bold">ET</span>
                  </div>
                  
                  <div className="px-5 py-3.5 text-[14.5px] leading-relaxed shadow-sm bg-brand-card border border-brand-border rounded-2xl rounded-tl-sm text-brand-muted min-w-[60px] min-h-[52px]">
                    {streamingContent ? (
                      <div className="whitespace-pre-wrap">
                        <span dangerouslySetInnerHTML={renderMarkdown(streamingContent)} />
                        <span className="inline-block w-2.5 h-4 ml-1 bg-brand-green animate-pulse align-middle rounded-sm" />
                      </div>
                    ) : (
                      <div className="flex items-center h-full gap-1.5 px-2">
                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-6" />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-brand-bg border-t border-brand-border relative">
        <div className="max-w-4xl mx-auto relative">
          {includePortfolio && hasPortfolio && (
            <div className="absolute -top-11 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-brand-card border border-brand-border text-brand-green text-[11px] px-3 py-1.5 rounded-full uppercase font-bold tracking-wider shadow-lg shadow-black/20">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
              Portfolio context active
            </div>
          )}
          
          <div className="flex items-end gap-3 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
              className="flex-1 bg-brand-card border border-brand-border rounded-xl px-5 py-4 text-[15px] text-brand-text placeholder-slate-500 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/50 transition-all resize-none disabled:opacity-50 overflow-y-auto min-h-[56px] max-h-[160px] shadow-sm"
              placeholder="Ask about any stock, signal or your portfolio..."
            />
            <button
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isLoading}
              className="bg-brand-green hover:bg-[#00a866] text-[#0a0e1a] rounded-xl p-4 flex items-center justify-center shrink-0 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-sm font-semibold"
            >
              <Send className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
