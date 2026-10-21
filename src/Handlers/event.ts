import { Client } from "discord.js";
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  async execute(client: Client) {
    const eventsDir = path.join(__dirname, "../Events");
    const eventFiles = readdirSync(eventsDir).filter((f) => f.endsWith(".js") || f.endsWith(".ts"));

    Promise.all(
      eventFiles.map(async (file) => {
        const event = await import(pathToFileURL(path.join(eventsDir, file)).href).then((x) => x.default);
        console.log(`[EventLoader] Event ${file}.`);

        if (event.once) {
          client.once(event.name, (...args: any[]) => event.execute(...args));
        } else {
          client.on(event.name, (...args: any[]) => event.execute(...args));
        }
      }),
    );
  },
};
