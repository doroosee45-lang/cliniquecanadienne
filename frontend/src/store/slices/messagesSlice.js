import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchConversations = createAsyncThunk(
  'messages/fetchConversations',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/messages');
      return data.conversations || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement conversations');
    }
  }
);

export const fetchMessages = createAsyncThunk(
  'messages/fetchMessages',
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/messages/${conversationId}`);
      return { conversationId, messages: data.messages || [] };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement messages');
    }
  }
);

export const sendMessage = createAsyncThunk(
  'messages/send',
  async ({ conversationId, content, recipients }, { rejectWithValue }) => {
    try {
      const endpoint = conversationId
        ? `/messages/${conversationId}`
        : '/messages';
      const body = conversationId ? { content } : { recipients, content };
      const { data } = await api.post(endpoint, body);
      return data.message || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur envoi message');
    }
  }
);

export const markAsRead = createAsyncThunk(
  'messages/markAsRead',
  async (conversationId, { rejectWithValue }) => {
    try {
      await api.put(`/messages/${conversationId}/read`);
      return conversationId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur marquage lu');
    }
  }
);

const messagesSlice = createSlice({
  name: 'messages',
  initialState: {
    conversations: [],
    currentConversation: null,
    messages: [],
    unreadCount: 0,
    loading: false,
    sending: false,
    error: null,
    newMessage: '',
  },
  reducers: {
    setCurrentConversation(state, action) { state.currentConversation = action.payload; },
    setNewMessage(state, action) { state.newMessage = action.payload; },
    clearNewMessage(state) { state.newMessage = ''; },
    addMessage(state, action) { state.messages.push(action.payload); },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loading = false;
        state.conversations = action.payload;
        state.unreadCount = action.payload.filter(c => c.unread > 0).length;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchMessages.pending, (state) => { state.loading = true; })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.loading = false;
        state.messages = action.payload.messages;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(sendMessage.pending, (state) => { state.sending = true; })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sending = false;
        state.messages.push(action.payload);
        state.newMessage = '';
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload;
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const conv = state.conversations.find(c => c._id === action.payload);
        if (conv) {
          state.unreadCount = Math.max(0, state.unreadCount - (conv.unread > 0 ? 1 : 0));
          conv.unread = 0;
        }
      });
  },
});

export const { setCurrentConversation, setNewMessage, clearNewMessage, addMessage, clearError } = messagesSlice.actions;

export const selectConversations = (state) => state.messages.conversations;
export const selectCurrentConversation = (state) => state.messages.currentConversation;
export const selectMessages = (state) => state.messages.messages;
export const selectUnreadCount = (state) => state.messages.unreadCount;
export const selectMessagesLoading = (state) => state.messages.loading;
export const selectMessagesSending = (state) => state.messages.sending;
export const selectNewMessage = (state) => state.messages.newMessage;

export default messagesSlice.reducer;
