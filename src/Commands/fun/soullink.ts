import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
} from "discord.js";
import path from "path";
import { capitalize } from "../../Lib/utils.js";
import { saveRun, loadRun, getRuns, getFilePath, soullinkDataFolder } from "../../Lib/files.js";
import { getNextEvolution } from "../../Lib/pokemon.js";
import { generateBoxImageFromGroups, singlePokemonGroup } from "../../Lib/image.js";
import type { CommandBase, Run, Encounter } from "../../Lib/types.js";
import { CustomInteractionHandler } from "../../Lib/interaction.js";

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
    EDIT: "edit",
  },
  INFO_SUBCOMMANDS: {
    SHOW: "view",
    LIST: "all",
    POKEMON: "pokemon",
    FILE: "file",
  },
  MOVE_TO_TYPES: ["box", "team", "defeated"],
  ALL_TYPES: ["box", "team", "defeated", "missed"],
};

export const commandBase: CommandBase = {
  slashData: new SlashCommandBuilder()
    .setName(SOULLINK.NAME)
    .setDescription("Pokemon Soullink!")
    .addSubcommandGroup((group) =>
      group
        .setName(SOULLINK.SUBCOMMAND_GROUPS.RUN)
        .setDescription("Run-related commands")
        .addSubcommand((sub) =>
          sub
            .setName(SOULLINK.RUN_SUBCOMMANDS.CREATE)
            .setDescription("Create a new soullink run")
            .addStringOption((opt) =>
              opt.setName("runname").setDescription("Name of the run").setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName(SOULLINK.RUN_SUBCOMMANDS.JOIN)
            .setDescription("Join an open soullink run")
            .addStringOption((opt) =>
              opt
                .setName("runname")
                .setDescription("Name of the run")
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName(SOULLINK.RUN_SUBCOMMANDS.START)
            .setDescription("Start the run and lock further joins")
            .addStringOption((opt) =>
              opt
                .setName("runname")
                .setDescription("Name of the run")
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName(SOULLINK.SUBCOMMAND_GROUPS.UI).setDescription("Open an interactive UI to apply all actions.")
    )
    .addSubcommandGroup((group) =>
      group
        .setName(SOULLINK.SUBCOMMAND_GROUPS.EDIT)
        .setDescription("Encounter-related commands")
        .addSubcommand((sub) =>
          sub
            .setName(SOULLINK.EDIT_SUBCOMMANDS.ADD)
            .setDescription("Add an encounter to a run")
            .addStringOption((opt) =>
              opt.setName("runname").setDescription("Run name").setRequired(true).setAutocomplete(true)
            )
            .addStringOption((opt) =>
              opt.setName("location").setDescription("Location info").setRequired(true).setAutocomplete(true)
            )
            .addStringOption((opt) =>
              opt.setName("pokemon").setDescription("Encountered Pokémon").setRequired(true).setAutocomplete(true)
            )
            .addBooleanOption((opt) => opt.setName("captured").setDescription("Captured or not").setRequired(true))
            .addStringOption((opt) =>
              opt.setName("nickname").setDescription("Encounter nickname, required if captured.").setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName(SOULLINK.EDIT_SUBCOMMANDS.MOVE)
            .setDescription("Move encounter")
            .addStringOption((opt) =>
              opt.setName("runname").setDescription("Run name").setRequired(true).setAutocomplete(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("location")
                .setDescription("The location where you moved the pokemon (where you are right now).")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((opt) =>
              opt.setName("nickname").setDescription("The pokemon to be moved.").setRequired(true).setAutocomplete(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("to")
                .setDescription("Where to move it")
                .addChoices(
                  { name: "box", value: "box" },
                  { name: "team", value: "team" },
                  { name: "defeated", value: "defeated" }
                )
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt.setName("reason").setDescription("Reason for moving (required for defeated)").setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName(SOULLINK.EDIT_SUBCOMMANDS.EVOLVE)
            .setDescription("Evolve a Pokémon in a run")
            .addStringOption((opt) =>
              opt.setName("runname").setDescription("Run name").setRequired(true).setAutocomplete(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("location")
                .setDescription("Location where the Pokémon has evolved")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("nickname")
                .setDescription("The nickname of the pokemon you want to evolve")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((opt) =>
              opt.setName("pokemon").setDescription("The new Pokemon").setRequired(false).setAutocomplete(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName(SOULLINK.EDIT_SUBCOMMANDS.EDIT)
            .setDescription("Edit encounter")
            .addStringOption((opt) =>
              opt.setName("runname").setDescription("Run name").setRequired(true).setAutocomplete(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("nickname")
                .setDescription("The pokemon to be edited.")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addUserOption((opt) =>
              opt.setName("player").setDescription("The player whose pokemon needs to be edited.").setRequired(false)
            )
            .addStringOption((opt) =>
              opt
                .setName("location")
                .setDescription("Where the pokemon was caught.")
                .setRequired(false)
                .setAutocomplete(true)
            )
            .addStringOption((opt) =>
              opt.setName("pokemon").setDescription("Encountered Pokémon.").setRequired(false).setAutocomplete(true)
            )
            .addBooleanOption((opt) => opt.setName("captured").setDescription("Captured or not").setRequired(false))
            .addStringOption((opt) =>
              opt.setName("newnickname").setDescription("New nickname").setRequired(false).setAutocomplete(true)
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName(SOULLINK.SUBCOMMAND_GROUPS.INFO)
        .setDescription("View run overview")
        .addSubcommand((sub) =>
          sub
            .setName(SOULLINK.INFO_SUBCOMMANDS.SHOW)
            .setDescription("Show overview of a run")
            .addStringOption((opt) =>
              opt.setName("runname").setDescription("Run name").setRequired(true).setAutocomplete(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("type")
                .setDescription("Filter by type")
                .addChoices(
                  { name: "box", value: "box" },
                  { name: "team", value: "team" },
                  { name: "defeated", value: "defeated" }
                )
                .setRequired(false)
            )
        )
        .addSubcommand((sub) => sub.setName(SOULLINK.INFO_SUBCOMMANDS.LIST).setDescription("List all soullink runs"))
        .addSubcommand((sub) =>
          sub
            .setName(SOULLINK.INFO_SUBCOMMANDS.FILE)
            .setDescription("Get the full run file")
            .addStringOption((opt) =>
              opt.setName("runname").setDescription("Run name").setRequired(true).setAutocomplete(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName(SOULLINK.INFO_SUBCOMMANDS.POKEMON)
            .setDescription("Get info on a specific Pokémon")
            .addStringOption((opt) =>
              opt.setName("runname").setDescription("Run name").setRequired(true).setAutocomplete(true)
            )
            .addStringOption((opt) =>
              opt.setName("nickname").setDescription("Pokémon nickname").setRequired(true).setAutocomplete(true)
            )
        )
    ),

  cooldown: 1000,
  adminOnly: false,
  async prefixRun(client: any, message: any) {
    message.reply("Use the slash command");
  },

  async slashRun(handler: CustomInteractionHandler) {
    const interaction = handler.interaction;
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    switch (group) {
      case SOULLINK.SUBCOMMAND_GROUPS.RUN:
        if (sub === SOULLINK.RUN_SUBCOMMANDS.START) {
          const runname = interaction.options.getString("runname")!;
          const run = await requireAuthorizedPlayer(runname, interaction, true);
          if (!run) return;

          return await handleStartRun(interaction, run);
        }

        if (sub === SOULLINK.RUN_SUBCOMMANDS.JOIN) return await handleJoinRun(interaction);

        if (sub === SOULLINK.RUN_SUBCOMMANDS.CREATE) return await handleCreateRun(interaction);

      case SOULLINK.SUBCOMMAND_GROUPS.EDIT:
        const runname = interaction.options.getString("runname")!;
        const run = await requireAuthorizedPlayer(runname, interaction);
        if (!run) return;

        if (sub === SOULLINK.EDIT_SUBCOMMANDS.ADD) return await handleAddEncounter(interaction, run);

        if (sub === SOULLINK.EDIT_SUBCOMMANDS.MOVE) return await handleMoveEncounter(interaction, run);

        if (sub === SOULLINK.EDIT_SUBCOMMANDS.EVOLVE) return await handleEvolveEncounter(interaction, run);

        if (sub === SOULLINK.EDIT_SUBCOMMANDS.EDIT) return await handleEditPokemon(interaction, run);

      case SOULLINK.SUBCOMMAND_GROUPS.INFO:
        if (sub === SOULLINK.INFO_SUBCOMMANDS.SHOW) return await handleOverview(interaction);

        if (sub === SOULLINK.INFO_SUBCOMMANDS.LIST) return await handleListRuns(interaction);

        if (sub === SOULLINK.INFO_SUBCOMMANDS.FILE) return await handleGetFile(interaction);

        if (sub === SOULLINK.INFO_SUBCOMMANDS.POKEMON) return await handleViewPokemon(interaction);

      default:
        if (sub === SOULLINK.SUBCOMMAND_GROUPS.UI) {
          return await handleUI(interaction);
        }

        const unknownEmbed = new EmbedBuilder().setColor("Red").setDescription("❌ Unknown command group or subcommand.");
        return await interaction.reply({ embeds: [unknownEmbed], flags: "Ephemeral" });
    }
  },
};

// End

// --------------------------------------------------------- //
//     ______                     __   _                     //
//    / ____/__  __ ____   _____ / /_ (_)____   ____   _____ //
//   / /_   / / / // __ \ / ___// __// // __ \ / __ \ / ___/ //
//  / __/  / /_/ // / / // /__ / /_ / // /_/ // / / /(__  )  //
// /_/     \__,_//_/ /_/ \___/ \__//_/ \____//_/ /_//____/   //
//                                                           //
// --------------------------------------------------------- //

async function handleUI(interaction: any) {
  const runName = "Hello";

  // Fake data — in real use, you'd pull from a DB
  const fakePlayerData = {
    team: ["Charmander", "Pidgey", "Rattata"],
  };

  const embed = new EmbedBuilder()
    .setTitle(`Your Team in "${runName}"`)
    .setDescription(fakePlayerData.team.join("\n"))
    .setColor(0x00ae86);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`soullink_${SOULLINK.EDIT_SUBCOMMANDS.ADD}_${runName}`)
      .setLabel("Add Encounter")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`soullink_${SOULLINK.EDIT_SUBCOMMANDS.MOVE}_${runName}`)
      .setLabel("Move Pokémon")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`soullink_${SOULLINK.EDIT_SUBCOMMANDS.EVOLVE}_${runName}`)
      .setLabel("Evolve Pokémon")
      .setStyle(ButtonStyle.Success)
  );

  await interaction.reply({ embeds: [embed], components: [row], flags: "Ephemeral" });
}

export async function soullinkHandleButton(interaction: any) {
  const buttonMetaData = interaction.customId.split("_");
  const action = buttonMetaData[1];

  switch (action) {
    case SOULLINK.EDIT_SUBCOMMANDS.ADD:
      return await handleAddEncounterButton(interaction);

    case SOULLINK.EDIT_SUBCOMMANDS.MOVE:
      return;

    case SOULLINK.EDIT_SUBCOMMANDS.EVOLVE:
      return;

    default:
      break;
  }
}

async function handleAddEncounterButton(interaction: any) {
  const modal = new ModalBuilder().setCustomId("add_encounter_modal").setTitle("Add a New Encounter");

  const pokemonName = new TextInputBuilder()
    .setCustomId("pokemon_name")
    .setLabel("Pokémon Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const location = new TextInputBuilder()
    .setCustomId("location")
    .setLabel("Encounter Location")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(pokemonName);
  const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(location);

  modal.addComponents(row1, row2);

  await interaction.showModal(modal);
}

// End

// ------------------------ //
//     ______     __ _  __  //
//    / ____/____/ /(_)/ /_ //
//   / __/  / __  // // __/ //
//  / /___ / /_/ // // /_   //
// /_____/ \__,_//_/ \__/   //
//                          //
// ------------------------ //

async function handleAddEncounter(interaction: any, run: Run) {
  if (!run.started) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`ℹ️ Run '${run.runname}' has not yet started.`)],
      flags: "Ephemeral",
    });
  }

  const location = interaction.options.getString("location");
  const pokemon = interaction.options.getString("pokemon");
  const captured = interaction.options.getBoolean("captured");
  const nickname = interaction.options.getString("nickname") || "";
  const player = interaction.user.globalName;

  if (captured && !nickname) {
    const errorEmbed = new EmbedBuilder().setColor("Red").setDescription(`❌ Must include nickname.`);
    return await interaction.reply({ embeds: [errorEmbed], flags: "Ephemeral" });
  }

  const exists = run.encounters.find((e) => e.location === location && e.playerId === interaction.user.id);

  if (exists) {
    const errorEmbed = new EmbedBuilder().setColor("Red").setDescription(`❌ You already have an encounter here.`);
    return await interaction.reply({ embeds: [errorEmbed], flags: "Ephemeral" });
  }

  const usedNicknames = run.encounters.filter((e) => e.nickname === nickname && e.playerId === interaction.user.id);

  if (usedNicknames.length > 0) {
    const errorEmbed = new EmbedBuilder().setColor("Red").setDescription(`❌ Nickname already used.`);
    return await interaction.reply({ embeds: [errorEmbed], flags: "Ephemeral" });
  }

  const encounter: Encounter = {
    id: run.encounterCounter++,
    playerId: interaction.user.id,
    playerName: player,
    location: location,
    status: "box",
    reason: "",
    pokemon: pokemon,
    captured: captured,
    nickname: nickname,
    history: [],
  };

  run.encounters.push(encounter);
  await saveRun(run.runname, run);

  const successEmbed = new EmbedBuilder()
    .setColor("Blue")
    .setTitle("Encounter Added")
    .setDescription(`✅ Added encounter for **${player}** to run **${run.runname}** on location **${location}**.`)
    .addFields(
      { name: "Pokémon", value: String(pokemon), inline: true },
      { name: "Nickname", value: nickname ? String(nickname) : "_None_", inline: true },
      { name: "Captured", value: String(captured), inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [successEmbed] });
}

async function handleMoveEncounter(interaction: any, run: Run) {
  if (!run.started) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`ℹ️ Run '${run.runname}' has not yet started.`)],
      flags: "Ephemeral",
    });
  }

  const location = interaction.options.getString("location");
  const nickname = interaction.options.getString("nickname");
  const to = interaction.options.getString("to");
  const reason = interaction.options.getString("reason") || "";

  if (!SOULLINK.MOVE_TO_TYPES.includes(to)) {
    const errorEmbed = new EmbedBuilder()
      .setColor("Red")
      .setDescription(`❌ Invalid destination. Must be one of: ${SOULLINK.MOVE_TO_TYPES.join(", ")}.`);
    return await interaction.reply({ embeds: [errorEmbed], flags: "Ephemeral" });
  }

  const encounters = run.encounters.filter((e) => e.nickname === nickname);
  if (encounters.length === 0) {
    const infoEmbed = new EmbedBuilder()
      .setColor("Yellow")
      .setDescription(`ℹ️ No encounters found for nickname **${nickname}** in run **${run.runname}**.`);
    return await interaction.reply({ embeds: [infoEmbed], flags: "Ephemeral" });
  }

  for (const encounter of encounters) {
    encounter.history.push({
      type: "location",
      oldValue: encounter.status,
      newValue: to,
      location: location,
      createdOn: Date.now(),
    });

    encounter.status = to;
    encounter.reason = to === "defeated" ? reason : "";
  }

  await saveRun(run.runname, run);

  const successEmbed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("Encounter(s) Updated")
    .setDescription(
      `✅ Moved ${encounters.length} encounter(s) at **${location}** to **${capitalize(to)}**${to === "defeated" && reason ? ` with reason: _${reason}_` : ""}.`
    )
    .setTimestamp();

  return await interaction.reply({ embeds: [successEmbed] });
}

async function handleEvolveEncounter(interaction: any, run: Run) {
  if (!run.started) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`ℹ️ Run '${run.runname}' has not yet started.`)],
      flags: "Ephemeral",
    });
  }

  const location = interaction.options.getString("location");
  const nickname = interaction.options.getString("nickname");
  let newSpecies = interaction.options.getString("pokemon");
  const player = interaction.user.globalName;

  const encounter = run.encounters.find((e) => e.nickname === nickname && e.playerId === interaction.user.id);

  if (!encounter) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ No encounter found for **${player}** on location **${location}**.`)],
      flags: "Ephemeral",
    });
  }

  const oldSpecies = encounter.pokemon;
  if (!newSpecies) {
    newSpecies = await getNextEvolution(oldSpecies);
    if (!newSpecies) {
      return await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setDescription(`❌ Couldn't auto evolve **${capitalize(oldSpecies)}**. Please manually provide a pokemon.`),
        ],
        flags: "Ephemeral",
      });
    }
  }
  encounter.pokemon = newSpecies;
  encounter.history.push({
    type: "pokemon",
    oldValue: oldSpecies,
    newValue: newSpecies,
    location: location,
    createdOn: Date.now(),
  });

  await saveRun(run.runname, run);

  return await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("Green")
        .setTitle("✨ Evolution Successful")
        .setDescription(
          `✅ **${encounter.nickname}** (${capitalize(oldSpecies)}) has evolved into **${capitalize(newSpecies)}** for **${player}** on location **${location}**.`
        )
        .setTimestamp(),
    ],
  });
}

