import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  xpEvent: {
    create: vi.fn(),
    groupBy: vi.fn(),
  },
  legacyXpImport: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("./db.js", () => ({ prisma: mockPrisma }));

const { awardXp, getTotalXp, getLeaderboard, XpSource } = await import("./xp.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("awardXp", () => {
  it("creates an XpEvent row with the given params", async () => {
    mockPrisma.xpEvent.create.mockResolvedValue({});

    await awardXp("guild1", "user1", XpSource.TEXT_MESSAGE, 1, "channel1");

    expect(mockPrisma.xpEvent.create).toHaveBeenCalledWith({
      data: { guildId: "guild1", userId: "user1", source: XpSource.TEXT_MESSAGE, amount: 1, channelId: "channel1" },
    });
  });
});

describe("getTotalXp", () => {
  it("adds the legacy base on top of summed events (matches the real import's 1380 + 2 = 1382 case)", async () => {
    mockPrisma.legacyXpImport.findUnique.mockResolvedValue({ textXp: 1380, voiceXp: 460533.023 });
    mockPrisma.xpEvent.groupBy.mockResolvedValue([
      { source: XpSource.TEXT_MESSAGE, _sum: { amount: 2 } },
      { source: XpSource.VOICE_MINUTE, _sum: { amount: 1 } },
    ]);

    const total = await getTotalXp("guild1", "user1");

    expect(total.text).toBe(1382);
    expect(total.voice).toBeCloseTo(460534.023);
  });

  it("defaults to 0 when a user has no legacy row or events for a source", async () => {
    mockPrisma.legacyXpImport.findUnique.mockResolvedValue(null);
    mockPrisma.xpEvent.groupBy.mockResolvedValue([{ source: XpSource.VOICE_MINUTE, _sum: { amount: 5 } }]);

    const total = await getTotalXp("guild1", "user2");

    expect(total).toEqual({ text: 0, voice: 5 });
  });
});

describe("getLeaderboard", () => {
  it("merges legacy and event rows per user, defaulting missing fields to 0", async () => {
    mockPrisma.legacyXpImport.findMany.mockResolvedValue([{ userId: "u1", textXp: 100, voiceXp: 200 }]);
    mockPrisma.xpEvent.groupBy.mockResolvedValue([
      { userId: "u1", source: XpSource.TEXT_MESSAGE, _sum: { amount: 10 } },
      { userId: "u2", source: XpSource.VOICE_MINUTE, _sum: { amount: 50 } },
    ]);

    const board = await getLeaderboard("guild1");

    expect(board).toHaveLength(2);
    expect(board).toContainEqual({ userId: "u1", text: 110, voice: 200 });
    expect(board).toContainEqual({ userId: "u2", text: 0, voice: 50 });
  });

  it("returns an empty array when nobody has any XP", async () => {
    mockPrisma.legacyXpImport.findMany.mockResolvedValue([]);
    mockPrisma.xpEvent.groupBy.mockResolvedValue([]);

    const board = await getLeaderboard("guild1");

    expect(board).toEqual([]);
  });
});
