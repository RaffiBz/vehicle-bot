// ============================================
// SESSIONS.JS - Redis-based Session & Usage Management
// ============================================

import Redis from "ioredis";
import { STATES, WEEKLY_LIMIT, LANGUAGES } from "./constants.js";

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));

// Key prefixes
const SESSION_PREFIX = "session:";
const USAGE_PREFIX = "usage:";
const LOCK_PREFIX = "lock:";

// Session TTL: 24 hours (cleanup old sessions)
const SESSION_TTL = 60 * 60 * 24;
// Lock TTL: 2 minutes (auto-release if something crashes)
const LOCK_TTL = 120;

// ============================================
// PROCESSING LOCK - Prevent duplicate requests
// ============================================

export async function acquireLock(chatId) {
  const key = LOCK_PREFIX + chatId;
  // SET key if not exists, with TTL
  const result = await redis.set(key, "1", "EX", LOCK_TTL, "NX");
  return result === "OK";
}

export async function releaseLock(chatId) {
  const key = LOCK_PREFIX + chatId;
  await redis.del(key);
}

export async function isLocked(chatId) {
  const key = LOCK_PREFIX + chatId;
  const exists = await redis.exists(key);
  return exists === 1;
}

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

export async function getSession(chatId) {
  const key = SESSION_PREFIX + chatId;
  const data = await redis.get(key);

  if (data) {
    return JSON.parse(data);
  }

  const defaultSession = createDefaultSession();
  await redis.setex(key, SESSION_TTL, JSON.stringify(defaultSession));
  return defaultSession;
}

export async function updateSession(chatId, updates) {
  const key = SESSION_PREFIX + chatId;
  const session = await getSession(chatId);
  Object.assign(session, updates);
  await redis.setex(key, SESSION_TTL, JSON.stringify(session));
  return session;
}

export async function resetSession(chatId) {
  const key = SESSION_PREFIX + chatId;
  const currentSession = await getSession(chatId);
  const language = currentSession?.language || null;

  const newSession = {
    ...createDefaultSession(),
    language,
  };

  await redis.setex(key, SESSION_TTL, JSON.stringify(newSession));
  return newSession;
}

export async function deleteSession(chatId) {
  const key = SESSION_PREFIX + chatId;
  await redis.del(key);
}

// ============================================
// WEEKLY USAGE LIMIT
// ============================================

function getWeekKey(chatId) {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);

  return `${USAGE_PREFIX}${chatId}:${now.getFullYear()}-W${week}`;
}

export async function hasExceededLimit(chatId) {
  const key = getWeekKey(chatId);
  const count = await redis.get(key);
  return (parseInt(count) || 0) >= WEEKLY_LIMIT;
}

export async function getRemainingGenerations(chatId) {
  const key = getWeekKey(chatId);
  const count = await redis.get(key);
  return Math.max(0, WEEKLY_LIMIT - (parseInt(count) || 0));
}

export async function incrementUsage(chatId) {
  const key = getWeekKey(chatId);
  const newCount = await redis.incr(key);

  if (newCount === 1) {
    await redis.expire(key, 60 * 60 * 24 * 7);
  }

  return newCount;
}

export async function getUsageCount(chatId) {
  const key = getWeekKey(chatId);
  const count = await redis.get(key);
  return parseInt(count) || 0;
}

// ============================================
// LOCALIZATION HELPER
// ============================================

export async function getLocalizedMessage(chatId, messageObj) {
  const session = await getSession(chatId);
  const lang = session.language || LANGUAGES.RU;

  if (typeof messageObj === "string") {
    return messageObj;
  }

  return messageObj[lang] || messageObj.ru || messageObj;
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

export async function closeRedis() {
  await redis.quit();
  console.log("Redis connection closed");
}
