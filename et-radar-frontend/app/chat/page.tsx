'use client'
import { useState, useEffect, useRef } from 'react'
import { streamChat } from '@/lib/api'
import { getSessionId } from '@/lib/session'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isError?: boolean
}

// Simple markdown formatter
function renderMarkdown(text: string) {
  // Bold
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  // Lists
  html = html.split('\n').map(line => {
    if (line.trim().startsWith('•')) {
      return `<li class="ml-4 list-disc">${line.replace(/^•\s*/, '')}</li>`
    }
    return line
  }).join('<br/>')

  return <div dangerouslySetInnerHTML={{ __html: html }} className="leading-relaxed" />
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [input, setInput] = useState('')
  const [hasPortfolio, setHasPortfolio] = useState(false)
  const [includePortfolio, setIncludePortfolio] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('et_radar_portfolio')
      if (stored) setHasPortfolio(true)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSubmit = async (text: string = input.trim()) => {
    if (!text || isLoading) return
    
    setInput('')
    setMessages(prev => [...prev, {
      role: 'user', content: text, timestamp: new Date()
    }])
    setIsLoading(true)
    setStreamingContent('')
    
    try {
      let full = ''
      await streamChat(
        text,
        getSessionId(),
        includePortfolio,
        (token) => {
          full += token
          setStreamingContent(full)
        },
        () => {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: full,
            timestamp: new Date()
          }])
          setStreamingContent('')
          setIsLoading(false)
        }
      )
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'AI is temporarily unavailable. Please try again.',
        timestamp: new Date(),
        isError: true
      }])
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const starterChips = [
    "What are today's top signals?",
    "Which stocks show breakout patterns?",
    "Analyse my portfolio risk",
    "Explain the biggest bulk deal today"
  ]

  return (
    <main className="flex flex-col h-[calc(100vh-65px)] dark:bg-[#0a0f1c] light:bg-gray-50 transition-colors">
      {/* TOP BAR */}
      <div className="flex justify-between items-center px-6 py-4 dark:border-[#22314a] light:border-gray-300 border-b dark:bg-[#101827]/50 light:bg-white">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-bold dark:text-[#f0fdf4] light:text-[#1f2937]">ET Radar AI</h1>
          <span className="w-2 h-2 rounded-full dark:bg-[#7dd3fc] light:bg-sky-600 animate-pulse mt-1" />
        </div>
        
        {hasPortfolio && (
          <label className="flex items-center space-x-2 cursor-pointer dark:bg-[#22314a] light:bg-gray-200 px-3 py-1.5 rounded-lg dark:border-[#2f4f75] light:border-gray-400 border dark:hover:border-[#3b82c4] light:hover:border-gray-500 transition-colors">
            <input 
              type="checkbox" 
              checked={includePortfolio}
              onChange={(e) => setIncludePortfolio(e.target.checked)}
              className="accent-[#7dd3fc] w-4 h-4 cursor-pointer"
            />
            <span className="text-sm font-medium dark:text-[#9ca3af] light:text-gray-700 select-none">Portfolio context</span>
          </label>
        )}
      </div>

      {/* MESSAGE AREA */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 dark:bg-[#22314a] light:bg-gray-200 rounded-2xl flex items-center justify-center mb-6 dark:border-[#2f4f75] light:border-gray-300 border">
              <svg className="w-8 h-8 dark:text-[#7dd3fc] light:text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <h2 className="text-2xl font-bold dark:text-[#f0fdf4] light:text-[#1f2937] mb-2">What would you like to know?</h2>
            <p className="dark:text-[#64748b] light:text-gray-600 mb-8">Ask about signals, your portfolio, or any NSE/BSE stock.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
              {starterChips.map(chip => (
                <button
                  key={chip}
                  onClick={() => handleSubmit(chip)}
                  className="rounded-full dark:border-[#22314a] light:border-gray-300 border dark:bg-[#101827] light:bg-gray-100 px-4 py-3 text-sm dark:text-[#9ca3af] light:text-gray-700 dark:hover:border-[#2f4f75] light:hover:border-sky-400 dark:hover:text-white light:hover:text-[#1f2937] transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6 pb-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full dark:bg-sky-900/40 light:bg-sky-200 dark:border-sky-800 light:border-sky-400 border flex items-center justify-center text-xs dark:text-[#7dd3fc] light:text-sky-700 font-bold mr-3 mt-1 select-none">
                    ET
                  </div>
                )}
                
                <div className="flex flex-col max-w-[80%]">
                  <div className={`px-5 py-3 text-sm ${
                    msg.role === 'user' 
                      ? 'dark:bg-[#22314a] light:bg-sky-100 rounded-2xl rounded-tr-sm dark:text-white light:text-sky-900 dark:border-[#2f4f75] light:border-sky-300 border' 
                      : msg.isError
                        ? 'dark:bg-red-900/20 light:bg-red-100 dark:border-red-900 light:border-red-300 border rounded-2xl rounded-tl-sm dark:text-red-400 light:text-red-700'
                        : 'dark:bg-[#101827] light:bg-white rounded-2xl rounded-tl-sm dark:text-[#e2e8f0] light:text-[#1f2937] dark:border-[#22314a] light:border-gray-300 border shadow-sm'
                  }`}>
                    {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                  </div>
                  <span className={`text-xs dark:text-[#64748b] light:text-gray-600 mt-1.5 ${msg.role === 'user' ? 'text-right' : 'text-left ml-1'}`}>
                    {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            
            {/* STREAMING BUBBLE */}
            {isLoading && streamingContent && (
               <div className="flex justify-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full dark:bg-sky-900/40 light:bg-sky-200 dark:border-sky-800 light:border-sky-400 border flex items-center justify-center text-xs dark:text-[#7dd3fc] light:text-sky-700 font-bold mr-3 mt-1 select-none">
                    ET
                  </div>
                  <div className="dark:bg-[#101827] light:bg-white dark:border-[#22314a] light:border-gray-300 border shadow-sm rounded-2xl rounded-tl-sm px-5 py-3 text-sm dark:text-[#e2e8f0] light:text-[#1f2937] max-w-[80%]">
                    {renderMarkdown(streamingContent)}
                    <span className="inline-block w-1.5 h-3.5 dark:bg-[#7dd3fc] light:bg-sky-600 animate-pulse ml-1 align-middle" />
                  </div>
               </div>
            )}
            
            {/* INVISIBLE SCROLL ANCHOR */}
            <div ref={messagesEndRef} className="h-2" />
          </div>
        )}
      </div>

      {/* INPUT BAR */}
      <div className="p-4 dark:bg-[#101827] light:bg-white dark:border-[#22314a] light:border-gray-300 border-t">
        <div className="max-w-3xl mx-auto relative flex items-end space-x-2">
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask about any stock, signal, or your portfolio..."
            rows={1}
            className="flex-1 dark:bg-[#22314a] light:bg-gray-100 dark:border-[#2f4f75] light:border-gray-300 border rounded-xl px-4 py-3 text-sm dark:text-white light:text-[#1f2937] dark:placeholder-[#64748b] light:placeholder-gray-500 resize-none focus:outline-none focus:border-[#7dd3fc] focus:ring-1 focus:ring-[#7dd3fc] disabled:opacity-50 min-h-[46px] max-h-32 overflow-y-auto transition-colors"
          />
          <button 
            onClick={() => handleSubmit()}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 dark:bg-[#7dd3fc] dark:hover:bg-[#bae6fd] light:bg-sky-600 light:hover:bg-sky-700 dark:disabled:bg-[#22314a] light:disabled:bg-gray-300 dark:disabled:text-[#64748b] light:disabled:text-gray-600 dark:text-[#07130f] light:text-white rounded-xl w-12 h-12 flex items-center justify-center transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 dark:border-[#64748b] light:border-gray-400 border-2 dark:border-t-white light:border-t-black rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            )}
          </button>
        </div>
      </div>
    </main>
  )
}
