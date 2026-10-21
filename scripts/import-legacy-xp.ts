import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/Lib/db.js";

const LEGACY_XP_DIR = path.join(process.cwd(), "data", "legacy-xp");

interface LegacyPoints {
  text?: string | number;
  voice?: string | number;
  probation?: boolean;
}

async function importFile(guildId: string, filePath: string) {
  const raw: Record<string, string> = JSON.parse(readFileSync(filePath, "utf-8"));

  let imported = 0;
  for (const [userId, encoded] of Object.entries(raw)) {
    const points: LegacyPoints = typeof encoded === "string" ? JSON.parse(encoded) : encoded;

    const textXp = Number(points.text ?? 0);
    const voiceXp = Number(points.voice ?? 0);

    await prisma.legacyXpImport.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId, textXp, voiceXp },
      update: { textXp, voiceXp },
    });
    imported++;
  }

  console.log(`[ImportLegacyXp] Imported ${imported} user(s) from ${path.basename(filePath)} (guild ${guildId}).`);
}

async function main() {
  const files = readdirSync(LEGACY_XP_DIR).filter((f) => f.endsWith(".points.json"));

  if (files.length === 0) {
    console.log(`[ImportLegacyXp] No *.points.json files found in ${LEGACY_XP_DIR}.`);
    return;
  }

  for (const file of files) {
    const guildId = file.replace(/\.points\.json$/, "");
    await importFile(guildId, path.join(LEGACY_XP_DIR, file));
  }
}

main()
  .catch((err) => {
    console.error("[ImportLegacyXp] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
