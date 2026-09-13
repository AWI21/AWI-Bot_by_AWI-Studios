const { createClient } = require('@libsql/client');
const chalk = require('chalk');

let db;

async function initDatabase() {
  const url = process.env.DATABASE_URL?.trim();
  const authToken = process.env.DATABASE_AUTH_TOKEN?.trim();

  if (!url || !authToken) {
    console.error(chalk.red('❌ Database credentials missing in .env!'));
    process.exit(1);
  }

  db = createClient({ url, authToken });

  const tables = [
    `CREATE TABLE IF NOT EXISTS guild_config (guild_id TEXT, key TEXT, value TEXT, PRIMARY KEY (guild_id, key))`,
    `CREATE TABLE IF NOT EXISTS users (user_id TEXT, guild_id TEXT, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 0, messages INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id))`,
    `CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, guild_id TEXT, reason TEXT, moderator_id TEXT, timestamp INTEGER)`,
    `CREATE TABLE IF NOT EXISTS birthdays (user_id TEXT, guild_id TEXT, month INTEGER, day INTEGER, PRIMARY KEY (user_id, guild_id))`,
    `CREATE TABLE IF NOT EXISTS vouches (user_id TEXT, guild_id TEXT, points INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id))`,
    `CREATE TABLE IF NOT EXISTS vouch_log (id INTEGER PRIMARY KEY AUTOINCREMENT, target_id TEXT, guild_id TEXT, points INTEGER, given_by TEXT, timestamp INTEGER)`,
    `CREATE TABLE IF NOT EXISTS achievements (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, description TEXT, requirement_type TEXT, requirement_value INTEGER, reward_role_id TEXT, reward_xp INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS user_achievements (user_id TEXT, guild_id TEXT, achievement_id INTEGER, earned_at INTEGER, PRIMARY KEY (user_id, guild_id, achievement_id))`,
    `CREATE TABLE IF NOT EXISTS custom_commands (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, trigger TEXT, response TEXT, allowed_roles TEXT, cooldown INTEGER DEFAULT 0, UNIQUE(guild_id, trigger))`,
    `CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id TEXT UNIQUE, guild_id TEXT, user_id TEXT, status TEXT DEFAULT 'open', created_at INTEGER)`,
    `CREATE TABLE IF NOT EXISTS notification_cache (id TEXT, platform TEXT, guild_id TEXT, posted_at INTEGER, PRIMARY KEY (id, platform, guild_id))`,
    `CREATE TABLE IF NOT EXISTS auto_roles (guild_id TEXT, role_id TEXT, PRIMARY KEY (guild_id, role_id))`,
    `CREATE TABLE IF NOT EXISTS automod_words (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, word TEXT, UNIQUE(guild_id, word))`,
    `CREATE TABLE IF NOT EXISTS command_channels (guild_id TEXT, channel_id TEXT, PRIMARY KEY (guild_id, channel_id))`
  ];

  console.log(chalk.blue('⏳ Syncing tables with Turso...'));

  for (const query of tables) {
    try {
      await db.execute(query);
    } catch (err) {
      if (!err.message.includes("already exists")) {
        console.error(chalk.yellow(`⚠️ SQL Error on query: ${query.substring(0, 30)}...`));
        console.error(chalk.red(`   Reason: ${err.message}`));
      }
    }
  }

  try { await db.execute("ALTER TABLE custom_commands ADD COLUMN allowed_roles TEXT"); } catch (err) {}
  try { await db.execute("ALTER TABLE custom_commands ADD COLUMN cooldown INTEGER DEFAULT 0"); } catch (err) {}

  console.log(chalk.green('✅ Turso database initialized'));
}

function first(result) { return result.rows && result.rows.length > 0 ? result.rows[0] : null; }

// ── Config ───────────────────────────────────────────────────────────────────
async function getConfig(guildId, key) {
  const r = await db.execute({ sql: 'SELECT value FROM guild_config WHERE guild_id = ? AND key = ?', args: [guildId, key] });
  return first(r)?.value ?? null;
}
async function setConfig(guildId, key, value) {
  await db.execute({ sql: 'INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)', args: [guildId, key, String(value)] });
}
async function deleteConfig(guildId, key) {
  await db.execute({ sql: 'DELETE FROM guild_config WHERE guild_id = ? AND key = ?', args: [guildId, key] });
}

