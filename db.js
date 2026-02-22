// db.js
// Persistent storage via Upstash Redis (free tier, no disk needed).
// Uses the @upstash/redis REST client — zero native compilation, works everywhere.
//
// Key schema:
//   timeout:<guildId>:<userId>  → "1"
//   limit:<guildId>:<userId>    → "<number>"

'use strict';

const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const timeoutKey = (guildId, userId) => `timeout:${guildId}:${userId}`;
const limitKey   = (guildId, userId) => `limit:${guildId}:${userId}`;

// ── Timeout API ───────────────────────────────────────────────────────────────

/**
 * Prevent a user from using /spam in a specific guild.
 */
async function addTimeout(guildId, userId) {
  await redis.set(timeoutKey(guildId, userId), '1');
}

/**
 * Restore a user's /spam access in a specific guild.
 */
async function removeTimeout(guildId, userId) {
  await redis.del(timeoutKey(guildId, userId));
}

/**
 * Returns true if the user is timed out in the given guild.
 * @returns {Promise<boolean>}
 */
async function isTimedOut(guildId, userId) {
  const val = await redis.get(timeoutKey(guildId, userId));
  return val === '1';
}

// ── Limit API ─────────────────────────────────────────────────────────────────

/**
 * Set (or override) a per-server max spam amount for a user.
 * @param {number} maxAmount
 */
async function setLimit(guildId, userId, maxAmount) {
  await redis.set(limitKey(guildId, userId), String(maxAmount));
}

/**
 * Clear a custom limit for a user in a specific guild.
 */
async function removeLimit(guildId, userId) {
  await redis.del(limitKey(guildId, userId));
}

/**
 * Returns the custom max amount for a user in a guild, or null if not set.
 * @returns {Promise<number|null>}
 */
async function getLimit(guildId, userId) {
  const val = await redis.get(limitKey(guildId, userId));
  return val !== null ? parseInt(val, 10) : null;
}

module.exports = { addTimeout, removeTimeout, isTimedOut, setLimit, removeLimit, getLimit };