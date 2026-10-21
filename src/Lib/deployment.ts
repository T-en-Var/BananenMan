import { Client, EmbedBuilder } from "discord.js";
import { prisma } from "./db.js";
import { Settings } from "./settings.js";

export function getCurrentVersion(): string {
  return process.env.GIT_SHA ?? "dev";
}

export function shortVersion(version: string): string {
  return version.length > 7 ? version.slice(0, 7) : version;
}

/**
 * Compares the running version against the last one recorded in the DB.
 * Returns null on the very first ever boot (nothing to compare against yet —
 * seeding the baseline isn't itself an "update").
 */
export async function isNewDeployment(version: string): Promise<boolean | null> {
  const last = await prisma.botDeployment.findFirst({ orderBy: { deployedAt: "desc" } });
  if (!last) return null;
  return last.version !== version;
}

export async function recordDeployment(version: string) {
  await prisma.botDeployment.create({ data: { version } });
}

/**
 * Called once on boot (see src/Events/ready.ts). If this is a genuinely new version
 * compared to the last recorded boot, announces it in every guild that has configured
 * an update channel (/settings general setupdatechannel) and records the new version.
 * A first-ever boot (no prior record) just seeds the baseline silently.
 */
export async function checkForNewDeploymentAndAnnounce(client: Client) {
  const version = getCurrentVersion();
  const isNew = await isNewDeployment(version);

  if (isNew === null) {
    console.log(`[Deployment] First recorded boot, version ${version}. Seeding baseline, no announcement.`);
    await recordDeployment(version);
    return;
  }

  if (!isNew) {
    console.log(`[Deployment] Still running version ${version}, not a new deployment.`);
    return;
  }

  console.log(`[Deployment] New deployment detected: now running version ${version}.`);
  await recordDeployment(version);

  for (const guild of client.guilds.cache.values()) {
    try {
      const settings = new Settings(guild.id);
      const channelId = await settings.getUpdateChannelId();
      if (!channelId) continue;

      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased() || !("send" in channel)) continue;

      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("Blue")
            .setTitle("🔄 Bot Updated")
            .setDescription(`Now running version \`${shortVersion(version)}\`.`)
            .setTimestamp(),
        ],
      });
    } catch (err) {
      console.error(`[Deployment] Failed to announce update in guild ${guild.id}:`, err);
    }
  }
}
