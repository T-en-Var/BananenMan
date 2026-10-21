import { SlashCommandBuilder } from "@discordjs/builders";
import type { CommandBase } from "../../Lib/types.js";
import { CustomInteractionHandler } from "../../Lib/interaction.js";

export const commandBase: CommandBase = {
  slashData: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Pong!"),
  // If you want to improve the command, check the guide: https://discordjs.guide/slash-commands/advanced-creation.html
  cooldown: 0, // 1 second = 1000 ms / set to 0 if you don't want a cooldown.
  adminOnly: false, // Set to true if you want the command to be usable only by the developer.

  async slashRun(handler: CustomInteractionHandler) {
    await handler.interaction.reply(`Pong 🏓`);
  },
};
