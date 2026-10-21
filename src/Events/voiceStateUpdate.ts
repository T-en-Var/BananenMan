import { Events, Guild, VoiceState } from "discord.js";
import globalState from "./../Base/state.js";
import { checkIdleVoiceConnections } from "../Lib/voiceCleanup.js";
import { awardXp, getTotalXp, XpSource } from "../Lib/xp.js";

// Constants
const MUTE_LIMIT_MS = 20 * 60 * 1000; // 20 minutes
// const MUTE_LIMIT_MS = 2000; // 2 seconds
const XP_TICK_MS = 60 * 1000; // 1 minute

// Key prefixes
export const KEYS = {
  AFK_RUNNING: (guildId: string) => `${guildId}_afkKickerIsRunning`,
  AFK_INTERVAL: (guildId: string) => `${guildId}_afkKickerCheck`,
  AFK_MUTED: (guildId: string) => `${guildId}_afkKickerMutedUsers`,
  SOUND_RUNNING: (guildId: string) => `${guildId}_soundMonitorRunning`,
  SOUND_INTERVAL: (guildId: string) => `${guildId}_noiseIdleCheck`,
  XP_RUNNING: (guildId: string) => `${guildId}_voiceXpRunning`,
  XP_INTERVAL: (guildId: string) => `${guildId}_voiceXpCheck`,
  XP_LAST_TICK: (guildId: string) => `${guildId}_voiceXpLastTick`,
};

// ---------------------------
// Event Handler
// ---------------------------
export default {
  name: Events.VoiceStateUpdate,
  once: false,

  async execute(oldState: VoiceState, newState: VoiceState) {
    const guild = newState.guild ?? oldState.guild;
    if (!guild) return;

    // handleAfkKicker(guild, newState, oldState);
    handleSoundMonitor(guild, newState, oldState);
    handleVoiceXp(guild);
  },
};

// ---------------------------
// AFK Kicker Functions
// ---------------------------
function handleAfkKicker(guild: Guild, newState: VoiceState, oldState: VoiceState) {
  const userId = newState.id;
  if (newState.channelId === guild.afkChannel?.id) return;
  const isSelfMuted = newState.selfMute || newState.selfDeaf;

  const mutedUsers: Map<string, { channelId: string; mutedAt: number }> =
    globalState.getState(KEYS.AFK_MUTED(guild.id)) ?? new Map();

  if (isSelfMuted && newState.channelId) {
    const prev = mutedUsers.get(userId);
    mutedUsers.set(userId, {
      channelId: newState.channelId,
      mutedAt: prev?.mutedAt ?? Date.now(),
    });
  } else {
    mutedUsers.delete(userId);
  }

  globalState.setState(KEYS.AFK_MUTED(guild.id), mutedUsers);
  const isActive = globalState.getState(KEYS.AFK_RUNNING(guild.id));

  if (!isActive && mutedUsers.size > 0 && !globalState.getState(KEYS.AFK_RUNNING(guild.id))) {
    startAfkMonitor(guild.id);
  } else if (isActive && mutedUsers.size === 0) {
    stopAfkMonitor(guild.id);
  }
}

function startAfkMonitor(guildId: string) {
  console.log(`[AFK-Kicker] Starting AFK monitor for guild ${guildId}`);
  globalState.setState(KEYS.AFK_RUNNING(guildId), true);

  globalState.setIntervalFunction(KEYS.AFK_INTERVAL(guildId), () => checkMutedUsersForGuild(guildId));
}

function stopAfkMonitor(guildId: string) {
  console.log(`[AFK-Kicker] Stopping AFK monitor for guild ${guildId}`);
  globalState.setState(KEYS.AFK_RUNNING(guildId), false);

  globalState.removeIntervalFunction(KEYS.AFK_INTERVAL(guildId));
}

function checkMutedUsersForGuild(guildId: string) {
  const client = globalState.getClient();
  const mutedUsers: Map<string, { channelId: string; mutedAt: number }> = globalState.getState(KEYS.AFK_MUTED(guildId));
  if (!client || !mutedUsers) return stopAfkMonitor(guildId);

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return stopAfkMonitor(guildId);

  const afkChannel = guild.afkChannel;
  if (!afkChannel) return;

  const now = Date.now();
  for (const [userId, info] of mutedUsers.entries()) {
    const member = guild.members.cache.get(userId);
    if (member && member.voice.channelId === info.channelId && now - info.mutedAt >= MUTE_LIMIT_MS) {
      member.voice.setChannel(afkChannel).catch(console.error);
      console.log(`[AFK-Kicker] Moved ${member.user.tag} to AFK (muted too long).`);
      mutedUsers.delete(userId);
    }
  }

  globalState.setState(KEYS.AFK_MUTED(guildId), mutedUsers);
  if (mutedUsers.size === 0) stopAfkMonitor(guildId);
}

