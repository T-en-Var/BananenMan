import { Collection, Events, InteractionType, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, ButtonInteraction } from "discord.js";
import { soullinkHandleButton } from "../Commands/fun/soullink.js";
import { getRuns, loadRun } from "../Lib/files.js";
import { pokemonNamesAsChoices } from "../Lib/pokemon.js";
import { CustomInteractionHandler } from "../Lib/interaction.js";
import globalState from "../Base/state.js";

const cooldown = new Collection<string, number>();

export default {
  name: Events.InteractionCreate,

  async execute(interaction: ChatInputCommandInteraction | AutocompleteInteraction | ButtonInteraction) {
    if (interaction.isAutocomplete()) {
      await handleAutoComplete(interaction);
      return;
    }
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    const { client } = interaction;

    if (interaction.type === InteractionType.ApplicationCommand) {
      if (interaction.user.bot) {
        return;
      }

      try {
        const command = client.slashCommands.get(interaction.commandName);

        if (command) {
          const handler = new CustomInteractionHandler(client, interaction, command);
          const isOwner = await handler.checkIsOwner();
          const isAdmin = await handler.checkIsAdmin();

          if (command.ownerOnly && !isOwner) {
            return await interaction.reply({
              embeds: [new EmbedBuilder().setTitle("Only **bot owners** can use this command.").setTimestamp()],
              flags: "Ephemeral",
            });
          }

          if (command.adminOnly && !isOwner) {
            if (!interaction.guild) throw new Error("interaction.guild not defined");

            if (!isAdmin) {
              return await interaction.reply({
                embeds: [new EmbedBuilder().setTitle("Only **admins** can use this command.").setTimestamp()],
                flags: "Ephemeral",
              });
            }
          }

          if (command.cooldown) {
            const cooldownKey = `${(command.slashData as any).name}-${interaction.user.id}`;
            if (cooldown.has(cooldownKey)) {
              const nowDate = interaction.createdTimestamp;
              const waitedDate = cooldown.get(cooldownKey)! - nowDate;
              return interaction
                .reply({
                  content: `Cooldown is currently active, please try again <t:${Math.floor(new Date(nowDate + waitedDate).getTime() / 1000)}:R>.`,
                  flags: "Ephemeral",
                })
                .then(() =>
                  setTimeout(
                    () => interaction.deleteReply(),
                    cooldown.get(cooldownKey)! - Date.now() + 1000
                  )
                );
            }

            cooldown.set(cooldownKey, Date.now() + command.cooldown);

            setTimeout(() => {
              cooldown.delete(cooldownKey);
            }, command.cooldown + 1000);
          }

          await handler.execute();
        }
      } catch (e) {
        console.error(e);
        interaction.reply({
          content: "An error occurred while executing the command! Please try again.",
          flags: "Ephemeral",
        });
      }
    }
  },
};

async function handleAutoComplete(interaction: AutocompleteInteraction) {
  const focusedOption = interaction.options.getFocused(true); // returns { name, value }
  const query = focusedOption?.value ?? "";

  if (focusedOption.name === "command") {
    const allCommands = [...interaction.client.slashCommands.keys()];
    const filtered = allCommands
      .filter((f) => f.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(filtered.map((f) => ({ name: f, value: f })));
  }

  if (focusedOption.name === "location") {
    const runname = interaction.options.getString("runname");
    if (runname) {
      const run = await loadRun(runname);
      if (run) {
        const choices = [...new Set(run.encounters.map((e) => e.location))];
        const filtered = choices
          .filter((f) => f.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 25);

        await interaction.respond(filtered.map((f) => ({ name: f, value: f })));
      }
    }
  }

  if (focusedOption.name === "nickname" || focusedOption.name === "newnickname") {
    const runname = interaction.options.getString("runname");
    if (runname) {
      const run = await loadRun(runname);
      if (run) {
        let choices = [...new Set(run.encounters.map((e) => e.nickname))];

        if (focusedOption.name === "newnickname") {
          const nickname = interaction.options.getString("nickname");
          choices = choices.filter((n) => n !== nickname);
        }

        const filtered = choices
          .filter((f) => f.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 25);

        await interaction.respond(filtered.map((f) => ({ name: f, value: f })));
      }
    }
  }

  if (focusedOption.name === "runname") {
    const choices = await getRuns();

    const filtered = choices
      .filter((f) => f.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(filtered.map((f) => ({ name: f, value: f })));
  }

  if (focusedOption.name === "pokemon") {
    const choices = await pokemonNamesAsChoices();
    const filtered = choices
      .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(filtered.map((p) => ({ name: p.name, value: p.name })));
  }

  if (focusedOption.name === "message") {
    const channel = interaction.channel as any;
    const query = focusedOption.value.toLowerCase();

    const cacheKey = `audioMsgs_${channel.id}`;
    let messages = globalState.getCache(cacheKey);

    // Cache miss → fetch once
    if (!messages) {
      await interaction.respond([{ name: "start typing...", value: "start typing" }]);
      console.log(`[AutoComplete] Cache miss for #${channel.name}`);
      messages = [];

      // Then fetch in background to populate cache
      const stateKey = `isFetchingMessages_${channel.name}`;
      (async () => {
        if (globalState.getState(stateKey)) return;
        globalState.setState(stateKey, true);

        let lastMessageId;
        const fetchedMessages: any[] = [];

        while (true) {
          if (!globalState.isActive) break;
          const options: any = { limit: 100 };
          if (lastMessageId) options.before = lastMessageId;

          const fetched = await channel.messages.fetch(options);
          if (fetched.size === 0) break;

          fetchedMessages.push(...fetched.values());
          lastMessageId = fetched.last().id;

          if (fetchedMessages.length >= 500) break;
        }

        globalState.setCache(cacheKey, fetchedMessages, 2 * 60 * 1000);
        globalState.removeState(stateKey);
      })();
      return;
    }
    console.log(`[AutoComplete] Filtering messages`);

    const audioMessages = messages
      .filter((m: any) => m.attachments.some((a: any) => a.contentType?.startsWith("audio/")))
      .map((m: any) => ({
        name: (m.content?.slice(0, 50) || aName(m)) || `Audio by ${m.author.username}`,
        value: m.id,
      }));

    const filtered = audioMessages
      .filter((c: any) => c.name.toLowerCase().includes(query))
      .slice(0, 25);

    await interaction.respond(filtered);

    function aName(m: any) {
      const first = m.attachments.first();
      return first ? first.name : "Unknown";
    }
  }
}

async function handleButton(interaction: ButtonInteraction) {
  const buttonMetaData = interaction.customId.split("_");

  switch (buttonMetaData[0]) {
    case "soullink":
      return await soullinkHandleButton(interaction as any);

    // You can also re-use the previous embed and just modify its description if needed.
  }
}
