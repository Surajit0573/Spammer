// deploy-commands.js
// Run once with: node deploy-commands.js
// Registers /spam and /spamadmin globally across ALL guilds.
// Global commands may take up to 1 hour to propagate to every server.

require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes, ApplicationCommandType, ApplicationCommandOptionType } = require('discord-api-types/v10');

const SPAM_CATEGORIES = ['Birthday', 'Codename', 'VC', 'Urgent', 'Game'];

const commands = [
  // ── /spam ─────────────────────────────────────────────────────────────────
  {
    name: 'spam',
    description: 'Ping a user with a series of messages from a chosen category.',
    type: ApplicationCommandType.ChatInput,
    options: [
      {
        name: 'target',
        description: 'The user to ping.',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: 'category',
        description: 'The message category to pick from.',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: SPAM_CATEGORIES.map((c) => ({ name: c, value: c })),
      },
      {
        name: 'amount',
        description: 'How many messages to send (1–25).',
        type: ApplicationCommandOptionType.Integer,
        required: true,
        min_value: 1,
        max_value: 25,
      },
    ],
  },

  // ── /spamadmin ────────────────────────────────────────────────────────────
  {
    name: 'spamadmin',
    description: '[Admin only] Manage per-user spam permissions for this server.',
    type: ApplicationCommandType.ChatInput,
    // Default permission: only members with Administrator can see/use this.
    default_member_permissions: '8', // 8 = ADMINISTRATOR bit flag
    options: [
      // subcommand: timeout
      {
        name: 'timeout',
        description: 'Prevent or restore a user\'s ability to use /spam.',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'user',
            description: 'Target user.',
            type: ApplicationCommandOptionType.User,
            required: true,
          },
          {
            name: 'action',
            description: 'Add or remove the timeout.',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: 'add', value: 'add' },
              { name: 'remove', value: 'remove' },
            ],
          },
        ],
      },

      // subcommand: limit
      {
        name: 'limit',
        description: 'Set or clear a custom max ping amount for a user.',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'user',
            description: 'Target user.',
            type: ApplicationCommandOptionType.User,
            required: true,
          },
          {
            name: 'max',
            description: 'New maximum (1–25). Omit to clear any existing limit.',
            type: ApplicationCommandOptionType.Integer,
            required: false,
            min_value: 1,
            max_value: 25,
          },
        ],
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('🔄  Registering global slash commands…');

    // Routes.applicationCommands → registers globally (no guild ID needed)
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log(`✅  Successfully registered ${data.length} global slash command(s).`);
    console.log('ℹ️   Note: Global commands can take up to 1 hour to propagate to all servers.');
  } catch (error) {
    console.error('❌  Failed to register commands:', error);
    process.exit(1);
  }
})();