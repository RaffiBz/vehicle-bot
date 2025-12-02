// ============================================
// SESSIONS.JS - Session & Usage Limit Management
// ============================================

import { STATES, DAILY_LIMIT, LANGUAGES } from "./constants.js";

const sessions = new Map();
const usageLimits = new Map();

// ============================================
// SESSION MANAGEMENT
// ============================================

function createDefaultSession() {
  return {
    state: STATES.IDLE,
    language: null,
    vehicleImage: null,
    vehicleFileId: null,
    selectedColor: null,
    selectedColorDisplay: null,
    selectedTexture: null,
    selectedTextureDisplay: null,
    createdAt: Date.now(),
  };
}

export function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, createDefaultSession());
  }
  return sessions.get(chatId);
}

export function updateSession(chatId, updates) {
  const session = getSession(chatId);
  Object.assign(session, updates);
  return session;
}

export function resetSession(chatId) {
  const currentSession = sessions.get(chatId);
  const language = currentSession?.language || null;

  sessions.set(chatId, {
    ...createDefaultSession(),
    language,
  });

  return sessions.get(chatId);
}

export function deleteSession(chatId) {
  sessions.delete(chatId);
}

// ============================================
// DAILY USAGE LIMIT
// ============================================

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

export function hasExceededLimit(chatId) {
  const usage = usageLimits.get(chatId);
  const today = getTodayString();

  if (!usage || usage.date !== today) {
    return false;
  }

  return usage.count >= DAILY_LIMIT;
}

export function getRemainingGenerations(chatId) {
  const usage = usageLimits.get(chatId);
  const today = getTodayString();

  if (!usage || usage.date !== today) {
    return DAILY_LIMIT;
  }

  return Math.max(0, DAILY_LIMIT - usage.count);
}

export function incrementUsage(chatId) {
  const today = getTodayString();
  const usage = usageLimits.get(chatId);

  if (!usage || usage.date !== today) {
    usageLimits.set(chatId, { count: 1, date: today });
    return 1;
  }

  usage.count += 1;
  return usage.count;
}

export function getUsageCount(chatId) {
  const usage = usageLimits.get(chatId);
  const today = getTodayString();

  if (!usage || usage.date !== today) {
    return 0;
  }

  return usage.count;
}

// ============================================
// LOCALIZATION HELPER
// ============================================

export function getLocalizedMessage(chatId, messageObj) {
  const session = getSession(chatId);
  const lang = session.language || LANGUAGES.RU;

  if (typeof messageObj === "string") {
    return messageObj;
  }

  return messageObj[lang] || messageObj.ru || messageObj;
}
