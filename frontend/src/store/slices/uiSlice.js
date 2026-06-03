import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarOpen: true,
    globalLoading: false,
    notifications: [],
    modal: null,
    theme: 'light',
  },
  reducers: {
    toggleSidebar(state) { state.sidebarOpen = !state.sidebarOpen; },
    setSidebar(state, action) { state.sidebarOpen = action.payload; },
    setGlobalLoading(state, action) { state.globalLoading = action.payload; },
    addNotification(state, action) {
      state.notifications.unshift({ id: Date.now(), ...action.payload });
      if (state.notifications.length > 10) state.notifications.pop();
    },
    removeNotification(state, action) {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearNotifications(state) { state.notifications = []; },
    openModal(state, action) { state.modal = action.payload; },
    closeModal(state) { state.modal = null; },
    setTheme(state, action) { state.theme = action.payload; },
  },
});

export const {
  toggleSidebar, setSidebar,
  setGlobalLoading,
  addNotification, removeNotification, clearNotifications,
  openModal, closeModal,
  setTheme,
} = uiSlice.actions;

export const selectSidebarOpen = (state) => state.ui.sidebarOpen;
export const selectGlobalLoading = (state) => state.ui.globalLoading;
export const selectNotifications = (state) => state.ui.notifications;
export const selectActiveModal = (state) => state.ui.modal;
export const selectTheme = (state) => state.ui.theme;

export default uiSlice.reducer;