// ── Users / XP ───────────────────────────────────────────────────────────────
async function bulkUpsertUserStats(statsArray) {
  if (!statsArray || statsArray.length === 0) return;

  for (const stat of statsArray) {
    await db.execute({
      sql: `INSERT INTO users (user_id, guild_id, xp, level, messages)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, guild_id)
            DO UPDATE SET
              xp = excluded.xp,
              level = excluded.level,
              messages = excluded.messages`,
      args: [stat.userId, stat.guildId, stat.xp, stat.level, stat.messages]
    });
  }
}

async function getUserStats(userId, guildId) {
  const result = await db.execute({
    sql: `SELECT * FROM users WHERE user_id = ? AND guild_id = ?`,
    args: [userId, guildId]
  });
  return result.rows[0];
}

async function getUser(userId, guildId) {
  const r = await db.execute({ sql: 'SELECT * FROM users WHERE user_id = ? AND guild_id = ?', args: [userId, guildId] });
  return first(r);
}
async function ensureUser(userId, guildId) {
  await db.execute({ sql: 'INSERT OR IGNORE INTO users (user_id, guild_id) VALUES (?, ?)', args: [userId, guildId] });
}
async function addXP(userId, guild_id, amount) {
  await db.execute({
    sql: `INSERT INTO users (user_id, guild_id, xp, messages, level) VALUES (?, ?, ?, 1, 0) ON CONFLICT(user_id, guild_id) DO UPDATE SET xp = xp + ?, messages = messages + 1`,
    args: [userId, guild_id, amount, amount]
  });
}
async function setXP(userId, guildId, amount) {
  await ensureUser(userId, guildId);
  await db.execute({ sql: 'UPDATE users SET xp = ? WHERE user_id = ? AND guild_id = ?', args: [amount, userId, guildId] });
}
async function setLevel(userId, guildId, level) {
  await db.execute({ sql: 'UPDATE users SET level = ? WHERE user_id = ? AND guild_id = ?', args: [level, userId, guildId] });
}
async function resetAllXP(guildId) {
  await db.execute({ sql: 'UPDATE users SET xp = 0, level = 0, messages = 0 WHERE guild_id = ?', args: [guildId] });
}
async function getLeaderboard(guildId, limit = 10) {
  const r = await db.execute({ sql: 'SELECT * FROM users WHERE guild_id = ? ORDER BY xp DESC LIMIT ?', args: [guildId, limit] });
  return r.rows;
}
async function getUserRank(userId, guildId) {
  const r = await db.execute({ sql: 'SELECT user_id FROM users WHERE guild_id = ? ORDER BY xp DESC', args: [guildId] });
  const index = r.rows.findIndex(u => u.user_id === userId);
  return index === -1 ? null : index + 1;
}

// ── Warnings ──────────────────────────────────────────────────────────────────
async function addWarning(userId, guildId, reason, moderatorId) { await db.execute({ sql: 'INSERT INTO warnings (user_id, guild_id, reason, moderator_id, timestamp) VALUES (?, ?, ?, ?, ?)', args: [userId, guildId, reason, moderatorId, Date.now()] }); }
async function getWarnings(userId, guildId) { const r = await db.execute({ sql: 'SELECT * FROM warnings WHERE user_id = ? AND guild_id = ? ORDER BY timestamp DESC', args: [userId, guildId] }); return r.rows; }
async function clearWarnings(userId, guildId) { await db.execute({ sql: 'DELETE FROM warnings WHERE user_id = ? AND guild_id = ?', args: [userId, guildId] }); }
async function removeWarning(warningId) { await db.execute({ sql: 'DELETE FROM warnings WHERE id = ?', args: [warningId] }); }

// ── Birthdays ─────────────────────────────────────────────────────────────────
async function setBirthday(userId, guildId, month, day) { await db.execute({ sql: 'INSERT OR REPLACE INTO birthdays (user_id, guild_id, month, day) VALUES (?, ?, ?, ?)', args: [userId, guildId, month, day] }); }
async function getBirthday(userId, guildId) { const r = await db.execute({ sql: 'SELECT * FROM birthdays WHERE user_id = ? AND guild_id = ?', args: [userId, guildId] }); return first(r); }
async function getTodayBirthdays(month, day) { const r = await db.execute({ sql: 'SELECT * FROM birthdays WHERE month = ? AND day = ?', args: [month, day] }); return r.rows; }

