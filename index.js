// index.js
require('dotenv').config();
const http = require('http');
const { Client, GatewayIntentBits, Events, InteractionType, PermissionsBitField } = require('discord.js');
const data = require('./data');
const db = require('./db');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Promise-based delay. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fisher-Yates shuffle — returns a NEW shuffled copy of the array.
 * @param {any[]} arr
 * @returns {any[]}
 */
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Picks `n` unique random items from `arr`.
 * If n >= arr.length, returns the full shuffled array.
 * @param {any[]} arr
 * @param {number} n
 * @returns {any[]}
 */
function pickUnique(arr, n) {
  const shuffled = shuffle(arr);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

// ─── CLIENT ──────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅  Logged in as ${readyClient.user.tag}`);
});

// ─── INTERACTION HANDLER ─────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.type !== InteractionType.ApplicationCommand) return;

  const { commandName, guild } = interaction;

  // All commands require a guild context.
  if (!guild) {
    return interaction.reply({
      content: '❌ This command can only be used inside a server.',
      ephemeral: true,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  /spam
  // ══════════════════════════════════════════════════════════════════════════
  if (commandName === 'spam') {
    const invoker  = interaction.member;
    const target   = interaction.options.getUser('target', true);
    const category = interaction.options.getString('category', true);
    let   amount   = interaction.options.getInteger('amount', true);

    // ── 1. Check timeout ───────────────────────────────────────────────────
    if (await db.isTimedOut(guild.id, invoker.id)) {
      return interaction.reply({
        content: '🚫 You have been timed out from using `/spam` in this server.',
        ephemeral: true,
      });
    }

    // ── 2. Check custom limit ──────────────────────────────────────────────
    const customMax = await db.getLimit(guild.id, invoker.id);
    if (customMax !== null && amount > customMax) {
      return interaction.reply({
        content: `⚠️ An admin has restricted your max ping amount to **${customMax}** in this server. Reducing your request accordingly.`,
        ephemeral: true,
      }).then(() => { /* carry on with clamped amount */ });
      // We still continue — clamp and proceed.
      // (If you want a hard stop instead, replace with `return` after the reply.)
      amount = customMax;
    } else if (customMax !== null && amount > customMax) {
      amount = customMax;
    }

    // ── 3. Resolve target member ───────────────────────────────────────────
    let targetMember;
    try {
      targetMember = await guild.members.fetch(target.id);
    } catch {
      targetMember = null;
    }

    if (!targetMember) {
      return interaction.reply({
        content: '❌ That user doesn\'t appear to be a member of this server.',
        ephemeral: true,
      });
    }

    // ── 4. Pick messages ───────────────────────────────────────────────────
    const pool = data[category];
    if (!pool || pool.length === 0) {
      return interaction.reply({
        content: `❌ No messages found for category **${category}**.`,
        ephemeral: true,
      });
    }

    const selected = pickUnique(pool, amount);

    // ── 5. Public announcement before spamming ────────────────────────────
    await interaction.reply({
      content: [
        `> 📣 **Spam Incoming!**`,
        `> 👤 **Initiated by:** ${interaction.member.toString()}`,
        `> 🎯 **Target:** ${targetMember.toString()}`,
        `> 🗂️ **Category:** ${category}`,
        `> 🔢 **Messages:** ${selected.length}`,
        `> ⏳ Buckle up — starting now...`,
      ].join('\n'),
      ephemeral: false,
    });

    // ── 6. Send messages with 1.5 s gap ───────────────────────────────────
    for (let i = 0; i < selected.length; i++) {
      const message = `${targetMember.toString()} ${selected[i]}`;
      try {
        await interaction.channel.send(message);
      } catch (err) {
        console.error(`Failed to send message ${i + 1}:`, err);
      }

      if (i < selected.length - 1) {
        await sleep(1500);
      }
    }

    console.log(
      `[/spam] ${invoker.user?.tag ?? invoker.id} → ${target.tag} | ` +
      `category: ${category} | amount: ${selected.length} | ` +
      `guild: ${guild.name} (${guild.id})`,
    );
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  /spamadmin
  // ══════════════════════════════════════════════════════════════════════════
  if (commandName === 'spamadmin') {
    // Double-check Administrator permission server-side (belt AND suspenders
    // alongside default_member_permissions in the command registration).
    const member = interaction.member;
    const hasAdmin =
      member.permissions instanceof PermissionsBitField
        ? member.permissions.has(PermissionsBitField.Flags.Administrator)
        : new PermissionsBitField(BigInt(member.permissions)).has(
            PermissionsBitField.Flags.Administrator,
          );

    if (!hasAdmin) {
      return interaction.reply({
        content: '🔒 You need the **Administrator** permission to use this command.',
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    // ── subcommand: timeout ────────────────────────────────────────────────
    if (sub === 'timeout') {
      const targetUser = interaction.options.getUser('user', true);
      const action     = interaction.options.getString('action', true);

      if (action === 'add') {
        await db.addTimeout(guild.id, targetUser.id);
        return interaction.reply({
          content: `🚫 **${targetUser.tag}** has been timed out from using \`/spam\` in this server.`,
          ephemeral: true,
        });
      }

      if (action === 'remove') {
        await db.removeTimeout(guild.id, targetUser.id);
        return interaction.reply({
          content: `✅ Timeout lifted for **${targetUser.tag}**. They can use \`/spam\` again.`,
          ephemeral: true,
        });
      }
    }

    // ── subcommand: limit ──────────────────────────────────────────────────
    if (sub === 'limit') {
      const targetUser = interaction.options.getUser('user', true);
      const max        = interaction.options.getInteger('max'); // optional

      if (max === null || max === undefined) {
        // Clear any existing limit
        await db.removeLimit(guild.id, targetUser.id);
        return interaction.reply({
          content: `✅ Custom limit cleared for **${targetUser.tag}**. They are subject to the default maximum (25).`,
          ephemeral: true,
        });
      }

      await db.setLimit(guild.id, targetUser.id, max);
      return interaction.reply({
        content: `✅ **${targetUser.tag}**'s max ping amount in this server is now set to **${max}**.`,
        ephemeral: true,
      });
    }
  }
});

// ─── KEEP-ALIVE HTTP SERVER (required for Render Web Service free tier) ─────────
// Render's free Web Service expects an open port. This tiny server satisfies
// that check without affecting the bot in any way.
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => {
  res.writeHead(200);
  res.end('Bot is running.');
}).listen(PORT, () => {
  console.log(`🌐  Health-check server listening on port ${PORT}`);
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
client.login(process.env.TOKEN);