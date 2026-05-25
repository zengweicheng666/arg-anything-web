import { useState, useEffect } from 'react'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: { source: string; page?: number }[]
  streaming?: boolean
}

interface Props {
  message: Message
}

export function ChatMessage({ message }: Props) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    if (!message.streaming) {
      setDisplayed(message.content)
      return
    }
    setDisplayed('')
    let i = 0
    const interval = setInterval(() => {
      i += 3
      if (i >= message.content.length) {
        setDisplayed(message.content)
        clearInterval(interval)
      } else {
        setDisplayed(message.content.slice(0, i))
      }
    }, 30)
    return () => clearInterval(interval)
  }, [message.content, message.streaming])

  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">
          {displayed}
          {message.streaming && displayed !== message.content && (
            <span className="streaming-cursor" />
          )}
        </p>
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-700/50">
            <span className="text-xs text-gray-400">Sources: </span>
            {message.citations.map((c, i) => (
              <span
                key={i}
                className="inline-block mr-1 px-1.5 py-0.5 rounded bg-gray-700 text-xs text-gray-300"
              >
                {c.source}{c.page != null ? ` p.${c.page}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
