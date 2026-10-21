import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from "fs/promises";
import config from "../../Base/config.js";
import type { CommandBase } from "../../Lib/types.js";
import { CustomInteractionHandler } from "../../Lib/interaction.js";

export const commandBase: CommandBase = {
  slashData: new SlashCommandBuilder()
    .setName("guilds")
    .setDescription("List all guilds with stored settings or logs data."),
  cooldown: 5000,
  adminOnly: true,

  async slashRun(handler: CustomInteractionHandler) {
    const { interaction, client } = handler;

    let files: string[];
    try {
      files = await fs.readdir(config.dataFolder);
    } catch (err: any) {
      return interaction.reply({
        content: `❌ Could not read data folder: \`${err.message}\``,
        flags: "Ephemeral",
      });
    }

    const guildIds = new Set<string>();

    for (const file of files) {
      const match = file.match(/(?:logs|settings)\.(\d+)\.json$/);
      if (match) guildIds.add(match[1]);
    }

    if (guildIds.size === 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏠 Guild List")
            .setDescription("No guild data files found.")
            .setColor("Yellow"),
        ],
        flags: "Ephemeral",
      });
    }

    const lines: string[] = [];
    for (const guildId of guildIds) {
      const guild = client.guilds.cache.get(guildId);
      const name = guild ? guild.name : "(not in cache)";
      const members = guild?.memberCount ?? "Unknown";
      const line = `• **${guildId}** — ${name} (${members} members)`;
      lines.push(line);
    }

    const chunks = chunkLines(lines, 1900);
    let first = true;

    for (const chunk of chunks) {
      const embed = new EmbedBuilder()
        .setTitle("🏠 Guild List")
        .setDescription(chunk)
        .setColor("Blue")
        .setFooter({ text: `${guildIds.size} guild(s) found` });

      if (first) {
        await interaction.reply({ embeds: [embed], flags: "Ephemeral" });
        first = false;
      } else {
        await interaction.followUp({ embeds: [embed], flags: "Ephemeral" });
      }
    }
  },
};

/**
 * Split lines into chunks respecting Discord message length limits.
 */
function chunkLines(lines: string[], maxLen = 1900): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    if ((current + "\n" + line).length > maxLen) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
