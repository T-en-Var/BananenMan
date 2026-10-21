import type { Collection } from "discord.js";
import type { CommandBase } from "../Lib/types.js";

declare module "discord.js" {
  interface Client {
    commands: Collection<string, CommandBase>;
    slashCommands: Collection<string, CommandBase>;
    slashDatas: unknown[];
    logger: import("winston").Logger;
  }
}
