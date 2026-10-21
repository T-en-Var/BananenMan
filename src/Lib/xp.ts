import { XpSource } from "@prisma/client";
import { prisma } from "./db.js";

export { XpSource };

export async function awardXp(guildId: string, userId: string, source: XpSource, amount = 1, channelId?: string) {
  return prisma.xpEvent.create({
    data: {
      guildId,
      userId,
      source,
      amount,
      channelId,
    },
  });
}

export async function getTotalXp(guildId: string, userId: string) {
  const [legacy, events] = await Promise.all([
    prisma.legacyXpImport.findUnique({ where: { guildId_userId: { guildId, userId } } }),
    prisma.xpEvent.groupBy({
      by: ["source"],
      where: { guildId, userId },
      _sum: { amount: true },
    }),
  ]);

  const eventText = events.find((e) => e.source === XpSource.TEXT_MESSAGE)?._sum.amount ?? 0;
  const eventVoice = events.find((e) => e.source === XpSource.VOICE_MINUTE)?._sum.amount ?? 0;

  return {
    text: Number(legacy?.textXp ?? 0) + Number(eventText),
    voice: Number(legacy?.voiceXp ?? 0) + Number(eventVoice),
  };
}

export interface LeaderboardEntry {
  userId: string;
  text: number;
  voice: number;
}

/**
 * Combined (legacy base + summed events) XP for every user in a guild who has any.
 */
export async function getLeaderboard(guildId: string): Promise<LeaderboardEntry[]> {
  const [legacyRows, eventSums] = await Promise.all([
    prisma.legacyXpImport.findMany({ where: { guildId } }),
    prisma.xpEvent.groupBy({
      by: ["userId", "source"],
      where: { guildId },
      _sum: { amount: true },
    }),
  ]);

  const totals = new Map<string, LeaderboardEntry>();

  for (const row of legacyRows) {
    totals.set(row.userId, {
      userId: row.userId,
      text: Number(row.textXp),
      voice: Number(row.voiceXp),
    });
  }

  for (const row of eventSums) {
    const entry = totals.get(row.userId) ?? { userId: row.userId, text: 0, voice: 0 };
    const amount = Number(row._sum.amount ?? 0);
    if (row.source === XpSource.TEXT_MESSAGE) entry.text += amount;
    else entry.voice += amount;
    totals.set(row.userId, entry);
  }

  return [...totals.values()];
}
