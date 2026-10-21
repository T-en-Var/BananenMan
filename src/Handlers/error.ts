import { Client } from "discord.js";

export default {
  execute(client: Client) {
    console.log("[error.js] Calling the error execute.");
    const handleError = (type: string, error: any) => {
      console.error(`${type}: ${error.stack || error.message}`);
    };

    const processEvents = {
      unhandledRejection: "Unhandled promise rejection",
      uncaughtException: "Uncaught exception",
      uncaughtExceptionMonitor: "Uncaught exception monitored",
    };

    for (const [event, message] of Object.entries(processEvents)) {
      process.on(event as any, (error: any) => handleError(message, error));
    }
  },
};
