import { env } from "./env.js";

export default {
  prefix: "?",
  owners: [
    "196606443703631874", // troshujin
    "265535215059861514", // piet323
  ],
  token: env.BOT_TOKEN,
  dataFolder: "./data",
  defaultSettings: {
    motd: "Purkachu is super cool!",
  },
};

console.log("[Config] Environment variables validated successfully.");
