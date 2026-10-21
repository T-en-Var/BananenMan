import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  botDeployment: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("./db.js", () => ({ prisma: mockPrisma }));

// deployment.ts also imports Settings (for the announce step, not under test here) —
// mocked out so this test doesn't transitively pull in config/env validation, which
// calls process.exit(1) on invalid env and would otherwise kill the whole test run
// (both locally and in CI, where no real .env/BOT_TOKEN exists).
vi.mock("./settings.js", () => ({ Settings: vi.fn() }));

const { isNewDeployment, recordDeployment, shortVersion, getCurrentVersion } = await import("./deployment.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentVersion", () => {
  it("falls back to 'dev' when GIT_SHA isn't set", () => {
    const original = process.env.GIT_SHA;
    delete process.env.GIT_SHA;
    expect(getCurrentVersion()).toBe("dev");
    if (original !== undefined) process.env.GIT_SHA = original;
  });

  it("returns GIT_SHA when set", () => {
    const original = process.env.GIT_SHA;
    process.env.GIT_SHA = "abc1234567890";
    expect(getCurrentVersion()).toBe("abc1234567890");
    if (original === undefined) delete process.env.GIT_SHA;
    else process.env.GIT_SHA = original;
  });
});

describe("shortVersion", () => {
  it("truncates long versions to 7 characters", () => {
    expect(shortVersion("abc1234567890")).toBe("abc1234");
  });

  it("leaves short versions (like 'dev') untouched", () => {
    expect(shortVersion("dev")).toBe("dev");
  });
});

describe("isNewDeployment", () => {
  it("returns null on the very first ever boot (no prior record)", async () => {
    mockPrisma.botDeployment.findFirst.mockResolvedValue(null);
    expect(await isNewDeployment("abc1234")).toBeNull();
  });

  it("returns false when the version matches the last recorded boot", async () => {
    mockPrisma.botDeployment.findFirst.mockResolvedValue({ version: "abc1234" });
    expect(await isNewDeployment("abc1234")).toBe(false);
  });

  it("returns true when the version differs from the last recorded boot", async () => {
    mockPrisma.botDeployment.findFirst.mockResolvedValue({ version: "old0000" });
    expect(await isNewDeployment("new1111")).toBe(true);
  });
});

describe("recordDeployment", () => {
  it("creates a BotDeployment row with the given version", async () => {
    mockPrisma.botDeployment.create.mockResolvedValue({});
    await recordDeployment("abc1234");
    expect(mockPrisma.botDeployment.create).toHaveBeenCalledWith({ data: { version: "abc1234" } });
  });
});