async function handleEditPokemon(interaction: any, run: Run) {
  const nickname = interaction.options.getString("nickname");
  const player = interaction.options.getUser("player");

  const location = interaction.options.getString("location");
  const pokemon = interaction.options.getString("pokemon");
  const captured = interaction.options.getBoolean("captured");
  const newnickname = interaction.options.getString("newnickname");

  const encounters = run.encounters.filter(
    (e) => e.nickname?.toLowerCase() === nickname.toLowerCase() && (!player || e.playerId === player.id)
  );
  if (encounters.length == 0) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ No Pokémon found with nickname **${nickname}**.`)],
      flags: "Ephemeral",
    });
  }

  // await interaction.deferReply();

  for (const e of encounters) {
    if (location !== null) e.location = location;
    if (pokemon !== null) e.pokemon = pokemon;
    if (captured !== null) e.captured = captured;
    if (newnickname !== null) e.nickname = newnickname;
  }

  await saveRun(run.runname, run);
  await handleViewPokemon(interaction, { nickname: newnickname });
}

// End

// ------------------------- //
//     ____        ____      //
//    /  _/____   / __/____  //
//    / / / __ \ / /_ / __ \ //
//  _/ / / / / // __// /_/ / //
// /___//_/ /_//_/   \____/  //
//                           //
// ------------------------- //

async function handleOverview(interaction: any) {
  const runname = interaction.options.getString("runname");
  const filterType = interaction.options.getString("type");

  const run = await loadRun(runname);
  if (!run) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ Run '${runname}' not found.`)],
      flags: "Ephemeral",
    });
  }

  let encounters = run.encounters;
  if (filterType) {
    if (!SOULLINK.MOVE_TO_TYPES.includes(filterType)) {
      return await interaction.reply({
        embeds: [
          new EmbedBuilder().setColor("Red").setDescription(`❌ Invalid type filter. Must be one of: \`${SOULLINK.MOVE_TO_TYPES.join(", ")}\`.`),
        ],
        flags: "Ephemeral",
      });
    }
    encounters = encounters.filter((e) => e.status === filterType);
  }

  if (encounters.length === 0) {
    return await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("Yellow")
          .setDescription(`ℹ️ No encounters found${filterType ? ` in **${capitalize(filterType)}**` : ""} for run **${runname}**.`),
      ],
    });
  }

  await interaction.deferReply();

  const groupedByLocation: Record<string, any> = {};
  for (const e of encounters) {
    if (!groupedByLocation[e.location]) {
      groupedByLocation[e.location] = {
        location: e.location,
        status: e.status,
        reason: e.reason,
        nickname: e.nickname,
        encounters: [],
      };
    }
    groupedByLocation[e.location].encounters.push({
      id: e.id,
      player: e.playerName,
      pokemon: e.pokemon,
      captured: e.captured,
    });
  }

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
  const statusesToShow = filterType ? [filterType] : SOULLINK.ALL_TYPES;
  const groupedByStatus: Record<string, any[]> = { box: [], team: [], defeated: [], missed: [] };
  for (const e of Object.values(groupedByLocation)) {
    groupedByStatus[(e as any).status].push(e);
  }

  const embeds: EmbedBuilder[] = [];
  const attachments: AttachmentBuilder[] = [];

  let id = 1;
  for (const status of statusesToShow) {
    const encounters = groupedByStatus[status];
    const tempId = id++;

    if (encounters.length == 0) continue;

    // Generate image buffer
    let imageBuffer;
    try {
      imageBuffer = await generateBoxImageFromGroups(encounters);
    } catch (error) {
      await interaction.editReply({
        content: `I got an error :( ${error}`,
      });
      return;
    }

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, { name: `img${tempId}.png` });

    // Embed referencing the attachment
    const embed = new EmbedBuilder()
      .setTitle(titles[status])
      .setColor(colors[status] as any)
      .setImage(`attachment://img${tempId}.png`);

    embeds.push(embed);
    attachments.push(attachment);
  }

  await interaction.editReply({
    embeds: embeds,
    files: attachments,
  });
}

