import { Client, GatewayIntentBits, Partials } from "discord.js";
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import config from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class BaseClient {
  client!: Client;
  token: string | undefined;

  constructor(token: string | undefined) {
    this.createClient();
    this.token = token;
  }

  createClient() {
    this.client = new Client({
      intents: Object.values(GatewayIntentBits) as number[],
      partials: Object.values(Partials) as number[],
      shards: "auto",
    });
  }

  loadHandlers() {
    const handlersDir = path.join(__dirname, "../Handlers");
    readdirSync(handlersDir)
      .filter((f) => f.endsWith(".js") || f.endsWith(".ts"))
      .forEach(async (file) => {
      const handlerFile = await import(pathToFileURL(path.join(handlersDir, file)).href);
      const handler = handlerFile.default;
      await handler.execute(this.client);
    });
  }

  async start() {
    this.loadHandlers();
    await this.client.login(this.token);
  }

  async reconnect() {
    this.client.logger.info(`${this.client.user!.username} RESTARTING!`);
    await this.client.destroy();
    this.createClient();
    await this.start();
    this.client.logger.info(`${this.client.user!.username} RESTARTED!`);
  }
}

const token = config.token;
export const botClient = new BaseClient(token);
botClient.start();
