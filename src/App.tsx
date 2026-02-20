import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type TabId = 'general' | 'refine' | 'coding' | 'chat' | 'activity'

type ActivityItem = {
  id: string
  type: 'prompt' | 'chat' | 'system'
  title: string
  detail: string
  at: string
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: string
}

const tabs: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General Prompt' },
  { id: 'refine', label: 'Refine Prompt' },
  { id: 'coding', label: 'Coding Prompt' },
  { id: 'chat', label: 'Chat' },
  { id: 'activity', label: 'Activity Log' },
]

const MODEL_OPTIONS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini',
  'anthropic/claude-3.5-sonnet',
  'meta-llama/llama-3.3-70b-instruct',
  'google/gemini-2.0-flash-001',
]

const ACTIVITY_KEY = 'dima-mvp-activity'
const API_KEY_STORAGE = 'dima-openrouter-api-key'
const MODEL_STORAGE = 'dima-openrouter-model'

const now = () => new Date().toISOString()

async function openRouterGenerate({
  apiKey,
  model,
  system,
  prompt,
}: {
  apiKey: string
  model: string
  system: string
  prompt: string
}) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Dima V3 Frontend MVP',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    }),
  })

  const payload = await response.json()
  if (!response.ok) {
    const message = payload?.error?.message || `OpenRouter error (${response.status})`
    throw new Error(message)
  }

  return payload?.choices?.[0]?.message?.content ?? ''
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [generalPrompt, setGeneralPrompt] = useState('')
  const [refinePrompt, setRefinePrompt] = useState('')
  const [codingPrompt, setCodingPrompt] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(MODEL_OPTIONS[0])
  const [isLoading, setIsLoading] = useState(false)
  const [lastOutput, setLastOutput] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVITY_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as ActivityItem[]
        if (Array.isArray(parsed)) setActivity(parsed)
      }
      const savedKey = localStorage.getItem(API_KEY_STORAGE)
      const savedModel = localStorage.getItem(MODEL_STORAGE)
      if (savedKey) setApiKey(savedKey)
      if (savedModel) setModel(savedModel)
    } catch {
      // noop
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity))
  }, [activity])

  useEffect(() => {
    localStorage.setItem(API_KEY_STORAGE, apiKey)
  }, [apiKey])

  useEffect(() => {
    localStorage.setItem(MODEL_STORAGE, model)
  }, [model])

  const addActivity = (type: ActivityItem['type'], title: string, detail: string) => {
    setActivity((prev) => [
      {
        id: crypto.randomUUID(),
        type,
        title,
        detail,
        at: now(),
      },
      ...prev,
    ])
  }

  const wordCount = useMemo(() => {
    const text = `${generalPrompt} ${refinePrompt} ${codingPrompt}`.trim()
    return text ? text.split(/\s+/).length : 0
  }, [generalPrompt, refinePrompt, codingPrompt])

  const ensureApiReady = () => {
    if (!apiKey.trim()) {
      setError('OpenRouter API Key ထည့်ရန်လိုပါတယ်။')
      return false
    }
    return true
  }

  const generateForPrompt = async (kind: 'general' | 'refine' | 'coding') => {
    if (!ensureApiReady()) return

    const source =
      kind === 'general' ? generalPrompt : kind === 'refine' ? refinePrompt : codingPrompt

    if (!source.trim()) {
      setError('Prompt text အရင်ရေးပါ။')
      return
    }

    setError('')
    setIsLoading(true)

    const system =
      kind === 'general'
        ? 'You are an expert prompt writer. Expand and improve the user prompt clearly with Burmese-friendly readability.'
        : kind === 'refine'
          ? 'You are a prompt refinement specialist. Make the input prompt more precise, structured, and actionable.'
          : 'You are a senior software architect. Convert the request into a clean coding instruction with steps and acceptance criteria.'

    try {
      const output = await openRouterGenerate({
        apiKey,
        model,
        system,
        prompt: source,
      })
      setLastOutput(output)
      addActivity('prompt', `${kind.toUpperCase()} AI generate`, source.slice(0, 120))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const submitChat = async (e: FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    if (!ensureApiReady()) return

    const userText = chatInput.trim()
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: userText,
      at: now(),
    }

    setChatMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setError('')
    setIsLoading(true)

    try {
      const assistantText = await openRouterGenerate({
        apiKey,
        model,
        system: 'You are a helpful assistant. Respond in clear Burmese unless user asks otherwise.',
        prompt: userText,
      })

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: assistantText,
        at: now(),
      }

      setChatMessages((prev) => [...prev, assistantMsg])
      addActivity('chat', 'Chat message sent', userText.slice(0, 140))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const clearActivity = () => {
    setActivity([])
    localStorage.removeItem(ACTIVITY_KEY)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Dima V3 — OpenRouter AI Workspace</h1>
          <p>Frontend-only • Local storage • Multi-model generation</p>
        </div>
        <div className="stat-card">
          <span>Total Prompt Words</span>
          <strong>{wordCount}</strong>
        </div>
      </header>

      <section className="api-panel">
        <div className="api-grid">
          <label>
            OpenRouter API Key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
            />
          </label>

          <label>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="error">⚠ {error}</p>}
      </section>

      <nav className="tabs" aria-label="Workspace tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {activeTab === 'general' && (
          <section className="panel">
            <h2>General Prompt</h2>
            <textarea
              value={generalPrompt}
              onChange={(e) => setGeneralPrompt(e.target.value)}
              placeholder="Describe your goal and expected output..."
            />
            <div className="actions">
              <button onClick={() => generateForPrompt('general')} disabled={isLoading}>
                {isLoading ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
          </section>
        )}

        {activeTab === 'refine' && (
          <section className="panel">
            <h2>Refine Prompt</h2>
            <textarea
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              placeholder="Paste existing prompt and refine it..."
            />
            <div className="actions">
              <button onClick={() => generateForPrompt('refine')} disabled={isLoading}>
                {isLoading ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
          </section>
        )}

        {activeTab === 'coding' && (
          <section className="panel">
            <h2>Coding Prompt</h2>
            <textarea
              value={codingPrompt}
              onChange={(e) => setCodingPrompt(e.target.value)}
              placeholder="Write what app/code you want. AI will turn this into implementation instructions..."
            />
            <div className="actions">
              <button onClick={() => generateForPrompt('coding')} disabled={isLoading}>
                {isLoading ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
          </section>
        )}

        {activeTab === 'chat' && (
          <section className="panel chat-panel">
            <h2>Chat</h2>
            <div className="chat-log">
              {chatMessages.length === 0 && <p className="empty">No messages yet. Start chatting.</p>}
              {chatMessages.map((msg) => (
                <article key={msg.id} className={`message ${msg.role}`}>
                  <span>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                  <p>{msg.text}</p>
                </article>
              ))}
            </div>
            <form className="chat-form" onSubmit={submitChat}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
              />
              <button type="submit" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </form>
          </section>
        )}

        {activeTab === 'activity' && (
          <section className="panel">
            <div className="title-row">
              <h2>Activity Log</h2>
              <button className="ghost" onClick={clearActivity}>
                Clear Log
              </button>
            </div>
            <div className="activity-list">
              {activity.length === 0 && <p className="empty">No activity yet.</p>}
              {activity.map((item) => (
                <article key={item.id} className="activity-item">
                  <header>
                    <strong>{item.title}</strong>
                    <small>{new Date(item.at).toLocaleString()}</small>
                  </header>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {lastOutput && activeTab !== 'chat' && activeTab !== 'activity' && (
          <section className="panel">
            <h2>AI Output</h2>
            <pre className="output-box">{lastOutput}</pre>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
