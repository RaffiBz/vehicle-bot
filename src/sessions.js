import { STATES } from "./constants.js";

// In-memory session storage (for production, use Redis)
const sessions = new Map();

export function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      state: STATES.IDLE,
      vehicleImage: null,
      vehicleFileId: null,
      selectedColor: null,
      backgroundImage: null,
      backgroundFileId: null,
      createdAt: Date.now(),
    });
  }
  return sessions.get(chatId);
}

export function updateSession(chatId, updates) {
  const session = getSession(chatId);
  Object.assign(session, updates);
  return session;
}

export function resetSession(chatId) {
  sessions.set(chatId, {
    state: STATES.IDLE,
    vehicleImage: null,
    vehicleFileId: null,
    selectedColor: null,
    backgroundImage: null,
    backgroundFileId: null,
    createdAt: Date.now(),
  });
  return sessions.get(chatId);
}

export function deleteSession(chatId) {
  sessions.delete(chatId);
}
