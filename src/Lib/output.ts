import { EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { ansiColors } from "./values.js";
import { capitalize } from "./utils.js";
import type { Run } from "./types.js";

const SOULLINK = {
  NAME: "soullink",
  SUBCOMMAND_GROUPS: {
    RUN: "run",
    EDIT: "actions",
    INFO: "info",
    UI: "ui",
  },
  RUN_SUBCOMMANDS: {
    CREATE: "create",
    JOIN: "join",
    START: "start",
  },
  EDIT_SUBCOMMANDS: {
    ADD: "encounter",
    MOVE: "move",
    EVOLVE: "evolve",
  },
  INFO_SUBCOMMANDS: {
    SHOW: "view",
    LIST: "all",
    POKEMON: "pokemon",
    ROUTE: "route",
  },
  MOVE_TO_TYPES: ["box", "team", "defeated"],
  ALL_TYPES: ["box", "team", "defeated", "missed"],
};

export function buildOverviewEmbeds(run: Run, groupedByStatus: Record<string, any[]>, filterType: string | null) {
  const titles: Record<string, string> = {
    box: "📦 Pokémon in the box",
    team: "🧢 Pokémon on the team",
    defeated: "💀 Defeated Pokémon",
    missed: "❌ Missed encounters",
  };

  const colors: Record<string, string> = {
    box: "Blue",
    team: "Red",
    defeated: "Grey",
    missed: "DarkerGrey",
  };

  const embeds: EmbedBuilder[] = [];
  const players = run.players.map((p) => p.username);
  const statusesToShow = filterType ? [filterType] : SOULLINK.ALL_TYPES;

  const pkmnNameLen = Math.max(...run.encounters.map((enc) => enc.pokemon.length));
  const pkmnNickLen = Math.max(...run.encounters.map((enc) => enc.nickname.length));
  const MAX_EMBED_CHARS = 6000;

  for (const status of statusesToShow) {
    const locations = groupedByStatus[status];
    if (!locations.length) continue;

    let embed = new EmbedBuilder().setTitle(titles[status]).setColor(colors[status] as any);

    const headerLines = players.map((player) => `[ ${ansiColors.bold}${player.padEnd(pkmnNameLen + pkmnNickLen + 3)}${ansiColors.reset} ]`);
    const playerHeader = `\`\`\`ansi\n${headerLines.join(" - ")}\`\`\``;

    embed.addFields({ name: "Players", value: playerHeader });
    let embedCharCount = titles[status].length + playerHeader.length;

    for (const locationGroup of locations) {
      const locationTitle = `📍 ${locationGroup.location}${locationGroup.status === "defeated" ? ` - ${locationGroup.reason}` : ""}`;
      const fieldLines = players.map((player) => {
        const enc = locationGroup.encounters.find((e: any) => e.player === player);
        if (!enc) {
          return `[ ${ansiColors.default}${"Missing Pokémon".padEnd(pkmnNameLen + pkmnNickLen + 3)}${ansiColors.reset} ]`;
        }
        return `[ ${ansiColors.bold}${enc.nickname.padEnd(pkmnNickLen)}${ansiColors.reset} (${capitalize(enc.pokemon)}) ]`;
      });

      const value = `\`\`\`ansi\n${fieldLines.join(" - ")}\`\`\``;
      const fieldCharLength = locationTitle.length + value.length;

      if (embedCharCount + fieldCharLength > MAX_EMBED_CHARS || (embed.data.fields?.length ?? 0) >= 25) {
        embeds.push(embed);
        embed = new EmbedBuilder().setTitle(titles[status]).setColor(colors[status] as any);
        embedCharCount = 0;
      }

      embed.addFields({ name: locationTitle, value });
      embedCharCount += fieldCharLength;
    }

    embeds.push(embed);
  }

  // Final footer
  embeds.push(
    new EmbedBuilder()
      .setColor("DarkGold")
      .setTimestamp()
      .setFooter({ text: "Soullink overview powered by your BananenMan" })
  );

  return embeds;
}

export async function sendEmbedChunks(interaction: ChatInputCommandInteraction, embeds: EmbedBuilder[]) {
  const chunkSize = 10;
  for (let i = 0; i < embeds.length; i += chunkSize) {
    const chunk = embeds.slice(i, i + chunkSize);
    await interaction.followUp({ embeds: chunk });
  }
}
