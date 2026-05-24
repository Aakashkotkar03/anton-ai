// src/stores/useConversationStore.js — Zustand store for chat conversations
// Tracks the active conversation, message list, streaming state, and conversation history.
// Used by ChatScreen, ChatPanelWindow, and sidebar conversation list.

import { create } from 'zustand';

const useConversationStore = create((set, get) => ({
  // Current active conversation
  currentConversation: null,  // { id, title, persona, modelId, createdAt }

  // Messages in the current conversation
  messages: [],               // [{ id, role, content, tokenCount?, createdAt? }]

  // Streaming state
  isStreaming: false,
  streamingContent: '',

  // All conversations (sidebar list)
  conversations: [],          // [{ id, title, persona, updatedAt }]

  // --- Actions ---

  setConversation: (conv) =>
    set({
      currentConversation: conv,
      messages: [],
      isStreaming: false,
      streamingContent: '',
    }),

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, msg],
    })),

  setMessages: (msgs) => set({ messages: msgs }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  setStreamingContent: (text) => set({ streamingContent: text }),

  appendStreamingToken: (token) =>
    set((state) => ({
      streamingContent: state.streamingContent + token,
    })),

  clearConversation: () =>
    set({
      currentConversation: null,
      messages: [],
      isStreaming: false,
      streamingContent: '',
    }),

  loadConversations: (list) => set({ conversations: list }),

  // Update conversation title in the sidebar list
  updateConversationTitle: (id, title) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
    })),

  // Remove a conversation from the sidebar list
  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      // If removing the active one, clear it
      ...(state.currentConversation?.id === id
        ? { currentConversation: null, messages: [], streamingContent: '' }
        : {}),
    })),
}));

export default useConversationStore;
