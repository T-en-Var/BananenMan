import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { CommandBase } from "../../Lib/types.js";
import { CustomInteractionHandler } from "../../Lib/interaction.js";
import { getLeaderboard } from "../../Lib/xp.js";

const PAGE_SIZE = 20;

export const commandBase: CommandBase = {
  slashData: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the server's XP leaderboard")
    .addStringOption((opt) =>
      opt
        .setName("sort")
        .setDescription("Sort by voice or text XP (defaults to voice)")
        .addChoices(
          { name: "Voice XP", value: "voice" },
          { name: "Text XP", value: "text" }
        )
    ),

  cooldown: 5000,
  adminOnly: false,

  async slashRun(handler: CustomInteractionHandler) {
    const interaction = handler.interaction;
    const sortBy = (interaction.options.getString("sort") as "voice" | "text" | null) ?? "voice";
    const sortLabel = sortBy === "voice" ? "Voice XP" : "Text XP";

    await interaction.deferReply();

    const entries = await getLeaderboard(interaction.guildId!);
    entries.sort((a, b) => b[sortBy] - a[sortBy]);

    const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    let currentPage = 0;

    const generateEmbed = (page: number) => {
      const embed = new EmbedBuilder()
        .setTitle(`🏆 Leaderboard — ${sortLabel}`)
        .setColor("Gold")
        .setFooter({ text: `Page ${page + 1} of ${totalPages}` });

      const start = page * PAGE_SIZE;
      const pageEntries = entries.slice(start, start + PAGE_SIZE);

      if (pageEntries.length === 0) {
        embed.setDescription("No XP recorded yet.");
        return embed;
      }

      const lines = pageEntries.map((entry, i) => {
        const rank = start + i + 1;
        return `**${rank}.** <@${entry.userId}> — **${Math.round(entry.voice).toLocaleString()}** Voice XP / **${Math.round(entry.text).toLocaleString()}** Text XP`;
      });

      embed.setDescription(lines.join("\n"));
      return embed;
    };

    const getActionRow = () =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("◀ Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next ▶")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage >= totalPages - 1)
      );

    await interaction.editReply({
      embeds: [generateEmbed(currentPage)],
      components: [getActionRow()],
    });

    const collector = (interaction.channel as any).createMessageComponentCollector({
      filter: (i: any) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      time: 60_000,
    });

    collector.on("collect", async (i: any) => {
      if (i.customId === "prev") currentPage--;
      if (i.customId === "next") currentPage++;

      await i.update({
        embeds: [generateEmbed(currentPage)],
        components: [getActionRow()],
      });
    });

    collector.on("end", async () => {
      const message = await interaction.fetchReply();
      if (message.editable) {
        message.edit({ components: [] }).catch(() => {});
      }
    });
  },
};
