import type { Client } from "discord.js";
import type { CustomInteractionHandler } from "./interaction.js";

export interface CommandBase {
  /** info for slash command (discord.js's builder chain types are too narrow to express every shape commands build here) */
  slashData: any;
  /** cooldown in ms */
  cooldown?: number;
  /** whether only admins can run */
  adminOnly?: boolean;
  /** whether only owners can run */
  ownerOnly?: boolean;
  slashRun: (handler: CustomInteractionHandler) => Promise<unknown>;
  prefixRun?: (client: Client, message: any, args: string[]) => Promise<unknown>;
  execute?: (...args: any[]) => Promise<unknown>;
}

export interface EventHandler {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}

export interface ShortUser {
  /** Discord user ID */
  id: string;
  /** Discord username */
  username: string;
}

export interface History {
  type: "pokemon" | "location";
  oldValue: string;
  newValue: string;
  location: string;
  createdOn: number;
}

export interface Encounter {
  id: number;
  location: string;
  status: string;
  reason?: string;
  playerId: string;
  playerName: string;
  pokemon: string;
  nickname: string;
  captured: boolean;
  history: History[];
}

export interface Run {
  runname: string;
  started: boolean;
  startedOn?: number;
  players: ShortUser[];
  encounters: Encounter[];
  encounterCounter: number;
}

export interface Settings {
  motd: string;
  admin: ShortUser[];
}

export interface SimpleEncounter {
  id: string;
  player: string;
  pokemon: string;
  captured: boolean;
}

export interface GroupedEncounter {
  location: string;
  nickname: string;
  status: string;
  reason?: string;
  encounters: SimpleEncounter[];
}

export interface PokemonTypeSlot {
  slot: number;
  type: { name: string; url: string };
}

export interface PokemonSprites {
  front_default: string | null;
  front_shiny: string | null;
  front_female: string | null;
  front_shiny_female: string | null;
  back_default: string | null;
  back_shiny: string | null;
}

export interface Pokemon {
  id: number;
  name: string;
  types: PokemonTypeSlot[];
  sprites: PokemonSprites;
  height: number;
  weight: number;
  stats: { base_stat: number; stat: { name: string } }[];
}

export interface PokemonBulk {
  name: string;
  url: string;
}