async function handleListRuns(interaction: any) {
  try {
    const runFiles = await getRuns();

    if (runFiles.length === 0) {
      const noRunsEmbed = new EmbedBuilder().setColor("Yellow").setDescription("ℹ️ No soullink runs found.");
      return await interaction.reply({ embeds: [noRunsEmbed] });
    }

    const runs: Run[] = [];
    for (const file of runFiles) {
      const runname = path.basename(file, ".json");
      const run = await loadRun(runname);
      if (run) {
        runs.push(run);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("📋 All Soullink Runs")
      .setColor("Blue")
      .setDescription(`Found **${runs.length}** run(s):`)
      .setTimestamp();

    for (const run of runs) {
      const nameTxt = run.started
        ? `${run.runname} - Started on ${new Date(run.startedOn!).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`
        : `${run.runname} - Run has not started.`;
      embed.addFields({
        name: nameTxt,
        value: `Players: ${run.players.map((p) => p.username).join(", ")}`,
        inline: false,
      });
    }

    return await interaction.reply({ embeds: [embed] });
  } catch (err: any) {
    const errorEmbed = new EmbedBuilder().setColor("Red").setDescription(`❌ Error loading runs: ${err.message}`);
    return await interaction.reply({ embeds: [errorEmbed], flags: "Ephemeral" });
  }
}

function formatEncounter(encounter: Encounter): string {
  const { pokemon, nickname, history } = encounter;

  const lines: string[] = [];

  lines.push(`${nickname} (${capitalize(pokemon)})`);
  lines.push(``);
  lines.push(`**History**`);
  const emoji: Record<string, string> = { box: "📦", team: "🧢", defeated: "💀", missed: "❌" };

  for (const hist of history) {
    const date = new Date(hist.createdOn).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const text =
      hist.type == "location"
        ? `${emoji[hist.oldValue]} ➡️ ${emoji[hist.newValue]} Moved to ${capitalize(hist.newValue)} (${hist.location} on ${date})`
        : `✨ ➡️ Evolved into ${capitalize(hist.newValue)} (${hist.location} on ${date})`;
    lines.push(text);
  }

  return lines.join("\n");
}

async function handleGetFile(interaction: any) {
  const runname = interaction.options.getString("runname");

  const run = await loadRun(runname);
  if (!run) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ Run '${runname}' not found.`)],
      flags: "Ephemeral",
    });
  }

  const filePath = getFilePath(runname, soullinkDataFolder);
  const file = new AttachmentBuilder(filePath);

  const embed = new EmbedBuilder().setTitle(`🧭 Full run data: ${runname}`);

  return interaction.reply({ embeds: [embed], files: [file] });
}

async function handleViewPokemon(interaction: any, options: { nickname?: string } = {}) {
  const runname = interaction.options.getString("runname");
  const nickname = options.nickname ?? interaction.options.getString("nickname");

  const run = await loadRun(runname);
  if (!run) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ Run '${runname}' not found.`)],
      flags: "Ephemeral",
    });
  }

  const encounters = run.encounters.filter((e) => e.nickname?.toLowerCase() === nickname.toLowerCase());
  if (encounters.length == 0) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ No Pokémon found with nickname **${nickname}**.`)],
      flags: "Ephemeral",
    });
  }

  await interaction.deferReply();
  await replyWithPokemonInfo(interaction, encounters, nickname);
}

// End

// ---------------------- //
//     ____               //
//    / __ \ __  __ ____  //
//   / /_/ // / / // __ \ //
//  / _, _// /_/ // / / / //
// /_/ |_| \__,_//_/ /_/  //
//                        //
// ---------------------- //

async function handleCreateRun(interaction: any) {
  const runname = interaction.options.getString("runname");
  const existing = await loadRun(runname);

  if (existing) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ Run '${runname}' already exists.`)],
      flags: "Ephemeral",
    });
  }

  const run: Run = {
    runname,
    players: [
      {
        id: interaction.user.id,
        username: interaction.user.globalName,
      },
    ],
    encounters: [],
    encounterCounter: 1,
    started: false,
  };

  await saveRun(runname, run);

  return await interaction.reply({
    embeds: [new EmbedBuilder().setColor("Green").setDescription(`✅ Run '${runname}' created. Others can now join.`)],
  });
}

