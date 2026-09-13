const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { initDatabase } = require('./database/db');
const chalk = require('chalk');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

client.commands = new Collection();
client.cooldowns = new Collection();
client.xpCooldowns = new Collection();

// Gateway Error Handlers
client.on('error', (err) => console.error(chalk.red('❌ Discord client error:'), err));
client.on('shardError', (err, shardId) => console.error(chalk.red(`❌ Shard ${shardId} error:`), err));
client.on('shardDisconnect', (event, shardId) => console.warn(chalk.yellow(`⚠️ Shard ${shardId} disconnected (code ${event?.code}).`)));
client.on('shardReconnecting', (shardId) => console.warn(chalk.yellow(`⏳ Shard ${shardId} reconnecting...`)));

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms waiting for: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function startBot() {
  const botName = process.env.BOT_NAME || 'Wolfy Bot';
  console.log(chalk.cyan(`\nStarting ${botName}...\n`));

  await initDatabase();
  await loadCommands(client);
  loadEvents(client);

  console.log(chalk.blue('🔌 Connecting to Discord gateway...'));

  try {
    await withTimeout(client.login(process.env.DISCORD_TOKEN), 20_000, 'client.login()');
    console.log(chalk.blue('🔌 login() resolved — waiting for ready event execution...'));
  } catch (err) {
    console.error(chalk.red('❌ client.login() failed:'), err.message);
    throw err;
  }

  return client;
}

module.exports = { startBot, client };