import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAwardXp = vi.fn().mockResolvedValue(undefined);

vi.mock("../Lib/xp.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../Lib/xp.js")>();
  return { ...actual, awardXp: mockAwardXp };
});

const { tryAwardTextXp } = await import("./messageCreate.js");

function fakeMessage(overrides: Partial<{ guildId: string | null; authorId: string; channelId: string }> = {}) {
  const { guildId = "guild1", authorId = "user1", channelId = "channel1" } = overrides;
  return {
    guildId,
    channelId,
    author: { id: authorId, bot: false },
  } as any;
}

// Each test uses its own guild/user combo — the cooldown map lives on the module
// instance and persists across tests in this file, so reusing a key would leak state.

beforeEach(() => {
  vi.useFakeTimers();
  mockAwardXp.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("tryAwardTextXp", () => {
  it("awards XP for a message not on cooldown", () => {
    tryAwardTextXp(fakeMessage({ authorId: "test1-user" }));

    expect(mockAwardXp).toHaveBeenCalledTimes(1);
    expect(mockAwardXp).toHaveBeenCalledWith("guild1", "test1-user", "TEXT_MESSAGE", 1, "channel1");
  });

  it("does not award again within the 20s cooldown", () => {
    tryAwardTextXp(fakeMessage({ authorId: "test2-user" }));
    tryAwardTextXp(fakeMessage({ authorId: "test2-user" }));

    expect(mockAwardXp).toHaveBeenCalledTimes(1);
  });

  it("awards again once the cooldown has elapsed", () => {
    tryAwardTextXp(fakeMessage({ authorId: "test3-user" }));
    vi.advanceTimersByTime(20_000);
    tryAwardTextXp(fakeMessage({ authorId: "test3-user" }));

    expect(mockAwardXp).toHaveBeenCalledTimes(2);
  });

  it("tracks cooldowns per user, not globally", () => {
    tryAwardTextXp(fakeMessage({ authorId: "test4-user1" }));
    tryAwardTextXp(fakeMessage({ authorId: "test4-user2" }));

    expect(mockAwardXp).toHaveBeenCalledTimes(2);
  });

  it("does nothing outside a guild (DMs)", () => {
    tryAwardTextXp(fakeMessage({ guildId: null, authorId: "test5-user" }));

    expect(mockAwardXp).not.toHaveBeenCalled();
  });
});
