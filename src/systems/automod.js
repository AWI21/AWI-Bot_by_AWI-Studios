const { PermissionFlagsBits } = require('discord.js');
const { getBannedWords, getConfig } = require('../database/db');

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\_\-\.\,\*\+\~\`\'\"\#\$\%\^\&\;\:\=\{\}\(\)\[\]\\\/\|]+/g, '');
}

async function handleAutomod(message, client) {
  if (!message.guild || message.author.bot) return false;

  const [bannedWords, gifRoleId, blockLinks] = await Promise.all([
    getBannedWords(message.guild.id),
    getConfig(message.guild.id, 'gif_role'),
    getConfig(message.guild.id, 'block_links')
  ]);

  const rawContent = message.content;
  const cleanContent = rawContent.toLowerCase();
  const strippedContent = normalizeText(rawContent);

  if (bannedWords && bannedWords.length > 0) {
    for (const word of bannedWords) {
      const lowerWord = word.toLowerCase();
      const strippedWord = normalizeText(word);
      const escapedWord = lowerWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');

      if (cleanContent.includes(lowerWord) || strippedContent.includes(strippedWord) || regex.test(cleanContent)) {
        if (message.deletable) {
          await message.delete().catch(err => console.error("AutoMod Delete Error (Missing Manage Messages Perms?):", err));
        }
        const warningMsg = await message.channel.send({
          content: `⚠️ ${message.author}, your message contained a banned word.`
        }).catch(() => {});
        setTimeout(() => warningMsg?.delete().catch(() => {}), 5000);
        return true;
      }
    }
  }

  const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator) || message.member?.permissions.has(8n);
  if (isAdmin) return false;

  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const links = rawContent.match(urlRegex);

  if (links && links.length > 0) {
    const hasGifRole = gifRoleId && message.member?.roles.cache.has(gifRoleId);

    if (hasGifRole) {
      const gifDomains = ['tenor.com', 'giphy.com', 'klipy.co', 'klipy.com', 'giphy.mobi'];

      for (const link of links) {
        const lowerLink = link.toLowerCase();
        const isGif = gifDomains.some(domain => lowerLink.includes(domain)) || lowerLink.endsWith('.gif') || lowerLink.includes('.gif?');

        if (!isGif) {
          if (message.deletable) {
            await message.delete().catch(() => {});
          }
          const warningMsg = await message.channel.send({
            content: `⚠️ ${message.author}, you can only post GIF links (Tenor, Giphy, Klipy)! Non-GIF links are removed.`
          }).catch(() => {});
          setTimeout(() => warningMsg?.delete().catch(() => {}), 5000);
          return true;
        }
      }
      return false;
    }

    if (blockLinks === 'true' || blockLinks === '1') {
      if (message.deletable) {
        await message.delete().catch(() => {});
      }
      const warningMsg = await message.channel.send({
        content: `⚠️ ${message.author}, posting links is disabled in this server.`
      }).catch(() => {});
      setTimeout(() => warningMsg?.delete().catch(() => {}), 5000);
      return true;
    }
  }

  return false;
}

module.exports = { handleAutomod };