import { create } from 'zustand'

interface Message {
  role: 'user' | 'agent'
  content: string
}

interface Balances {
  spirit: number
  essence: number
  matter: number
  substance: number
}

interface ChatState {
  messages: Message[]
  streamingText: string
  isGenerating: boolean
  balances: Balances
  setBalances: (balances: Balances) => void
  addMessage: (msg: Message) => void
  appendStreamingText: (chunk: string) => void
  commitStream: () => void
}

export const useChatStore = create<ChatState>((set: any) => ({
  messages: [],
  streamingText: '',
  isGenerating: false,
  balances: { spirit: 0, essence: 0, matter: 0, substance: 0 },
  setBalances: (balances: Balances) => set({ balances }),
  addMessage: (msg: Message) => set((state: ChatState) => ({ messages: [...state.messages, msg] })),
  appendStreamingText: (chunk: string) =>
    set((state: ChatState) => ({ streamingText: state.streamingText + chunk })),
  commitStream: () =>
    set((state: ChatState) => ({
      messages: [...state.messages, { role: 'agent', content: state.streamingText }],
      streamingText: '',
      isGenerating: false,
    })),
}))
