import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import type { CommandBase } from "../../Lib/types.js";
import { CustomInteractionHandler } from "../../Lib/interaction.js";

export const commandBase: CommandBase = {
  slashData: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Get the bot's invite link."),

  cooldown: 5000,
  adminOnly: false,

  async slashRun(handler: CustomInteractionHandler) {
    // build the OAuth2 URL
    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${handler.client.user!.id}&permissions=${PermissionFlagsBits.Administrator}&scope=bot%20applications.commands`;

    await handler.interaction.reply({
      content: `Here's my invite link:\n${inviteUrl}`,
      ephemeral: true,
    } as any);
  },
};