async function handleJoinRun(interaction: any) {
  const runname = interaction.options.getString("runname");
  const run = await loadRun(runname);

  if (!run) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ Run '${runname}' does not exist.`)],
      flags: "Ephemeral",
    });
  }

  if (run.started) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`🚫 Run '${runname}' has already started.`)],
      flags: "Ephemeral",
    });
  }

  const userId = interaction.user.id;
  const username = interaction.user.globalName;

  if (run.players.find((p) => p.id === userId)) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Yellow").setDescription(`ℹ️ You already joined '${runname}'.`)],
      flags: "Ephemeral",
    });
  }

  run.players.push({ id: userId, username });
  await saveRun(runname, run);

  return await interaction.reply({
    embeds: [new EmbedBuilder().setColor("Green").setDescription(`✅ You joined '${runname}' as ${username}.`)],
  });
}

async function handleStartRun(interaction: any, run: Run) {
  if (run.started) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Yellow").setDescription(`ℹ️ Run '${run.runname}' is already started.`)],
      flags: "Ephemeral",
    });
  }

  if (run.players.length === 0) {
    return await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ Cannot start.No players joined yet.`)],
      flags: "Ephemeral",
    });
  }

  run.started = true;
  run.startedOn = Date.now();
  await saveRun(run.runname, run);

  return await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("Green")
        .setTitle(`🚀 Run '${run.runname}' Started!`)
        .setDescription("No more players can join.")
        .addFields({
          name: "Players",
          value: run.players.map((p) => p.username).join(", "),
        }),
    ],
  });
}