// ---------------------------
// Sound Monitor Functions
// ---------------------------
function handleSoundMonitor(guild: Guild, newState: VoiceState, oldState: VoiceState) {
  const botId = guild.client.user?.id;
  if (!botId) return;

  const wasInChannel = (oldState.channelId && oldState.channel?.members.has(botId)) ?? false;
  const isInChannel = (newState.channelId && newState.channel?.members.has(botId)) ?? false;

  const isRunningKey = KEYS.SOUND_RUNNING(guild.id);

  // Bot joined a channel
  if (!wasInChannel && isInChannel && !globalState.getState(isRunningKey)) {
    startSoundMonitor(guild.id);
  }

  // Bot left a channel
  if (!isInChannel && globalState.getState(isRunningKey)) {
    stopSoundMonitor(guild.id);
  }
}

function startSoundMonitor(guildId: string) {
  console.log(`[SoundMonitor] Starting sound monitor for guild ${guildId}`);
  globalState.setState(KEYS.SOUND_RUNNING(guildId), true);

  globalState.setIntervalFunction(KEYS.SOUND_INTERVAL(guildId), () => checkIdleVoiceConnections(guildId));
}

function stopSoundMonitor(guildId: string) {
  console.log(`[SoundMonitor] Stopping sound monitor for guild ${guildId}`);
  globalState.setState(KEYS.SOUND_RUNNING(guildId), false);

  globalState.removeIntervalFunction(KEYS.SOUND_INTERVAL(guildId));
}

// ---------------------------
// Voice XP Functions
// ---------------------------
export function handleVoiceXp(guild: Guild) {
  const afkChannelId = guild.afkChannel?.id;
  const hasHumans = guild.voiceStates.cache.some(
    (vs) => vs.channelId && vs.channelId !== afkChannelId && !vs.member?.user.bot
  );
  const isRunningKey = KEYS.XP_RUNNING(guild.id);

  if (hasHumans && !globalState.getState(isRunningKey)) {
    startVoiceXpMonitor(guild.id);
  } else if (!hasHumans && globalState.getState(isRunningKey)) {
    stopVoiceXpMonitor(guild.id);
  }
}

function startVoiceXpMonitor(guildId: string) {
  console.log(`[VoiceXp] Starting voice XP monitor for guild ${guildId}`);
  globalState.setState(KEYS.XP_RUNNING(guildId), true);
  globalState.setState(KEYS.XP_LAST_TICK(guildId), Date.now());

  // setIntervalFunction's underlying ticker runs on a shared interval (globalState.intervalMs,
  // 5s by default) across every registered monitor — same as the AFK/sound monitors above.
  // Rather than changing that shared cadence, we self-gate on elapsed time here (same approach
  // the AFK kicker uses) so XP is only actually awarded once XP_TICK_MS has passed.
  globalState.setIntervalFunction(KEYS.XP_INTERVAL(guildId), () => awardVoiceXpTick(guildId));
}

function stopVoiceXpMonitor(guildId: string) {
  console.log(`[VoiceXp] Stopping voice XP monitor for guild ${guildId}`);
  globalState.setState(KEYS.XP_RUNNING(guildId), false);

  globalState.removeIntervalFunction(KEYS.XP_INTERVAL(guildId));
  globalState.removeState(KEYS.XP_LAST_TICK(guildId));
}

export function awardVoiceXpTick(guildId: string) {
  const client = globalState.getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) return stopVoiceXpMonitor(guildId);

  const lastTickKey = KEYS.XP_LAST_TICK(guildId);
  const lastTick: number = globalState.getState(lastTickKey) ?? Date.now();
  if (Date.now() - lastTick < XP_TICK_MS) return;

  globalState.setState(lastTickKey, Date.now());

  const afkChannelId = guild.afkChannel?.id;

  // Count non-bot members per channel first, so a user alone in a channel (even with a
  // bot present) doesn't earn XP — only counts when there's at least one other human
  // actually there with them.
  const humanCountByChannel = new Map<string, number>();
  for (const vs of guild.voiceStates.cache.values()) {
    if (!vs.channelId || vs.channelId === afkChannelId || vs.member?.user.bot) continue;
    humanCountByChannel.set(vs.channelId, (humanCountByChannel.get(vs.channelId) ?? 0) + 1);
  }

  for (const vs of guild.voiceStates.cache.values()) {
    if (!vs.channelId || vs.channelId === afkChannelId || vs.member?.user.bot) continue;
    if ((humanCountByChannel.get(vs.channelId) ?? 0) < 2) continue;

    const tag = vs.member?.user.tag ?? vs.id;
    const channelName = vs.channel?.name ?? vs.channelId;

    awardXp(guildId, vs.id, XpSource.VOICE_MINUTE, 1, vs.channelId)
      .then(() => getTotalXp(guildId, vs.id))
      .then((total) => {
        console.log(`[VoiceXp] ${tag} in #${channelName}: ${total.voice} voice XP, ${total.text} text XP`);
      })
      .catch((err) =>
        console.error(`[VoiceXp] Failed to award XP to ${vs.id} in guild ${guildId}:`, err)
      );
  }
}
