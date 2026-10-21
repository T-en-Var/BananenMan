import { describe, it, expect, vi, beforeEach } from "vitest";
import { Collection } from "discord.js";

const stateStore = new Map<string, any>();

const mockGlobalState = {
  getState: vi.fn((key: string) => stateStore.get(key)),
  setState: vi.fn((key: string, value: any) => stateStore.set(key, value)),
  removeState: vi.fn((key: string) => stateStore.delete(key)),
  setIntervalFunction: vi.fn(),
  removeIntervalFunction: vi.fn(),
  getClient: vi.fn(),
  isActive: true,
};

vi.mock("../Base/state.js", () => ({ default: mockGlobalState }));

const mockAwardXp = vi.fn().mockResolvedValue(undefined);
const mockGetTotalXp = vi.fn().mockResolvedValue({ text: 0, voice: 0 });

vi.mock("../Lib/xp.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../Lib/xp.js")>();
  return { ...actual, awardXp: mockAwardXp, getTotalXp: mockGetTotalXp };
});

vi.mock("../Lib/voiceCleanup.js", () => ({ checkIdleVoiceConnections: vi.fn() }));

const { handleVoiceXp, awardVoiceXpTick, KEYS } = await import("./voiceStateUpdate.js");

function fakeVoiceState(id: string, channelId: string | null, { bot = false, channelName = "general" } = {}) {
  return {
    id,
    channelId,
    channel: channelId ? { name: channelName } : null,
    member: { user: { id, bot, tag: `${id}#0` } },
  } as any;
}

function fakeGuild(guildId: string, voiceStates: any[], afkChannelId?: string) {
  const cache = new Collection<string, any>();
  for (const vs of voiceStates) cache.set(vs.id, vs);

  return {
    id: guildId,
    afkChannel: afkChannelId ? { id: afkChannelId } : undefined,
    voiceStates: { cache },
  } as any;
}

beforeEach(() => {
  stateStore.clear();
  vi.clearAllMocks();
  mockAwardXp.mockResolvedValue(undefined);
  mockGetTotalXp.mockResolvedValue({ text: 0, voice: 0 });
});

describe("handleVoiceXp", () => {
  it("starts the monitor when a human joins a normal voice channel", () => {
    const guild = fakeGuild("g1", [fakeVoiceState("u1", "c1")]);

    handleVoiceXp(guild);

    expect(mockGlobalState.setIntervalFunction).toHaveBeenCalledWith(KEYS.XP_INTERVAL("g1"), expect.any(Function));
    expect(mockGlobalState.getState(KEYS.XP_RUNNING("g1"))).toBe(true);
  });

  it("does not start the monitor when the only human present is in the AFK channel", () => {
    const guild = fakeGuild("g1", [fakeVoiceState("u1", "afk-channel")], "afk-channel");

    handleVoiceXp(guild);

    expect(mockGlobalState.setIntervalFunction).not.toHaveBeenCalled();
  });

  it("stops the monitor once nobody eligible remains connected", () => {
    const guild = fakeGuild("g1", [], undefined);
    stateStore.set(KEYS.XP_RUNNING("g1"), true);

    handleVoiceXp(guild);

    expect(mockGlobalState.removeIntervalFunction).toHaveBeenCalledWith(KEYS.XP_INTERVAL("g1"));
    expect(mockGlobalState.getState(KEYS.XP_RUNNING("g1"))).toBe(false);
  });
});

describe("awardVoiceXpTick", () => {
  it("does not award XP before XP_TICK_MS has elapsed since the last tick", () => {
    stateStore.set(KEYS.XP_LAST_TICK("g1"), Date.now());
    const guild = fakeGuild("g1", [fakeVoiceState("u1", "c1")]);
    mockGlobalState.getClient.mockReturnValue({ guilds: { cache: new Map([["g1", guild]]) } });

    awardVoiceXpTick("g1");

    expect(mockAwardXp).not.toHaveBeenCalled();
  });

  it("awards XP to connected humans but skips the AFK channel and bots once the tick elapses", () => {
    stateStore.set(KEYS.XP_LAST_TICK("g1"), Date.now() - 61_000);
    const guild = fakeGuild(
      "g1",
      [
        fakeVoiceState("human-in-call-1", "c1"),
        fakeVoiceState("human-in-call-2", "c1"),
        fakeVoiceState("human-in-afk", "afk-channel"),
        fakeVoiceState("a-bot", "c1", { bot: true }),
      ],
      "afk-channel"
    );
    mockGlobalState.getClient.mockReturnValue({ guilds: { cache: new Map([["g1", guild]]) } });

    awardVoiceXpTick("g1");

    expect(mockAwardXp).toHaveBeenCalledTimes(2);
    expect(mockAwardXp).toHaveBeenCalledWith("g1", "human-in-call-1", "VOICE_MINUTE", 1, "c1");
    expect(mockAwardXp).toHaveBeenCalledWith("g1", "human-in-call-2", "VOICE_MINUTE", 1, "c1");
  });

  it("does not award XP to a human who is alone in their channel, even with a bot present", () => {
    stateStore.set(KEYS.XP_LAST_TICK("g1"), Date.now() - 61_000);
    const guild = fakeGuild("g1", [
      fakeVoiceState("lonely-human", "c1"),
      fakeVoiceState("a-bot", "c1", { bot: true }),
    ]);
    mockGlobalState.getClient.mockReturnValue({ guilds: { cache: new Map([["g1", guild]]) } });

    awardVoiceXpTick("g1");

    expect(mockAwardXp).not.toHaveBeenCalled();
  });

  it("counts humans per-channel, not per-guild — two lonely humans in different channels still earn nothing", () => {
    stateStore.set(KEYS.XP_LAST_TICK("g1"), Date.now() - 61_000);
    const guild = fakeGuild("g1", [
      fakeVoiceState("human-1", "c1"),
      fakeVoiceState("human-2", "c2"),
    ]);
    mockGlobalState.getClient.mockReturnValue({ guilds: { cache: new Map([["g1", guild]]) } });

    awardVoiceXpTick("g1");

    expect(mockAwardXp).not.toHaveBeenCalled();
  });
});
