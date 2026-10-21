import type { Client, ChatInputCommandInteraction, GuildMember } from "discord.js";
import config from "../Base/config.js";
import { Logger } from "./logger.js";
import { Settings } from "./settings.js";
import type { CommandBase } from "./types.js";

export class CustomInteractionHandler {
  client: Client;
  interaction: ChatInputCommandInteraction;
  command: CommandBase;
  settings: Settings;
  logger: Logger;
  isAdminCache: boolean | null;
  isOwnerCache: boolean | null;
  member?: GuildMember;

  constructor(client: Client, interaction: ChatInputCommandInteraction, command: CommandBase) {
    this.client = client;
    this.interaction = interaction;
    this.command = command;
    this.settings = new Settings(interaction.guildId!);
    this.logger = new Logger(interaction.guildId!);

    this.isAdminCache = null;
    this.isOwnerCache = null;
  }

  async execute() {
    this.log("Executing command");
    try {
      await this.command.slashRun(this);
    } catch (error) {
      this.error("An error occurred while executing.", error);
      this.handleError(error);
    }
  }

  async handleError(error: any) {
    const isAdmin = await this.checkIsAdmin();
    let content = "An error occurred.";

    if (isAdmin) {
      content = `An error occured:\n\n${error}`;
    }

    if (this.interaction.replied) {
      this.interaction.followUp({
        content: content,
        flags: "Ephemeral",
      });
    } else {
      this.interaction.reply({
        content: content,
        flags: "Ephemeral",
      });
    }
  }

  async log(details: string) {
    this.logger.log(details, this.interaction.user.id, `/${(this.command.slashData as any).name}`);
  }

  async warn(details: string) {
    this.logger.warn(details, this.interaction.user.id, `/${(this.command.slashData as any).name}`);
  }

  async error(error: string, details: any) {
    this.logger.error(error, details, this.interaction.user.id, `/${(this.command.slashData as any).name}`);
  }

  async checkIsAdmin(): Promise<boolean> {
    if (this.isAdminCache !== null) return this.isAdminCache;

    if (await this.checkIsOwner()) {
      this.isAdminCache = true;
      return true;
    }

    const admins = await this.settings.getAdmins();
    if (admins.find((a) => a.id === this.interaction.user.id)) {
      this.isAdminCache = true;
      return true;
    }

    if (!this.member) {
      this.member = await this.interaction.guild!.members.fetch(this.interaction.user.id);
    }

    const roles = await this.settings.getAdminRoles();
    if (this.member.roles.cache.some((r) => roles.includes(r.id))) {
      this.isAdminCache = true;
      return true;
    }

    this.isAdminCache = false;
    return false;
  }

  // its not async, I know, but maybe it will be one day
  async checkIsOwner(): Promise<boolean> {
    if (this.isOwnerCache !== null) return this.isOwnerCache;
    const isOwner = config.owners.includes(this.interaction.user.id);
    this.isOwnerCache = isOwner;
    return isOwner;
  }
}
