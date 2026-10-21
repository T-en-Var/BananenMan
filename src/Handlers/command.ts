import { Client, Collection } from "discord.js";
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  async execute(client: Client) {
    client.commands = new Collection();
    client.slashCommands = new Collection();
    client.slashDatas = [];

    // - Handlers -
    const commandsDir = path.join(__dirname, "../Commands");
    const commandFolders = readdirSync(commandsDir);

    await Promise.all(
      commandFolders.map(async (category) => {
        const categoryDir = path.join(commandsDir, category);
        const commandFiles = readdirSync(categoryDir).filter((f) => f.endsWith(".js") || f.endsWith(".ts"));

        await Promise.all(
          commandFiles.map(async (file) => {
            const commands = await import(pathToFileURL(path.join(categoryDir, file)).href);

            if (commands) {
              if (commands.commandBase && commands.commandBase.slashData) {
                // Slash Command
                const slashCommand = commands.commandBase;
                client.slashDatas.push(slashCommand.slashData.toJSON());
                client.slashCommands.set(
                  slashCommand.slashData.name,
                  slashCommand
                );
                console.log(`[CommandLoader] Loaded slash command: ${slashCommand.slashData.name}`);
              }
            }
          })
        );
      })
    );
  },
};
