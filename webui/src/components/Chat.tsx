import { useState, useRef, useEffect, useCallback } from 'react'
import { ChatMessage, type Message } from './ChatMessage'
import { ChatInput } from './ChatInput'

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '欢迎使用 RAG-Anything Web UI\n\n使用流程：\n1. 在左侧选择一个文件夹\n2. 点击 "Start Indexing" 开始索引文档\n3. 索引完成后，在这里提问',

      streaming: false,
    },
  ])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async (text: string) => {
    const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', content: text, streaming: false }
    const assistantMsg: Message = { id: `assistant-${Date.now()}`, role: 'assistant', content: '', streaming: true }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, mode: 'mix' }),
      })
      if (!res.ok) throw new Error(await res.text())

      const reader = res.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'token') {
              fullContent += data.content
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last.id === assistantMsg.id) last.content = fullContent
                return updated
              })
            } else if (data.type === 'citation' && data.source) {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last.id === assistantMsg.id) {
                  last.citations = [...(last.citations || []), { source: data.source, page: data.page }]
                }
                return updated
              })
            } else if (data.type === 'error') {
              fullContent = `Error: ${data.content}`
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last.id === assistantMsg.id) last.content = fullContent
                return updated
              })
            }
          } catch { /* skip */ }
        }
      }
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last.id === assistantMsg.id) last.streaming = false
        return updated
      })
    } catch (err: any) {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: `Error: ${err.message}`, streaming: false }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (<ChatMessage key={msg.id} message={msg} />))}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  )
}