// ── Vouches ───────────────────────────────────────────────────────────────────
async function addVouch(targetId, guildId, points, giverId) {
  await db.execute({ sql: 'INSERT OR IGNORE INTO vouches (user_id, guild_id) VALUES (?, ?)', args: [targetId, guildId] });
  await db.execute({ sql: 'UPDATE vouches SET points = points + ? WHERE user_id = ? AND guild_id = ?', args: [points, targetId, guildId] });
  await db.execute({ sql: 'INSERT INTO vouch_log (target_id, guild_id, points, given_by, timestamp) VALUES (?, ?, ?, ?, ?)', args: [targetId, guildId, points, giverId, Date.now()] });
}
async function getVouches(userId, guildId) { const r = await db.execute({ sql: 'SELECT * FROM vouches WHERE user_id = ? AND guild_id = ?', args: [userId, guildId] }); return first(r); }
async function getVouchLeaderboard(guildId, limit = 10) { const r = await db.execute({ sql: 'SELECT * FROM vouches WHERE guild_id = ? ORDER BY points DESC LIMIT ?', args: [guildId, limit] }); return r.rows; }

// ── Achievements ──────────────────────────────────────────────────────────────
async function createAchievement(guildId, name, description, requirementType, requirementValue, rewardRoleId, rewardXp) { await db.execute({ sql: 'INSERT INTO achievements (guild_id, name, description, requirement_type, requirement_value, reward_role_id, reward_xp) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [guildId, name, description, requirementType, requirementValue, rewardRoleId || null, rewardXp || 0] }); }
async function deleteAchievement(id, guildId) { await db.execute({ sql: 'DELETE FROM user_achievements WHERE achievement_id = ?', args: [id] }); await db.execute({ sql: 'DELETE FROM achievements WHERE id = ? AND guild_id = ?', args: [id, guildId] }); }
async function getAchievements(guildId) { const r = await db.execute({ sql: 'SELECT * FROM achievements WHERE guild_id = ?', args: [guildId] }); return r.rows; }
async function getUserAchievements(userId, guildId) { const r = await db.execute({ sql: 'SELECT a.*, ua.earned_at FROM achievements a JOIN user_achievements ua ON a.id = ua.achievement_id WHERE ua.user_id = ? AND ua.guild_id = ?', args: [userId, guildId] }); return r.rows; }
async function grantAchievement(userId, guildId, achievementId) { try { await db.execute({ sql: 'INSERT OR IGNORE INTO user_achievements (user_id, guild_id, achievement_id, earned_at) VALUES (?, ?, ?, ?)', args: [userId, guildId, achievementId, Date.now()] }); return true; } catch { return false; } }
async function hasAchievement(userId, guildId, achievementId) { const r = await db.execute({ sql: 'SELECT 1 FROM user_achievements WHERE user_id = ? AND guild_id = ? AND achievement_id = ?', args: [userId, guildId, achievementId] }); return r.rows.length > 0; }
async function revokeUserAchievement(userId, guildId, achievementId) { await db.execute({ sql: 'DELETE FROM user_achievements WHERE user_id = ? AND guild_id = ? AND achievement_id = ?', args: [userId, guildId, achievementId] }); }
async function revokeAllUserAchievements(userId, guildId) { await db.execute({ sql: 'DELETE FROM user_achievements WHERE user_id = ? AND guild_id = ?', args: [userId, guildId] }); }

// ── Custom commands ───────────────────────────────────────────────────────────
async function addCustomCommand(guildId, trigger, response, roles = [], cooldown = 0) {
  const roleString = roles && roles.length > 0 ? roles.join(',') : null;
  await db.execute({
    sql: 'INSERT OR REPLACE INTO custom_commands (guild_id, trigger, response, allowed_roles, cooldown) VALUES (?, ?, ?, ?, ?)',
    args: [guildId, trigger.toLowerCase(), response, roleString, cooldown]
  });
}

async function removeCustomCommand(guildId, trigger) {
  const r = await db.execute({ sql: 'DELETE FROM custom_commands WHERE guild_id = ? AND trigger = ?', args: [guildId, trigger.toLowerCase()] });
  return { changes: Number(r.rowsAffected) };
}

async function getCustomCommand(guildId, trigger) {
  const r = await db.execute({ sql: 'SELECT * FROM custom_commands WHERE guild_id = ? AND trigger = ?', args: [guildId, trigger.toLowerCase()] });
  return first(r);
}
async function getAllCustomCommands(guildId) {
  const r = await db.execute({ sql: 'SELECT * FROM custom_commands WHERE guild_id = ?', args: [guildId] });
  return r.rows;
}

// ── Tickets ───────────────────────────────────────────────────────────────────
async function createTicket(channelId, guildId, userId) { await db.execute({ sql: 'INSERT INTO tickets (channel_id, guild_id, user_id, created_at) VALUES (?, ?, ?, ?)', args: [channelId, guildId, userId, Date.now()] }); }
async function getTicket(channelId) { const r = await db.execute({ sql: 'SELECT * FROM tickets WHERE channel_id = ?', args: [channelId] }); return first(r); }
async function updateTicketStatus(channelId, status) { await db.execute({ sql: 'UPDATE tickets SET status = ? WHERE channel_id = ?', args: [status, channelId] }); }

// ── Notification cache ────────────────────────────────────────────────────────
async function hasPosted(id, platform, guildId) { const r = await db.execute({ sql: 'SELECT 1 FROM notification_cache WHERE id = ? AND platform = ? AND guild_id = ?', args: [id, platform, guildId] }); return r.rows.length > 0; }
async function markPosted(id, platform, guildId) { await db.execute({ sql: 'INSERT OR IGNORE INTO notification_cache (id, platform, guild_id, posted_at) VALUES (?, ?, ?, ?)', args: [id, platform, guildId, Date.now()] }); }

// ── Auto roles ────────────────────────────────────────────────────────────────
async function addAutoRole(guildId, role_id) { await db.execute({ sql: 'INSERT OR IGNORE INTO auto_roles (guild_id, role_id) VALUES (?, ?)', args: [guildId, role_id] }); }
async function removeAutoRole(guildId, role_id) { await db.execute({ sql: 'DELETE FROM auto_roles WHERE guild_id = ? AND role_id = ?', args: [guildId, role_id] }); }
async function getAutoRoles(guildId) { const r = await db.execute({ sql: 'SELECT role_id FROM auto_roles WHERE guild_id = ?', args: [guildId] }); return r.rows.map(row => row.role_id); }

// ── Automod words ─────────────────────────────────────────────────────────────
async function addBannedWord(guildId, word) { await db.execute({ sql: 'INSERT OR IGNORE INTO automod_words (guild_id, word) VALUES (?, ?)', args: [guildId, word.toLowerCase()] }); }
async function removeBannedWord(guildId, word) { await db.execute({ sql: 'DELETE FROM automod_words WHERE guild_id = ? AND word = ?', args: [guildId, word.toLowerCase()] }); }
async function getBannedWords(guildId) { const r = await db.execute({ sql: 'SELECT word FROM automod_words WHERE guild_id = ?', args: [guildId] }); return r.rows.map(row => row.word); }

// ── Command channels ──────────────────────────────────────────────────────────
async function addCommandChannel(guildId, channelId) { await db.execute({ sql: 'INSERT OR IGNORE INTO command_channels (guild_id, channel_id) VALUES (?, ?)', args: [guildId, channelId] }); }
async function removeCommandChannel(guildId, channelId) { await db.execute({ sql: 'DELETE FROM command_channels WHERE guild_id = ? AND channel_id = ?', args: [guildId, channelId] }); }
async function getCommandChannels(guildId) { const r = await db.execute({ sql: 'SELECT channel_id FROM command_channels WHERE guild_id = ?', args: [guildId] }); return r.rows.map(row => row.channel_id); }

module.exports = {
  initDatabase,
  getConfig, setConfig, deleteConfig,
  getUser, getUserStats, ensureUser, addXP, setXP, setLevel, resetAllXP, getLeaderboard, getUserRank,
  addWarning, getWarnings, clearWarnings, removeWarning,
  setBirthday, getBirthday, getTodayBirthdays,
  addVouch, getVouches, getVouchLeaderboard,
  createAchievement, deleteAchievement, getAchievements, getUserAchievements,
  grantAchievement, hasAchievement, revokeUserAchievement, revokeAllUserAchievements,
  addCustomCommand, removeCustomCommand, getCustomCommand, getAllCustomCommands,
  createTicket, getTicket, updateTicketStatus,
  hasPosted, markPosted,
  addAutoRole, removeAutoRole, getAutoRoles,
  addBannedWord, removeBannedWord, getBannedWords,
  addCommandChannel, removeCommandChannel, getCommandChannels,
  bulkUpsertUserStats,
};