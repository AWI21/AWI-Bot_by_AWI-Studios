const { Events } = require('discord.js');
const chalk = require('chalk');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(chalk.magenta(`\nBot is online as ${client.user.tag}`));
    console.log(chalk.gray(`   Serving ${client.guilds.cache.size} guild(s)\n`));

    const status = process.env.BOT_STATUS || 'Watching the pack 🐺';
    const statusType = process.env.BOT_STATUS_TYPE || 'WATCHING';
    const activityTypes = { PLAYING: 0, STREAMING: 1, LISTENING: 2, WATCHING: 3, COMPETING: 5 };

    client.user.setPresence({
      activities: [{ name: status, type: activityTypes[statusType.toUpperCase()] ?? 3 }],
      status: process.env.BOT_ONLINE_STATUS || 'online',
    });
  },
};