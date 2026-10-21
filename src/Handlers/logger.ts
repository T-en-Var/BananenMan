import winston from "winston";
import { Client } from "discord.js";

export default {
  async execute(client: Client) {
    client.logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp({
          format: "DD-MM-YYYY HH:mm:ss",
        }),
        winston.format.printf(
          (info) => `[${info.timestamp}] ${info.level}: ${info.message}`,
        ),
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      ],
    });
  },
};
