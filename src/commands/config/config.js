const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const {
  setConfig, getConfig, addAutoRole, removeAutoRole, getAutoRoles,
  addBannedWord, removeBannedWord, getBannedWords,
  addCommandChannel, removeCommandChannel, getCommandChannels,
} = require('../../database/db');
const { requirePerms, successEmbed, errorEmbed } = require('../../utils/helpers');

module.exports = {
  name: 'config',
  aliases: ['setup', 'set'],
  async execute(message, args, client, prefix) {
    if (!requirePerms(message, PermissionFlagsBits.ManageGuild)) return;
    const sub = args[0]?.toLowerCase();
    if (!sub || sub === 'help') return showHelp(message, prefix);

    const channelConfigs = {
      'log-channel': 'log_channel', 'level-channel': 'level_channel',
      'birthday-channel': 'birthday_channel', 'welcome-channel': 'welcome_channel',
      'yt-channel-notify': 'yt_notif_channel', 'tiktok-channel': 'tiktok_notif_channel',
      'instagram-channel': 'instagram_notif_channel', 'twitch-channel': 'twitch_notif_channel',
      'ticket-category': 'ticket_category',
    };
    const roleConfigs = {
      'gif-role': 'gif_role', 'birthday-role': 'birthday_role', 'mod-role': 'mod_role',
      'trusted-fan-role': 'trusted_fan_role', 'yt-ping-role': 'yt_ping_role',
      'twitch-ping-role': 'twitch_ping_role',
      'level-role-5': 'level_role_5', 'level-role-10': 'level_role_10',
      'level-role-20': 'level_role_20', 'level-role-30': 'level_role_30',
      'level-role-40': 'level_role_40', 'level-role-50': 'level_role_50',
      'level-role-100': 'level_role_100',
    };
    const valueConfigs = {
      'prefix': 'prefix', 'yt-channel-id': 'yt_channel_id',
      'twitch-username': 'twitch_username', 'tiktok-username': 'tiktok_username',
      'instagram-username': 'instagram_username', 'trusted-fan-threshold': 'trusted_fan_threshold',
    };

    if (channelConfigs[sub]) {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply({ embeds: [errorEmbed(`Mention a channel: \`${prefix}config ${sub} #channel\``)] });
      await setConfig(message.guild.id, channelConfigs[sub], channel.id);
      return message.reply({ embeds: [successEmbed(`**${sub}** set to ${channel}.`)] });
    }
    if (roleConfigs[sub]) {
      const role = message.mentions.roles.first();
      if (!role) return message.reply({ embeds: [errorEmbed(`Mention a role: \`${prefix}config ${sub} @role\``)] });
      await setConfig(message.guild.id, roleConfigs[sub], role.id);
      return message.reply({ embeds: [successEmbed(`**${sub}** set to ${role}.`)] });
    }
    if (valueConfigs[sub]) {
      const val = args.slice(1).join(' ');
      if (!val) return message.reply({ embeds: [errorEmbed(`Provide a value: \`${prefix}config ${sub} <value>\``)] });
      await setConfig(message.guild.id, valueConfigs[sub], val);
      return message.reply({ embeds: [successEmbed(`**${sub}** set to \`${val}\`.`)] });
    }

    if (sub === 'status') {
      const type = args[1]?.toUpperCase();
      const text = args.slice(2).join(' ');
      if (!type || !text) return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}config status <PLAYING|WATCHING|LISTENING|COMPETING> <text>\``)] });
      const types = { PLAYING: 0, STREAMING: 1, LISTENING: 2, WATCHING: 3, COMPETING: 5 };
      if (types[type] === undefined) return message.reply({ embeds: [errorEmbed('Type must be: PLAYING, WATCHING, LISTENING, COMPETING')] });
      client.user.setPresence({ activities: [{ name: text, type: types[type] }] });
      await setConfig(message.guild.id, 'bot_status', text);
      await setConfig(message.guild.id, 'bot_status_type', type);
      return message.reply({ embeds: [successEmbed(`Bot status set to **${type}** ${text}`)] });
    }

    if (sub === 'autorole') {
      const action = args[1]?.toLowerCase();
      const role = message.mentions.roles.first();
      if (action === 'add') {
        if (!role) return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}config autorole add @role\``)] });
        await addAutoRole(message.guild.id, role.id);
        return message.reply({ embeds: [successEmbed(`Auto-role **${role.name}** added.`)] });
      }
      if (action === 'remove') {
        if (!role) return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}config autorole remove @role\``)] });
        await removeAutoRole(message.guild.id, role.id);
        return message.reply({ embeds: [successEmbed(`Auto-role **${role.name}** removed.`)] });
      }
      if (action === 'list') {
        const roles = await getAutoRoles(message.guild.id);
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x7c3aed).setTitle('⚙️ Auto Roles').setDescription(roles.length ? roles.map(r => `<@&${r}>`).join('\n') : 'None set.')] });
      }
    }

    if (sub === 'bannedword') {
      const action = args[1]?.toLowerCase();
      const word = args[2]?.toLowerCase();
      if (action === 'add') {
        if (!word) return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}config bannedword add <word>\``)] });
        await addBannedWord(message.guild.id, word);
        return message.reply({ embeds: [successEmbed(`Word \`${word}\` added to banned words.`)] });
      }
      if (action === 'remove') {
        if (!word) return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}config bannedword remove <word>\``)] });
        await removeBannedWord(message.guild.id, word);
        return message.reply({ embeds: [successEmbed(`Word \`${word}\` removed.`)] });
      }
      if (action === 'list') {
        const words = await getBannedWords(message.guild.id);
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x7c3aed).setTitle('🚫 Banned Words').setDescription(words.length ? words.map(w => `\`${w}\``).join(', ') : 'No banned words set.')] });
      }
    }

    if (sub === 'allowlinks') {
      const action = args[1]?.toLowerCase();
      const channel = message.mentions.channels.first();
      if (action === 'add') {
        if (!channel) return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}config allowlinks add #channel\``)] });
        const current = await getConfig(message.guild.id, 'allowed_link_channels') || '';
        const channels = current.split(',').map(s => s.trim()).filter(Boolean);
        if (!channels.includes(channel.id)) channels.push(channel.id);
        await setConfig(message.guild.id, 'allowed_link_channels', channels.join(','));
        return message.reply({ embeds: [successEmbed(`${channel} added to allowed link channels.`)] });
      }
      if (action === 'remove') {
        if (!channel) return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}config allowlinks remove #channel\``)] });
        const current = await getConfig(message.guild.id, 'allowed_link_channels') || '';
        const channels = current.split(',').map(s => s.trim()).filter(id => id && id !== channel.id);
        await setConfig(message.guild.id, 'allowed_link_channels', channels.join(','));
        return message.reply({ embeds: [successEmbed(`${channel} removed from allowed link channels.`)] });
      }
      if (action === 'list') {
        const current = await getConfig(message.guild.id, 'allowed_link_channels') || '';
        const channels = current.split(',').map(s => s.trim()).filter(Boolean);
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x7c3aed).setTitle('🔗 Allowed Link Channels').setDescription(channels.length ? channels.map(id => `<#${id}>`).join('\n') : 'None — links blocked everywhere except GIFs.\n⚠️ Discord invite links are ALWAYS blocked.')] });
      }
    }

    if (sub === 'cmdchannel') {
      const action = args[1]?.toLowerCase();
      const channel = message.mentions.channels.first();
      if (action === 'add') {
        if (!channel) return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}config cmdchannel add #channel\``)] });
        await addCommandChannel(message.guild.id, channel.id);
        return message.reply({ embeds: [successEmbed(`${channel} added to command channels.`)] });
      }
      if (action === 'remove') {
        if (!channel) return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}config cmdchannel remove #channel\``)] });
        await removeCommandChannel(message.guild.id, channel.id);
        return message.reply({ embeds: [successEmbed(`${channel} removed.`)] });
      }
      if (action === 'list') {
        const channels = await getCommandChannels(message.guild.id);
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x7c3aed).setTitle('💬 Command Channels').setDescription(channels.length ? channels.map(id => `<#${id}>`).join('\n') : 'No restriction — commands allowed everywhere.')] });
      }
    }

    if (sub === 'view' || sub === 'show') {
      const categories = {
        '📢 Channels': {
          'log-channel': 'log_channel', 'level-channel': 'level_channel',
          'birthday-channel': 'birthday_channel', 'welcome-channel': 'welcome_channel',
          'yt-channel-notify': 'yt_notif_channel', 'twitch-channel': 'twitch_notif_channel',
          'ticket-category': 'ticket_category'
        },
        '🎖️ Roles': {
          'gif-role': 'gif_role', 'mod-role': 'mod_role', 'birthday-role': 'birthday_role', 'trusted-fan-role': 'trusted_fan_role',
          'yt-ping-role': 'yt_ping_role', 'twitch-ping-role': 'twitch_ping_role',
          'level-role-5': 'level_role_5', 'level-role-10': 'level_role_10',
          'level-role-20': 'level_role_20', 'level-role-30': 'level_role_30',
          'level-role-40': 'level_role_40', 'level-role-50': 'level_role_50',
          'level-role-100': 'level_role_100'
        },
        '🔧 Values': {
          'prefix': 'prefix', 'yt-channel-id': 'yt_channel_id', 'twitch-username': 'twitch_username',
          'tiktok-username': 'tiktok_username', 'instagram-username': 'instagram_username',
          'trusted-fan-threshold': 'trusted_fan_threshold'
        }
      };

      const embed = new EmbedBuilder()
          .setColor(0x7c3aed)
          .setTitle(`⚙️ Current Config for ${message.guild.name}`)
          .setTimestamp();

      for (const [categoryName, keys] of Object.entries(categories)) {
        const lines = await Promise.all(
            Object.entries(keys).map(async ([label, key]) => {
              const val = await getConfig(message.guild.id, key);
              if (!val || val === 'not set') return `**${label}:** _not set_`;

              if ((key.includes('channel') || key.includes('category')) && !key.includes('channel_id')) {
                return `**${label}:** <#${val}>`;
              } else if (key.includes('role')) {
                return `**${label}:** <@&${val}>`;
              } else {
                return `**${label}:** \`${val}\``;
              }
            })
        );

        const filteredLines = lines.filter(Boolean).join('\n').trim();
        embed.addFields({
          name: categoryName,
          value: filteredLines.length > 0 ? filteredLines : 'No setups found.',
          inline: false
        });
      }

      const autoRoles = (await getAutoRoles(message.guild.id)) || [];
      const bannedWords = (await getBannedWords(message.guild.id)) || [];
      const rawLinks = await getConfig(message.guild.id, 'allowed_link_channels') || '';
      const linkChannels = rawLinks.split(',').map(s => s.trim()).filter(Boolean);
      const cmdChannels = (await getCommandChannels(message.guild.id)) || [];

      const listContent = [
        `**Auto Roles:** ${autoRoles.length ? autoRoles.map(id => `<@&${id}>`).join(', ') : '_None_'}`,
        `**Allowed Link Channels:** ${linkChannels.length ? linkChannels.map(id => `<#${id}>`).join(', ') : '_None (Blocked)_'}`,
        `**Restricted Command Channels:** ${cmdChannels.length ? cmdChannels.map(id => `<#${id}>`).join(', ') : '_None (Global)_'}`,
        `**Banned Words Count:** \`${bannedWords.length}\` active strings`
      ].join('\n');

      embed.addFields({
        name: '🛡️ Lists & System Status',
        value: listContent.length > 0 ? listContent : 'No active statuses.',
        inline: false
      });

      return message.reply({ embeds: [embed] });
    }

    showHelp(message, prefix);
  },
};

