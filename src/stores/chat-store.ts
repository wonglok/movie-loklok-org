import { create } from "zustand";
import { writeChatJson } from "@/lib/fs-helpers";

export interface Toast {
  id: string;
  title: string;
  message: string;
  toolName: string;
  timestamp: number;
}

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
  toasts: Toast[];
  saveHandle: {
    folderHandle: FileSystemDirectoryHandle;
    projectId: string;
  } | null;

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
  pushToolCall: (messageId: string, tc: ToolCall) => void;
  setIsSending: (sending: boolean) => void;
  setError: (error: string | null) => void;
  addToast: (toast: Omit<Toast, "id" | "timestamp">) => void;
  removeToast: (id: string) => void;
  clearMessages: () => void;
  setMessages: (messages: ChatMessage[]) => void;
  setSaveHandle: (handle: { folderHandle: FileSystemDirectoryHandle; projectId: string } | null) => void;
  persistMessages: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  input: "",
  isOpen: false,
  isSending: false,
  error: null,
  toasts: [],
  saveHandle: null,

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

  pushToolCall: (messageId, tc) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== messageId) return m;
        return { ...m, toolCalls: [...(m.toolCalls || []), tc] };
      }),
    })),

  setIsSending: (isSending) => set({ isSending }),

  setError: (error) => set({ error }),

  addToast: (toast) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        { ...toast, id: crypto.randomUUID(), timestamp: Date.now() },
      ],
    })),

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  clearMessages: () => set({ messages: [], error: null }),

  setMessages: (messages) => set({ messages }),

  setSaveHandle: (handle) => set({ saveHandle: handle }),

  persistMessages: async () => {
    const { saveHandle, messages } = get();
    if (!saveHandle) return;
    try {
      await writeChatJson(saveHandle.folderHandle, saveHandle.projectId, messages);
    } catch {
      // silently fail — will retry on next change
    }
  },
}));
