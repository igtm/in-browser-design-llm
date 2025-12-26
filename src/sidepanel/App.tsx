import React, { useState, useEffect, useRef } from 'react'
import { IoSend, IoSparkles, IoCameraOutline, IoCodeSlashOutline, IoSettingsOutline, IoExpandOutline, IoCloseCircleOutline, IoTimeOutline, IoChatbubbleEllipsesOutline, IoRefreshOutline, IoTrashOutline, IoCopyOutline, IoCheckmarkOutline, IoWarningOutline, IoImageOutline } from 'react-icons/io5'
import { callGeminiDesign, DOMOperation, GeminiUsage } from './gemini'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  summary?: string
  attachedImage?: string
  type?: 'error' | 'info'
  operations?: DOMOperation[]
  undoOperations?: DOMOperation[]
  operationResults?: { selector: string, success: boolean, error?: string }[]
  rootSelector?: string
  usage?: GeminiUsage
}

interface ChatSession {
  id: string
  name: string
  messages: Message[]
  sessionBaseline: { html: string, screenshot: string | null } | null
  estTokens: number
}

interface HistoryItem {
  id: string
  timestamp: number
  url: string
  instruction: string
  summary?: string
  attachedImage?: string
  operations: DOMOperation[]
  undoOperations?: DOMOperation[]
  operationResults?: { selector: string, success: boolean, error?: string }[]
  rootSelector?: string
  usage?: GeminiUsage
}


const UsageStats: React.FC<{ usage: GeminiUsage }> = ({ usage }) => {
  const inputCost = (usage.promptTokenCount / 1_000_000) * 0.50
  const outputCost = (usage.candidatesTokenCount / 1_000_000) * 3.00
  const totalCost = inputCost + outputCost

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[10px] text-slate-400 font-medium">
      <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/50">
        In: {usage.promptTokenCount.toLocaleString()}
      </span>
      <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/50">
        Out: {usage.candidatesTokenCount.toLocaleString()}
      </span>
      <span className="flex items-center gap-1 text-indigo-500 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">
        Est: ${totalCost.toFixed(5)}
      </span>
    </div>
  )
}

const CopyButton: React.FC<{ content: any, className?: string }> = ({ content, className }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 transition-all ${className} ${copied ? 'text-green-500 hover:text-green-600' : ''
        }`}
      title="Copy to clipboard"
    >
      {copied ? <IoCheckmarkOutline size={14} /> : <IoCopyOutline size={14} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

const TokenDonut: React.FC<{ current: number, max: number }> = ({ current, max }) => {
  const percentage = Math.min(Math.round((current / max) * 100), 100)
  const radius = 9
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  let color = 'text-indigo-500'
  if (percentage > 80) color = 'text-red-500'
  else if (percentage > 50) color = 'text-amber-500'

  return (
    <div className="relative group flex items-center justify-center" title={`Est. ${current.toLocaleString()} / ${max.toLocaleString()} tokens`}>
      <svg className="w-6 h-6 transform -rotate-90">
        <circle
          cx="12"
          cy="12"
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
          fill="transparent"
          className="text-slate-100"
        />
        <circle
          cx="12"
          cy="12"
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${color} transition-all duration-500 ease-out`}
        />
      </svg>
      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] py-1 px-2 rounded -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-50 pointer-events-none shadow-xl border border-slate-700">
        {percentage}% ({current.toLocaleString()} / {max.toLocaleString()})
      </div>
    </div>
  )
}

