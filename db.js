// db.js
// Persistent storage using Node's built-in `fs` module only.
// Zero third-party dependencies, pure CommonJS, works on any Node version.
// Data is written to ./spambot-db.json next to this file.
//
// Schema (spambot-db.json):
// {
//   "timeouts": { "<guildId>:<userId>": true, ... },
//   "limits":   { "<guildId>:<userId>": <number>, ... }
// }

'use strict';

const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'spambot-db.json');
const DEFAULT = { timeouts: {}, limits: {} };

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Load JSON from disk, returning the default structure if the file doesn't exist yet. */
function load() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    // Ensure both top-level keys are always present
    return {
      timeouts: parsed.timeouts ?? {},
      limits:   parsed.limits   ?? {},
    };
  } catch {
    // File doesn't exist yet or is corrupt — start fresh
    return { timeouts: {}, limits: {} };
  }
}

/** Write the given data object to disk atomically (write to tmp, then rename). */
function save(data) {
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}

/** Returns a composite key string for a guild + user pair. */
const key = (guildId, userId) => `${guildId}:${userId}`;

// ── Timeout API ───────────────────────────────────────────────────────────────

/**
 * Prevent a user from using /spam in a specific guild.
 */
function addTimeout(guildId, userId) {
  const data = load();
  data.timeouts[key(guildId, userId)] = true;
  save(data);
}

/**
 * Restore a user's /spam access in a specific guild.
 */
function removeTimeout(guildId, userId) {
  const data = load();
  delete data.timeouts[key(guildId, userId)];
  save(data);
}

/**
 * Returns true if the user is timed out in the given guild.
 * @returns {boolean}
 */
function isTimedOut(guildId, userId) {
  const data = load();
  return data.timeouts[key(guildId, userId)] === true;
}

// ── Limit API ─────────────────────────────────────────────────────────────────

/**
 * Set (or override) a per-server max spam amount for a user.
 * @param {number} maxAmount
 */
function setLimit(guildId, userId, maxAmount) {
  const data = load();
  data.limits[key(guildId, userId)] = maxAmount;
  save(data);
}

/**
 * Clear a custom limit for a user in a specific guild.
 */
function removeLimit(guildId, userId) {
  const data = load();
  delete data.limits[key(guildId, userId)];
  save(data);
}

/**
 * Returns the custom max amount for a user in a guild, or null if not set.
 * @returns {number|null}
 */
function getLimit(guildId, userId) {
  const data = load();
  const val  = data.limits[key(guildId, userId)];
  return val !== undefined ? val : null;
}

module.exports = { addTimeout, removeTimeout, isTimedOut, setLimit, removeLimit, getLimit };