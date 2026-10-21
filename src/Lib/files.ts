import fs from "fs/promises";
import config from "../Base/config.js";
import path from "path";
import type { Run } from "./types.js";

const settingsFile = "settings";
export const soullinkDataFolder = "soullinkRunData";

export async function saveRun(runname: string, data: Run) {
  await ensureDataDir();
  const file = getFilePath(runname, soullinkDataFolder);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

export async function ensureDataDir() {
  await fs.mkdir(`${config.dataFolder}/${soullinkDataFolder}`, { recursive: true });
}

export function getFilePath(filename: string, folderPath = "") {
  return path.join(config.dataFolder, folderPath, `${filename}.json`);
}

export async function getRuns() {
  const files = await fs.readdir(`${config.dataFolder}/${soullinkDataFolder}`);
  return files.filter((f) => f.endsWith(".json")).map((file) => path.basename(file, ".json"));
}

export async function loadRun(runname: string): Promise<Run | null> {
  const file = getFilePath(runname, soullinkDataFolder);
  try {
    const data = await fs.readFile(file, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}
