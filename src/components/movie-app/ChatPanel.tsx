"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore, type ChatMessage, type ToolCall } from "@/stores/chat-store";
import { useFolderStore } from "@/stores/folder-store";
import { sendChatMessage } from "@/lib/chat-agent";

function ToolCallBubble({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const isError = tc.status === "error";

  return (
    <div
      className={`text-xs rounded-lg border px-2.5 py-1.5 mt-1.5 ${
        isError
          ? "border-red-800/40 bg-red-950/30 text-red-300"
          : "border-neutral-700/40 bg-neutral-800/50 text-neutral-400"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left"
      >
        <span className={isError ? "text-red-400" : "text-neutral-500"}>
          {tc.status === "running" ? (
            <span className="inline-block w-3 h-3 border border-neutral-500 border-t-transparent rounded-full animate-spin" />
          ) : isError ? (
            "✗"
          ) : (
            "✓"
          )}
        </span>
        <span className="font-medium truncate">{tc.name}</span>
        <span className="ml-auto text-neutral-600">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          <div className="text-neutral-500">Args: {JSON.stringify(tc.arguments)}</div>
          {tc.result && <div className="text-neutral-300 whitespace-pre-wrap">{tc.result}</div>}
          {tc.error && <div className="text-red-400">{tc.error}</div>}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-white text-black"
            : "bg-neutral-800 border border-neutral-700/50 text-neutral-200"
        }`}
      >
        <div className="whitespace-pre-wrap">{msg.content}</div>
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="mt-1">
            {msg.toolCalls.map((tc) => (
              <ToolCallBubble key={tc.id} tc={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const input = useChatStore((s) => s.input);
  const isOpen = useChatStore((s) => s.isOpen);
  const isSending = useChatStore((s) => s.isSending);
  const error = useChatStore((s) => s.error);
  const setInput = useChatStore((s) => s.setInput);
  const toggleOpen = useChatStore((s) => s.toggleOpen);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const updateToolCall = useChatStore((s) => s.updateToolCall);
  const setIsSending = useChatStore((s) => s.setIsSending);
  const setError = useChatStore((s) => s.setError);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const apiKey = useFolderStore((s) => s.apiKey);
  const isConfigured = useFolderStore((s) => s.isConfigured);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    if (!apiKey) {
      setError("Please configure your fal.ai API key in Settings first.");
      return;
    }

    setInput("");
    setError(null);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    // Create a placeholder agent message
    const agentMsgId = crypto.randomUUID();
    const agentMsg: ChatMessage = {
      id: agentMsgId,
      role: "agent",
      content: "",
      toolCalls: [],
      timestamp: Date.now(),
    };
    addMessage(agentMsg);

    setIsSending(true);

    try {
      const history = messages
        .filter((m) => m.content || (m.toolCalls && m.toolCalls.length > 0))
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await sendChatMessage(text, history, apiKey);

      // Build tool calls from response
      const toolCalls: ToolCall[] = response.toolCalls.map((tc) => ({
        id: crypto.randomUUID(),
        name: tc.name,
        arguments: tc.arguments,
        result: tc.result,
        error: tc.error,
        status: tc.error ? ("error" as const) : ("done" as const),
      }));

      updateMessage(agentMsgId, {
        content: response.text,
        toolCalls,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong";
      updateMessage(agentMsgId, {
        content: "Sorry, I encountered an error. Please try again.",
        toolCalls: [
          {
            id: crypto.randomUUID(),
            name: "error",
            arguments: {},
            error: errMsg,
            status: "error",
          },
        ],
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Collapsed state: show toggle button on left edge
  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 w-9 h-24 bg-neutral-800 border border-neutral-700 rounded-r-xl flex items-center justify-center hover:bg-neutral-700 hover:border-neutral-600 transition-all group"
        title="Open AI Assistant"
      >
        <div className="flex flex-col items-center gap-1.5">
          <svg
            className="w-4 h-4 text-neutral-400 group-hover:text-white transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
            />
          </svg>
          <span
            className="text-[10px] text-neutral-500 group-hover:text-neutral-300 transition-colors"
            style={{ writingMode: "vertical-rl" }}
          >
            AI
          </span>
        </div>
      </button>
    );
  }

  // Open state: sidebar panel
  return (
    <div className="fixed left-0 top-0 bottom-0 z-40 w-[360px] bg-neutral-950 border-r border-neutral-800 flex flex-col shadow-2xl shadow-black/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-neutral-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
            />
          </svg>
          <span className="text-sm font-semibold text-white">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
            title="Clear chat"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={toggleOpen}
            className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
            title="Close panel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 blender-scrollbar">
        {!isConfigured ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
            <svg className="w-10 h-10 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-neutral-400 text-sm">
              Open a workspace folder and configure your API key in Settings to get started.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
            <svg className="w-10 h-10 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <p className="text-neutral-400 text-sm">
              Hi! I'm your AI Video Studio assistant. I can help you write stories, create characters, generate scenes, and more.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                "Help me write a movie story",
                "Extract characters from my story",
                "What can you help me with?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="px-3 py-1.5 text-xs bg-neutral-800 border border-neutral-700 rounded-full text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}

        {isSending && (
          <div className="flex justify-start">
            <div className="bg-neutral-800 border border-neutral-700/50 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-neutral-500 text-sm">
                <span className="inline-block w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="inline-block w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="inline-block w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <p className="text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2 text-center max-w-[85%]">
              {error}
            </p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-neutral-800 shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConfigured ? "Ask me anything..." : "Configure workspace first..."}
            disabled={!isConfigured || isSending}
            className="flex-1 px-3.5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-500 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending || !isConfigured}
            className="p-2.5 bg-white text-black rounded-xl hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        {!isConfigured && (
          <p className="text-neutral-600 text-[11px] mt-2 text-center">
            Open Settings to configure your workspace and API key.
          </p>
        )}
      </div>
    </div>
  );
}
