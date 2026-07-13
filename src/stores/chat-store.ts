import { create } from "zustand";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  error?: string;
  status: "pending" | "running" | "done" | "error";
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  input: string;
  isOpen: boolean;
  isSending: boolean;
  error: string | null;

  setInput: (input: string) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  updateToolCall: (
    messageId: string,
    toolCallId: string,
    updates: Partial<ToolCall>,
  ) => void;
  setIsSending: (sending: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  input: "",
  isOpen: false,
  isSending: false,
  error: null,

  setInput: (input) => set({ input }),

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),

  setOpen: (isOpen) => set({ isOpen }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  updateMessage: (id, updates) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),

  updateToolCall: (messageId, toolCallId, updates) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== messageId || !m.toolCalls) return m;
        return {
          ...m,
          toolCalls: m.toolCalls.map((tc) =>
            tc.id === toolCallId ? { ...tc, ...updates } : tc,
          ),
        };
      }),
    })),

  setIsSending: (isSending) => set({ isSending }),

  setError: (error) => set({ error }),

  clearMessages: () => set({ messages: [], error: null }),
}));