function showHelp(message, prefix) {
  const embed = new EmbedBuilder().setColor(0x7c3aed).setTitle('⚙️ Config Commands')
      .addFields(
          { name: '📢 Channels', value: `\`${prefix}config log-channel\` \`${prefix}config level-channel\`\n\`${prefix}config birthday-channel\` \`${prefix}config welcome-channel\`\n\`${prefix}config yt-channel-notify\` \`${prefix}config twitch-channel\`\n\`${prefix}config ticket-category\`` },
          { name: '🎖️ Roles', value: `\`${prefix}config gif-role @role\` \`${prefix}config birthday-role\`\n\`${prefix}config mod-role\` \`${prefix}config trusted-fan-role\`\n\`${prefix}config level-role-5\` (also 10,20,30,40,50,100)\n\`${prefix}config yt-ping-role\` \`${prefix}config twitch-ping-role\`` },
          { name: '🔧 Values', value: `\`${prefix}config prefix <symbol>\`\n\`${prefix}config yt-channel-id <id>\` \`${prefix}config twitch-username <name>\`\n\`${prefix}config trusted-fan-threshold <number>\`` },
          { name: '🚫 AutoMod', value: `\`${prefix}config bannedword add/remove/list <word>\`\n\`${prefix}config allowlinks add/remove/list #channel\`` },
          { name: '💬 Command Channels', value: `\`${prefix}config cmdchannel add/remove/list #channel\`` },
          { name: '🤖 Bot', value: `\`${prefix}config status WATCHING <text>\`\n\`${prefix}config autorole add/remove/list\`\n\`${prefix}config view\`` },
      );
  message.reply({ embeds: [embed] });
}