const App: React.FC = () => {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [selectedElement, setSelectedElement] = useState<{ selector: string, html: string } | null>(null)
  const [selecting, setSelecting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [sendScreenshot, setSendScreenshot] = useState(false)
  const [filterByDomain, setFilterByDomain] = useState(true)
  const [activeUrl, setActiveUrl] = useState('')
  const [attachedImage, setAttachedImage] = useState<string | null>(null)

  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: 'default',
      name: 'Chat 1',
      messages: [{ role: 'assistant', content: 'Hello! I can help you design this page. Give me an instruction!' }],
      sessionBaseline: null,
      estTokens: 0
    }
  ])
  const [activeSessionId, setActiveSessionId] = useState('default')

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0]
  const messages = activeSession.messages
  const sessionBaseline = activeSession.sessionBaseline
  const estTokens = activeSession.estTokens

  const MAX_TOKENS = 1000000
  const MAX_SESSIONS = 6
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadSettings = () => {
    chrome.storage.local.get(['geminiApiKey', 'history', 'sendScreenshot', 'filterByDomain', 'sessions', 'activeSessionId'], (result) => {
      setApiKey((result.geminiApiKey as string) || '')
      if (result.history) setHistory(result.history as HistoryItem[])
      if (result.sendScreenshot !== undefined) setSendScreenshot(result.sendScreenshot as boolean)
      if (result.filterByDomain !== undefined) setFilterByDomain(result.filterByDomain as boolean)
      if (result.sessions) setSessions(result.sessions as ChatSession[])
      if (result.activeSessionId) setActiveSessionId(result.activeSessionId as string)
    })
  }

  const updateActiveSession = (update: Partial<ChatSession>) => {
    const newSessions = sessions.map(s => s.id === activeSessionId ? { ...s, ...update } : s)
    setSessions(newSessions)
    chrome.storage.local.set({ sessions: newSessions })
  }

  const setMessages = (updateFn: (prev: Message[]) => Message[]) => {
    const newMessages = updateFn(messages)
    updateActiveSession({ messages: newMessages })
  }

  const setSessionBaseline = (baseline: { html: string, screenshot: string | null } | null) => {
    updateActiveSession({ sessionBaseline: baseline })
  }

  const setEstTokens = (tokens: number) => {
    updateActiveSession({ estTokens: tokens })
  }

  const createNewSession = () => {
    if (sessions.length >= MAX_SESSIONS) return
    const newId = Date.now().toString()
    const newSession: ChatSession = {
      id: newId,
      name: `Chat ${sessions.length + 1}`,
      messages: [{ role: 'assistant', content: 'Hello! I can help you design this page. Give me an instruction!' }],
      sessionBaseline: null,
      estTokens: 0
    }
    const newSessions = [...sessions, newSession]
    setSessions(newSessions)
    setActiveSessionId(newId)
    chrome.storage.local.set({ sessions: newSessions, activeSessionId: newId })
  }

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (sessions.length <= 1) return
    const newSessions = sessions.filter(s => s.id !== id)
    setSessions(newSessions)
    if (activeSessionId === id) {
      const remainingId = newSessions[0].id
      setActiveSessionId(remainingId)
      chrome.storage.local.set({ sessions: newSessions, activeSessionId: remainingId })
    } else {
      chrome.storage.local.set({ sessions: newSessions })
    }
  }

  const switchSession = (id: string) => {
    setActiveSessionId(id)
    chrome.storage.local.set({ activeSessionId: id })
  }

  useEffect(() => {
    loadSettings()

    // Get current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) setActiveUrl(tabs[0].url)
    })

    const handleTabActivated = (activeInfo: { tabId: number, windowId: number }) => {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url) setActiveUrl(tab.url)
      })
    }

    const handleTabUpdated = (_tabId: number, changeInfo: { url?: string }, _tab: any) => {
      if (changeInfo.url) setActiveUrl(changeInfo.url)
    }

    chrome.tabs.onActivated.addListener((activeInfo) => {
      handleTabActivated(activeInfo)
      setSelecting(false) // Reset on tab switch
    })
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      handleTabUpdated(tabId, changeInfo, tab)
      if (changeInfo.status === 'loading' || changeInfo.url) {
        setSelecting(false) // Reset on refresh or navigation
      }
    })

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.selectedElement?.newValue) {
        const data = changes.selectedElement.newValue as { selector: string, html: string };
        setSelectedElement({ selector: data.selector, html: data.html });
        setSelecting(false);
        setMessages(prev => [...prev, {
          role: 'system',
          type: 'info',
          content: `Focused on element: ${data.selector}`
        }]);

        // Clear selection from storage after picking it up to avoid re-triggering on reload
        // but keep it in component state
        chrome.storage.local.remove('selectedElement');
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selecting) {
        stopElementSelection()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    }
  }, [selecting])

  useEffect(() => {
    // Estimate tokens
    const estimateTokens = () => {
      let text = input
      messages.forEach(m => {
        text += m.content
      })

      // Rough estimate: 4 chars per token
      let count = Math.ceil(text.length / 4)

      // Add image tokens (1120 per image)
      if (attachedImage) count += 1120
      if (sendScreenshot) count += 1120

      // Add historical image tokens if any (keeping it simple for now)
      messages.forEach(m => {
        if (m.attachedImage) count += 1120
      })

      // Add baseline HTML tokens if session started
      if (sessionBaseline) {
        count += Math.ceil(sessionBaseline.html.length / 4)
      } else {
        // If not started, the next capture will add tokens
        // We can't know exactly yet, but we'll update after first send
      }

      setEstTokens(count)
    }
    estimateTokens()
  }, [input, messages, attachedImage, sendScreenshot, sessionBaseline])

  useEffect(() => {
    // Auto-scroll
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const stopElementSelection = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab.id) return
    setSelecting(false)
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'STOP_SELECTION' })
    } catch (err) {
      console.warn('Failed to send stop message:', err)
    }
  }

  const startElementSelection = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab.id) return

    if (selecting) {
      stopElementSelection()
      return
    }

    setSelecting(true)
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'START_SELECTION' })
    } catch (err) {
      console.warn('Message failed, trying direct execution:', err)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // @ts-ignore
            if (window.__startSelection) {
              // @ts-ignore
              window.__startSelection();
            } else {
              throw new Error('Selection logic not found in page. Please refresh the page.');
            }
          }
        })
      } catch (innerErr: any) {
        console.error('Failed to start selection:', innerErr)
        setSelecting(false)
        setMessages(prev => [...prev, {
          role: 'system',
          type: 'error',
          content: innerErr.message || 'Connection failed.'
        }])
      }
    }
  }

  const captureContext = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab.id || !tab.url) return null

    // Avoid restricted pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Cannot access restricted internal Chrome pages. Please try on a regular website.')
    }

    // Capture screenshot if enabled
    let screenshot = null
    if (sendScreenshot) {
      screenshot = await chrome.tabs.captureVisibleTab()
    }

    // Get HTML via content script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: false },
      func: (selector?: string) => {
        const fullHtml = document.documentElement.outerHTML
        let targetHtml = null
        if (selector) {
          const el = document.querySelector(selector)
          if (el) targetHtml = el.outerHTML
        }
        return { fullHtml, targetHtml }
      },
      args: [selectedElement?.selector]
    })

    const { fullHtml, targetHtml } = results[0].result as { fullHtml: string, targetHtml: string | null }

    let html = ""
    if (selectedElement && targetHtml) {
      html = `TARGET ELEMENT:\n${targetHtml}\n\nFULL PAGE CONTEXT (TRUNCATED):\n${fullHtml.substring(0, 10000)}`
    } else {
      html = fullHtml
    }

    return { html, screenshot }
  }

  const applyOperations = async (ops: DOMOperation[], rootSelector?: string) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab.id) return { undoOps: [], results: [] }

    const response = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (ops: DOMOperation[], rootSelector?: string) => {
        const undoOps: DOMOperation[] = []
        const results: { selector: string, success: boolean, error?: string }[] = []
        const root = rootSelector ? document.querySelector(rootSelector) as HTMLElement : document.body

        if (rootSelector && !root) {
          return { undoOps: [], results: [{ selector: rootSelector, success: false, error: 'Root element not found' }] }
        }

        ops.forEach(op => {
          try {
            let el: HTMLElement | null = null

            if (op.selector === ':scope' || op.selector === '') {
              el = root as HTMLElement
            } else if (root) {
              el = root.querySelector(op.selector) as HTMLElement
              if (!el && !rootSelector) {
                el = document.querySelector(op.selector) as HTMLElement
              }
            }

            if (!el) {
              results.push({ selector: op.selector, success: false, error: 'Element not found' })
              return
            }

            // Capture state for undo
            if (op.action === 'replace' || op.action === 'append' || op.action === 'prepend') {
              undoOps.unshift({
                selector: op.selector,
                action: 'replace',
                content: el.innerHTML
              })
            } else if (op.action === 'setStyle' && op.styles) {
              const oldStyles: Record<string, string> = {}
              Object.keys(op.styles).forEach(styleKey => {
                oldStyles[styleKey] = el!.style[styleKey as any]
              })
              undoOps.unshift({
                selector: op.selector,
                action: 'setStyle',
                styles: oldStyles
              })
            } else if (op.action === 'remove') {
              const parent = el.parentElement
              if (parent) {
                const parentSelector = parent.id ? `#${parent.id}` : op.selector.split('>').slice(0, -1).join('>') || 'body'
                undoOps.unshift({
                  selector: parentSelector,
                  action: 'replace',
                  content: parent.innerHTML
                })
              }
            }

            // Apply operation
            switch (op.action) {
              case 'replace':
                el.innerHTML = op.content || ''
                break
              case 'append':
                el.insertAdjacentHTML('beforeend', op.content || '')
                break
              case 'prepend':
                el.insertAdjacentHTML('afterbegin', op.content || '')
                break
              case 'setStyle':
                if (op.styles) {
                  Object.assign(el.style, op.styles)
                }
                break
              case 'remove':
                el.remove()
                break
            }
            results.push({ selector: op.selector, success: true })
          } catch (e: any) {
            results.push({ selector: op.selector, success: false, error: e.message })
          }
        })
        return { undoOps, results }
      },
      args: [ops, rootSelector],
    })
    return (response[0].result as { undoOps: DOMOperation[], results: any[] }) || { undoOps: [], results: [] }
  }

  const saveToHistory = (instruction: string, operations: DOMOperation[], undoOperations: DOMOperation[], rootSelector?: string, usage?: GeminiUsage, operationResults?: { selector: string, success: boolean, error?: string }[], summary?: string, attachedImage?: string | null) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        url: tab?.url || '',
        instruction,
        summary,
        attachedImage: attachedImage || undefined,
        operations,
        undoOperations,
        operationResults,
        rootSelector,
        usage
      }
      const newHistory = [newItem, ...history].slice(0, 50)
      setHistory(newHistory)
      chrome.storage.local.set({ history: newHistory })
    })
  }

  const handleSend = async () => {
    if (!input.trim() || !apiKey) return

    // 1M Token Limit Check
    if (estTokens > MAX_TOKENS) {
      setMessages(prev => [...prev, {
        role: 'system',
        type: 'error',
        content: `Error: Token limit exceeded (${estTokens.toLocaleString()} / ${MAX_TOKENS.toLocaleString()}). Please clear the chat to start a new session.`
      }])
      return
    }

    const userMsg = input.trim()
    const currentAttachedImage = attachedImage
    setInput('')
    setAttachedImage(null)
    setMessages(prev => [...prev, { role: 'user', content: userMsg, attachedImage: currentAttachedImage || undefined }])
    setLoading(true)

    try {
      // Use existing baseline or capture a new one
      let currentBaseline = sessionBaseline
      if (!currentBaseline) {
        const context = await captureContext()
        if (!context) throw new Error('Could not capture page context')
        currentBaseline = { html: context.html, screenshot: context.screenshot }
        setSessionBaseline(currentBaseline)
      }

      const result = await chrome.storage.local.get(['customSystemPrompt', 'geminiModelName'])
      const customPrompt = result.customSystemPrompt as string | undefined
      const modelName = result.geminiModelName as string | undefined

      const historyForGemini: any[] = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role,
          content: m.content,
          operationResults: m.operationResults
        }))

      // Gemini now receives the BASELINE HTML and the full history
      const { operations, usage, summary } = await callGeminiDesign(
        apiKey,
        currentBaseline.html,
        currentBaseline.screenshot,
        userMsg,
        historyForGemini,
        currentAttachedImage,
        customPrompt,
        modelName
      )

      // Before applying NEW cumulative operations, revert to baseline if there was a previous state
      const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.undoOperations && m.undoOperations.length > 0)
      if (lastAssistantMsg && lastAssistantMsg.undoOperations) {
        await applyOperations(lastAssistantMsg.undoOperations, lastAssistantMsg.rootSelector)
      }

      const { undoOps, results } = await applyOperations(operations, selectedElement?.selector)
      saveToHistory(userMsg, operations, undoOps, selectedElement?.selector, usage, results, summary, currentAttachedImage)
      const hasErrors = results.some(r => !r.success)

      if (hasErrors) {
        console.error('[In-Browser Design] Some operations failed:', results.filter(r => !r.success))
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: hasErrors
          ? `Applied ${results.filter(r => r.success).length}/${operations.length} changes. Some operations failed.`
          : summary || `Applied ${operations.length} changes to the page!`,
        summary: summary,
        operations: operations,
        undoOperations: undoOps,
        operationResults: results,
        rootSelector: selectedElement?.selector,
        usage: usage
      }])
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'system',
        type: 'error',
        content: `Error: ${err.message}`
      }])
    } finally {
      setLoading(false)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of Array.from(items)) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = (event) => {
            setAttachedImage(event.target?.result as string)
          }
          reader.readAsDataURL(file)
        }
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setAttachedImage(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
        <IoSettingsOutline className="text-slate-300 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-800 mb-2">API Key Required</h2>
        <p className="text-sm text-slate-500 mb-6">Please set your Gemini API Key in the settings page to start designing.</p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
          >
            <IoSettingsOutline size={18} />
            Open Settings
          </button>
          <button
            onClick={loadSettings}
            className="w-full px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <IoRefreshOutline size={18} />
            Check Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <IoSparkles size={18} />
          </div>
          <h1 className="font-bold text-slate-900">In-Browser Design</h1>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'chat' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <IoChatbubbleEllipsesOutline size={14} />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <IoTimeOutline size={14} />
            History
          </button>
        </div>

        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
          title="Open Settings"
        >
          <IoSettingsOutline size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => switchSession(session.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${activeSessionId === session.id
              ? 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-sm'
              : 'bg-white text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-700'
              }`}
          >
            {session.name}
            {sessions.length > 1 && (
              <button
                onClick={(e) => deleteSession(session.id, e)}
                className="hover:text-red-500 p-0.5 rounded-md hover:bg-red-50"
              >
                <IoCloseCircleOutline size={12} />
              </button>
            )}
          </div>
        ))}
        {sessions.length < MAX_SESSIONS && (
          <button
            onClick={createNewSession}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-dashed border-slate-200 rounded-xl transition-all"
            title="New Chat"
          >
            <IoSend size={14} className="rotate-[-90deg]" /> {/* Using a plus-like icon if IoAdd is missing, let me check icons */}
          </button>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {activeTab === 'chat' ? (
          <div className="p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] px-4 py-2 rounded-2xl text-sm ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : msg.role === 'system'
                    ? msg.type === 'error'
                      ? 'bg-red-50 text-red-600 border border-red-100 italic'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium'
                    : 'bg-white text-slate-700 border border-slate-200 shadow-sm'
                  }`}>
                  {msg.attachedImage && (
                    <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                      <img src={msg.attachedImage} alt="Reference" className="max-w-full h-auto max-h-[200px]" />
                    </div>
                  )}
                  {msg.content}
                  {msg.usage && <UsageStats usage={msg.usage} />}
                </div>
                {msg.operations && (
                  <div className="flex items-center gap-2 mt-1">
                    {msg.operationResults?.some(r => !r.success) && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100" title={msg.operationResults.filter(r => !r.success).map(r => `${r.selector}: ${r.error}`).join('\n')}>
                        <IoWarningOutline size={12} />
                        Errors detected
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        const { results } = await applyOperations(msg.operations!, msg.rootSelector)
                        if (results.some(r => !r.success)) {
                          console.error('[In-Browser Design] Re-apply operations failed:', results.filter(r => !r.success))
                        }
                        setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, operationResults: results } : m))
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded-full transition-colors"
                    >
                      <IoRefreshOutline size={12} />
                      Re-apply changes
                    </button>
                    {msg.undoOperations && msg.undoOperations.length > 0 && (
                      <button
                        onClick={() => applyOperations(msg.undoOperations!, msg.rootSelector)}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-2 py-1 rounded-full transition-colors"
                      >
                        <IoCloseCircleOutline size={12} />
                        Undo
                      </button>
                    )}
                    <CopyButton
                      content={msg.operations}
                      className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-full"
                    />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 px-4 py-2 rounded-2xl shadow-sm animate-pulse flex items-center gap-2 text-slate-400 text-sm">
                  <IoSparkles className="animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <IoTimeOutline size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 leading-none">History</h3>
                  <p className="text-[10px] text-slate-400 mt-1">Manage your design iterations</p>
                </div>
              </div>

              <button
                onClick={() => {
                  const newValue = !filterByDomain
                  setFilterByDomain(newValue)
                  chrome.storage.local.set({ filterByDomain: newValue })
                }}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${filterByDomain
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                {filterByDomain ? 'Current Domain' : 'All Domains'}
              </button>
            </div>

            {(() => {
              const currentHostname = activeUrl ? new URL(activeUrl).hostname : ''
              const filteredHistory = filterByDomain
                ? history.filter(item => {
                  try {
                    return new URL(item.url).hostname === currentHostname
                  } catch {
                    return false
                  }
                })
                : history

              if (filteredHistory.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <IoTimeOutline size={48} className="opacity-20 mb-2" />
                    <p className="text-sm">No history {filterByDomain ? 'for this domain' : 'yet'}</p>
                  </div>
                )
              }

              return filteredHistory.map((item) => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{new URL(item.url).hostname}</span>
                    <div className="flex items-center gap-2">
                      <CopyButton
                        content={item.operations}
                        className="text-slate-300 hover:text-indigo-500 transition-colors text-[10px] font-bold"
                      />
                      <button
                        onClick={() => {
                          const newHistory = history.filter(h => h.id !== item.id)
                          setHistory(newHistory)
                          chrome.storage.local.set({ history: newHistory })
                        }}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <IoTrashOutline size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 font-bold mb-1 line-clamp-2">"{item.instruction}"</p>
                  {item.usage && <UsageStats usage={item.usage} />}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={async () => {
                        const { results } = await applyOperations(item.operations, item.rootSelector)

                        // Also show a temporary system message and log to console if there are errors
                        if (results.some(r => !r.success)) {
                          console.error('[In-Browser Design] History design apply failed:', results.filter(r => !r.success))
                          setMessages(prev => [...prev, {
                            role: 'system',
                            type: 'error',
                            content: `Re-apply from history encountered ${results.filter(r => !r.success).length} errors.`
                          }])
                        }

                        const newHistory = history.map(h => h.id === item.id ? { ...h, operationResults: results } : h)
                        setHistory(newHistory)
                        chrome.storage.local.set({ history: newHistory })
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-colors relative"
                    >
                      {item.operationResults?.some(r => !r.success) && (
                        <IoWarningOutline className="absolute left-2 text-amber-500" size={12} />
                      )}
                      <IoRefreshOutline size={14} />
                      Apply Design
                    </button>
                    {item.undoOperations && item.undoOperations.length > 0 && (
                      <button
                        onClick={() => applyOperations(item.undoOperations!, item.rootSelector)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-600 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <IoCloseCircleOutline size={14} />
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}
      </div>

      {/* Input Section */}
      <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] space-y-3">
        <div className={`flex flex-col border rounded-3xl transition-all duration-300 ${selecting
          ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-lg'
          : 'border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50 shadow-sm hover:shadow-md'
          }`}>
          {/* Attachment chip for selected element */}
          <div className="px-4 pt-3 flex flex-wrap gap-2">
            {selectedElement && (
              <div className="flex items-center gap-2 bg-indigo-600 text-white pl-2.5 pr-1.5 py-1.5 rounded-full text-[11px] font-bold shadow-sm animate-in zoom-in-95 duration-200">
                <IoExpandOutline size={12} className="shrink-0" />
                <span className="truncate max-w-[160px] font-mono leading-none tracking-tight">{selectedElement.selector}</span>
                <button
                  onClick={() => setSelectedElement(null)}
                  className="p-0.5 hover:bg-white/20 rounded-full transition-colors"
                >
                  <IoCloseCircleOutline size={14} />
                </button>
              </div>
            )}

            {attachedImage && (
              <div className="flex items-center gap-2 bg-slate-200 text-slate-700 pl-2 pr-1.5 py-1.5 rounded-xl text-[11px] font-bold shadow-sm animate-in zoom-in-95 duration-200 group">
                <div className="w-6 h-6 rounded bg-slate-300 overflow-hidden shrink-0">
                  <img src={attachedImage} alt="Attached" className="w-full h-full object-cover" />
                </div>
                <span className="truncate max-w-[120px]">User image</span>
                <button
                  onClick={() => setAttachedImage(null)}
                  className="p-0.5 hover:bg-slate-300 rounded-full transition-colors"
                >
                  <IoCloseCircleOutline size={14} />
                </button>
              </div>
            )}

            {(selectedElement || attachedImage) && (
              <span className="text-[10px] text-slate-400 font-medium self-center">Context attached</span>
            )}
          </div>

          <div className="px-4 py-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !loading && !selecting && input.trim()) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={selecting ? "Go ahead, click an element on the page..." : "Tell me what to change..."}
              className={`w-full py-2 bg-transparent border-none resize-none outline-none text-sm text-slate-900 placeholder:text-slate-400 leading-relaxed font-medium transition-all ${selecting ? 'italic font-normal' : ''}`}
              disabled={selecting}
              rows={2}
            />
          </div>

          <div className="px-3 pb-3 flex items-center justify-between border-t border-slate-100/50">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const newValue = !sendScreenshot
                  setSendScreenshot(newValue)
                  chrome.storage.local.set({ sendScreenshot: newValue })
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${sendScreenshot
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  : 'bg-slate-50 text-slate-400 border border-slate-100'
                  }`}
                title={sendScreenshot ? "Screenshot enabled" : "Screenshot disabled (Saves cost)"}
              >
                <IoCameraOutline size={14} className={sendScreenshot ? 'text-indigo-600' : 'text-slate-400'} />
                {sendScreenshot ? 'On' : 'Off'}
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${attachedImage
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'
                  }`}
                title="Attach image (mockup/inspiration)"
              >
                <IoImageOutline size={14} className={attachedImage ? 'text-indigo-600' : 'text-slate-400'} />
                {attachedImage ? 'Attached' : 'Image'}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
              <TokenDonut current={estTokens} max={MAX_TOKENS} />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setMessages(() => [{ role: 'assistant', content: 'Chat cleared! Initial state preserved if session started.' }])
                  setSessionBaseline(null)
                }}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                title="Clear Chat"
              >
                <IoTrashOutline size={18} />
              </button>

              <button
                onClick={startElementSelection}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${selecting
                  ? 'bg-red-500 text-white shadow-red-200/50 shadow-xl hover:bg-red-600'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200 shadow-sm active:scale-95'
                  }`}
              >
                <IoExpandOutline size={14} />
                {selecting ? 'Cancel Selection' : 'Select Target'}
              </button>

              <button
                onClick={handleSend}
                disabled={loading || !input.trim() || selecting}
                className={`flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300 ${input.trim() && !loading && !selecting
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200/50 hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 active:scale-90'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
              >
                <IoSend size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
          <div className="flex gap-2">
            <span className="flex items-center gap-1"><IoCameraOutline /> High-res Capture</span>
            <span className="flex items-center gap-1"><IoCodeSlashOutline /> Context Active</span>
          </div>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="hover:text-indigo-600 transition-colors uppercase font-bold tracking-tighter"
          >
            v0.0.2
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
