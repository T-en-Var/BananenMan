import { ChannelType, Events, Message } from "discord.js";
import { Collection } from "discord.js";
import { awardXp, XpSource } from "../Lib/xp.js";

const xpCooldown = new Collection<string, number>();
const TEXT_XP_COOLDOWN_MS = 20_000;

export default {
  name: Events.MessageCreate,
  async execute(message: Message) {
    if (message.author.bot) {
      return;
    }

    if (message.channel.type === ChannelType.DM) {
      return await message.channel.send("Hi! I don't work in DM's. Thank you.");
    }

    tryAwardTextXp(message);
  },
};

export function tryAwardTextXp(message: Message) {
  if (!message.guildId) return;

  const key = `${message.guildId}:${message.author.id}`;
  const now = Date.now();
  const cooldownUntil = xpCooldown.get(key);
  if (cooldownUntil && now < cooldownUntil) return;

  xpCooldown.set(key, now + TEXT_XP_COOLDOWN_MS);
  setTimeout(() => xpCooldown.delete(key), TEXT_XP_COOLDOWN_MS);

  awardXp(message.guildId, message.author.id, XpSource.TEXT_MESSAGE, 1, message.channelId).catch((err) =>
    console.error(`[TextXp] Failed to award XP to ${message.author.id} in guild ${message.guildId}:`, err)
  );
}
