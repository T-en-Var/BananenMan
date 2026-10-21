import {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  CommandInteraction,
} from "discord.js";
import type { CommandBase } from "../../Lib/types.js";
import { CustomInteractionHandler } from "../../Lib/interaction.js";

const defaultLimit = 24;

export const commandBase: CommandBase = {
  slashData: new SlashCommandBuilder()
    .setName("get-starred-files")
    .setDescription("Reads all submissions in a channel.")
    .addChannelOption((option) =>
      option.setName("channel").setDescription("The channel to scan")
    )
    .addIntegerOption((option) =>
      option
        .setName("top")
        .setDescription(`Amount of submissions to show; defaults to ${defaultLimit}; -1 for all`)
    ),

  cooldown: 15000,
  adminOnly: false,

  async slashRun(handler: CustomInteractionHandler) {
    await (commandBase as any).execute(handler.interaction);
  },

  async execute(interaction: any) {
    const startTime = Date.now();
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    const limit = interaction.options.getInteger("top") ?? defaultLimit;

    const ignoreLimit = limit < 0;

    if (
      !channel ||
      !channel.isTextBased?.() ||
      !channel.viewable ||
      channel.type === ChannelType.GuildVoice
    ) {
      return interaction.reply({
        content: "Please provide a valid text channel.",
      });
    }

    if (
      !channel
        .permissionsFor(interaction.client.user)
        ?.has(PermissionsBitField.Flags.ReadMessageHistory)
    ) {
      return await interaction.reply({
        content: "I do not have permission to read message history in that channel.",
        flags: "Ephemeral",
      });
    }

    let messages: any[] = [];
    let lastMessageId;
    let hasReplied = false;
    let sendUpdates = false;
    let lastUpdate = 0;
    let timeSpent = 0;
    let responseMessage = "";

    async function appendReply(message: string) {
      responseMessage += `\n${message}`;
      await interaction.editReply(responseMessage.trim());
    }

    while (true) {
      timeSpent = (Date.now() - startTime) / 1000;

      if (!hasReplied) {
        await interaction.reply({
          content: "Processing...",
          flags: "Ephemeral",
        });
        hasReplied = true;
      } else if (timeSpent > 2) {
        await interaction.editReply({
          content: "Request is taking a bit long...",
          flags: "Ephemeral",
        });
        hasReplied = true;
      } else if (sendUpdates && timeSpent - lastUpdate > 4) {
        await interaction.followUp({
          content: `Checked ${messages.length} messages so far... (${timeSpent.toFixed(1)}s)`,
          flags: "Ephemeral",
        });
        lastUpdate = timeSpent;
      } else if (!sendUpdates && timeSpent > 5) {
        await interaction.followUp({
          content: "This might take a while, I'll send progress updates.",
          flags: "Ephemeral",
        });
        sendUpdates = true;
        lastUpdate = timeSpent;
      }

      const options: any = { limit: 100 };
      if (lastMessageId) options.before = lastMessageId;

      const fetchedMessages = await channel.messages.fetch(options);
      if (fetchedMessages.size === 0) break;

      messages.push(...fetchedMessages.values());
      lastMessageId = fetchedMessages.last().id;
    }

    await interaction.editReply({
      content: `Received ${messages.length} messages (${timeSpent.toFixed(1)}s). Starting calculation.`,
      flags: "Ephemeral",
    });

    const star = "⭐";
    const down = "❌";

    const stars: Record<string, any> = {};

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.attachments.size !== 1) continue;

      // Count stars and downs separately, ignoring bot reactions (-1)
      let starsCount = -1;
      let downsCount = -1;

      for (const reaction of msg.reactions.cache.values()) {
        if (reaction.emoji.name === star) {
          starsCount += reaction.count;
        } else if (reaction.emoji.name === down) {
          downsCount += reaction.count;
        }
      }

      const netCount = starsCount - downsCount;

      const attachment = msg.attachments.first();

      stars[msg.id] = {
        stars: starsCount,
        downs: downsCount,
        count: netCount,
        fileName: attachment?.name ?? "Unknown file",
        msgContent: msg.content?.slice(0, 100) ?? "(No text)",
      };
    }

    await appendReply(`Found ${Object.keys(stars).length} files with ⭐'s`);

    const sorted = Object.entries(stars).sort((a: any, b: any) => b[1].count - a[1].count);
    let limitedList = sorted;
    if (!ignoreLimit) limitedList = sorted.slice(0, limit);

    const contentList = limitedList.map(([id, data]: any, index) => {
      const link = `https://discord.com/channels/${interaction.guildId}/${channel.id}/${id}`;
      // \`${data.stars} ⭐ / ${data.downs} ❌\`
      return `${index + 1}. [Link](${link}) — **${data.count}** ✨ — ${data.msgContent}`;
    });

    if (contentList.length === 0) contentList.push("No starred files found 😔");

    // Batch replies by 2000 character chunks
    const start = ignoreLimit ? `**Top` : `**Top ${limit}`;
    const header = `${start} starred file(s)** (out of ${messages.length} messages in <#${channel.id}>):\n-# Not including my own reactions\n`;
    const contentBatches: string[] = [];
    let batch = header;

    for (const line of contentList) {
      if ((batch + "\n" + line).length >= 2000) {
        contentBatches.push(batch);
        batch = "";
      }
      batch += `\n${line}`;
    }

    if (batch) contentBatches.push(batch);

    for (const msg of contentBatches) {
      if (!hasReplied) {
        await interaction.editReply({ content: msg, flags: "Ephemeral" });
        hasReplied = true;
      } else {
        await interaction.followUp({ content: msg, flags: "Ephemeral" });
      }
    }
  },
};
