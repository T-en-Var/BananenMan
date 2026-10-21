import fs from "fs/promises";
import config from "../Base/config.js";
import path from "path";
import type { ShortUser } from "./types.js";

export class Settings {
  guildId: string;
  file: string;
  defaults: { adminUsers: ShortUser[]; adminRoles: string[]; updateChannelId: string | null };

  constructor(guildId: string) {
    this.guildId = guildId;
    this.file = path.join(config.dataFolder, `settings.${guildId}.json`);
    this.defaults = {
      adminUsers: (config.defaultSettings as any).admin ?? [],
      adminRoles: [],
      updateChannelId: null,
    };
  }

  async ensureDataDir() {
    await fs.mkdir(config.dataFolder, { recursive: true });
  }

  async load(): Promise<any> {
    await this.ensureDataDir();
    try {
      const data = JSON.parse(await fs.readFile(this.file, "utf-8"));
      return { ...this.defaults, ...data };
    } catch (err: any) {
      if (err.code === "ENOENT") {
        await this.save(this.defaults);
        return this.defaults;
      }
      throw err;
    }
  }

  async save(settings: any) {
    await this.ensureDataDir();
    await fs.writeFile(this.file, JSON.stringify(settings, null, 2));
  }

  async get(key: string) {
    const data = await this.load();
    return data[key] ?? (this.defaults as any)[key];
  }

  async set(key: string, value: any) {
    const data = await this.load();
    data[key] = value;
    await this.save(data);
  }

  async getAdmins(): Promise<ShortUser[]> {
    const admins = await this.get("adminUsers");
    const defaultAdmins = this.defaults.adminUsers;
    const missing = defaultAdmins.filter((d) => !admins.some((a: ShortUser) => a.id === d.id));
    return admins.concat(missing);
  }

  async getAdminRoles(): Promise<string[]> {
    return await this.get("adminRoles");
  }

  async getUpdateChannelId(): Promise<string | null> {
    return await this.get("updateChannelId");
  }

  async addAdminUser(user: ShortUser) {
    const data = await this.load();
    if (!data.adminUsers.some((u: ShortUser) => u.id === user.id)) {
      data.adminUsers.push(user);
      await this.save(data);
    }
  }

  async removeAdminUser(userId: string) {
    const data = await this.load();
    data.adminUsers = data.adminUsers.filter((u: ShortUser) => u.id !== userId);
    await this.save(data);
  }

  async addAdminRole(roleId: string) {
    const data = await this.load();
    if (!data.adminRoles.includes(roleId)) {
      data.adminRoles.push(roleId);
      await this.save(data);
    }
  }

  async removeAdminRole(roleId: string) {
    const data = await this.load();
    data.adminRoles = data.adminRoles.filter((id: string) => id !== roleId);
    await this.save(data);
  }
}