async function requireAuthorizedPlayer(runname: string, interaction: any, bypassNotStarted = false): Promise<Run | null> {
  const run = await loadRun(runname);
  const userId = interaction.user.id;

  if (!run) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ Run '${runname}' does not exist.`)],
      flags: "Ephemeral",
    });
    return null;
  }

  if (!run.started && !bypassNotStarted) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`🚫 Run '${runname}' hasn't started yet.`)],
      flags: "Ephemeral",
    });
    return null;
  }

  const isPlayer = run.players.some((p) => p.id === userId);
  if (!isPlayer) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ You are not a participant in '${runname}'.`)],
      flags: "Ephemeral",
    });
    return null;
  }

  return run;
}

// End

// ------------------------------------- //
//     __  __       __                   //
//    / / / /___   / /____   ___   _____ //
//   / /_/ // _ \ / // __ \ / _ \ / ___/ //
//  / __  //  __// // /_/ //  __// /     //
// /_/ /_/ \___//_// .___/ \___//_/      //
//                /_/                    //
// ------------------------------------- //

async function replyWithPokemonInfo(interaction: any, encounters: Encounter[], nickname: string) {
  let groupedEncounter: any = {};
  for (const e of encounters) {
    if (!groupedEncounter.location) {
      groupedEncounter = {
        location: e.location,
        status: e.status,
        reason: e.reason,
        nickname: e.nickname,
        encounters: [],
      };
    }
    groupedEncounter.encounters.push({
      id: e.id,
      player: e.playerName,
      pokemon: e.pokemon,
      captured: e.captured,
    });
  }

  // Generate image buffer
  let imageBuffer;
  try {
    imageBuffer = await singlePokemonGroup(groupedEncounter);
  } catch (error) {
    await interaction.editReply({
      content: `I got an error :( ${error}`,
    });
    throw error;
  }

  // Create attachment
  const attachment = new AttachmentBuilder(imageBuffer, { name: `img.png` });

  // Embed referencing the attachment
  const embed = new EmbedBuilder()
    .setTitle(`🔍 Pokémon Overview: ${nickname}`)
    .setColor("Blue")
    .setImage(`attachment://img.png`);

  for (const enc of encounters) {
    embed.addFields({
      name: `${enc.playerName}'s Pokemon`,
      value: formatEncounter(enc),
      inline: true,
    });
  }

  return interaction.editReply({ embeds: [embed], files: [attachment] });
}
