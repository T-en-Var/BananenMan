import { SlashCommandBuilder, ChannelType, PermissionsBitField } from "discord.js";
import type { CommandBase } from "../../Lib/types.js";
import { CustomInteractionHandler } from "../../Lib/interaction.js";

export const commandBase: CommandBase = {
  slashData: new SlashCommandBuilder()
    .setName("mark-files")
    .setDescription("React with ⭐ and ❌ to all audio files in a channel")
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("Channel to scan for audio messages")
    ),

  cooldown: 30000,
  adminOnly: true,

  async slashRun(handler: CustomInteractionHandler) {
    const channel = handler.interaction.options.getChannel("channel") ?? handler.interaction.channel;

    if (
      !channel ||
      !(channel as any).isTextBased?.() ||
      !(channel as any).viewable ||
      channel.type === ChannelType.GuildVoice
    ) {
      return handler.interaction.reply("Please provide a valid text channel.");
    }

    if (
      !(channel as any)
        .permissionsFor(handler.interaction.client.user)
        ?.has(PermissionsBitField.Flags.ReadMessageHistory) ||
      !(channel as any)
        .permissionsFor(handler.interaction.client.user)
        ?.has(PermissionsBitField.Flags.AddReactions)
    ) {
      return handler.interaction.reply(
        "I need permission to read messages and add reactions in this channel."
      );
    }

    await handler.interaction.reply({ content: "Scanning messages for audio files…", ephemeral: true } as any);

    let messages: any[] = [];
    let lastMessageId;

    while (true) {
      const options: any = { limit: 100 };
      if (lastMessageId) options.before = lastMessageId;

      const fetched = await (channel as any).messages.fetch(options);
      if (fetched.size === 0) break;

      messages.push(...fetched.values());
      lastMessageId = fetched.last().id;
      await handler.interaction.editReply(`Scanning messages… (${messages.length} collected)`);
    }

    let reacted = 0;
    for (const msg of messages) {
      if (msg.attachments.size !== 1) continue;

      const attachment = msg.attachments.first();
      if (!attachment.contentType?.startsWith("audio")) continue;

      const botReacted = msg.reactions.cache.some((r: any) =>
        r.users.cache.has(handler.client.user!.id)
      );
      if (botReacted) continue;

      await handler.interaction.editReply(`Reacting to: ${msg.content}`);

      try {
        await msg.react("⭐");
        await msg.react("❌");
        reacted++;
      } catch (err) {
        console.error(`Failed to react to message ${msg.id}:`, err);
      }
    }

    await handler.interaction.editReply(`✅ Finished! Added ⭐ and ❌ to ${reacted} audio messages.`);
  },
};
