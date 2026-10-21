import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Settings } from "../../Lib/settings.js";
import type { CommandBase } from "../../Lib/types.js";
import { CustomInteractionHandler } from "../../Lib/interaction.js";

export const commandBase: CommandBase = {
  slashData: new SlashCommandBuilder().setName("motd").setDescription("Message Of The Day!"),
  cooldown: 1000,
  adminOnly: false,

  async slashRun(handler: CustomInteractionHandler) {
    const settings = new Settings(handler.interaction.guildId!);
    const motd = (await settings.get("motd")) || "No MOTD set.";

    return await handler.interaction.reply({
      embeds: [new EmbedBuilder().setTitle("MOTD").setDescription(motd).setTimestamp()],
    });
  },
};
