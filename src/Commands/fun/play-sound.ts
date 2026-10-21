// src/Commands/fun/play-sound.js
import { SlashCommandBuilder } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import globalState from "../../Base/state.js";
import { BOT_VOICE_ACTIVITY_KEY, BOT_VOICE_STATE_KEY } from "../../Lib/voiceCleanup.js";
import type { CommandBase } from "../../Lib/types.js";
import { CustomInteractionHandler } from "../../Lib/interaction.js";

export const commandBase: CommandBase = {
  slashData: new SlashCommandBuilder()
    .setName("play-sound")
    .setDescription("Play a sound file from a message's attachment.")
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("Message link or ID to play sound from")
        .setAutocomplete(true)
        .setRequired(true)
    ),

  cooldown: 1000,
  adminOnly: false,

  async slashRun(handler: CustomInteractionHandler) {
    const { interaction } = handler;
    const messageId = interaction.options.getString("message")!;
    const member = interaction.member as any;

    if (!member?.voice?.channel) {
      return interaction.reply({
        content: "❌ You must be in a voice channel to play a sound.",
        flags: "Ephemeral",
      });
    }

    await interaction.deferReply({ flags: "Ephemeral" });

    // Try fetching the message
    let message;
    try {
      let channel: any = interaction.channel;
      let msgId = messageId;

      // Detect full message URL
      const urlMatch = messageId.match(
        /https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/
      );
      if (urlMatch) {
        const [, guildId, channelIdFromUrl, messageIdFromUrl] = urlMatch;
        channel = await interaction.client.channels.fetch(channelIdFromUrl);
        msgId = messageIdFromUrl;
      }

      message = await channel.messages.fetch(msgId);
    } catch {
      return interaction.editReply({ content: "❌ Could not find that message ID or URL." });
    }

    const audioAttachment = message.attachments.find((a: any) =>
      a.contentType?.startsWith("audio/")
    );

    if (!audioAttachment) {
      return interaction.editReply({ content: "❌ Message has no audio attachment." });
    }

    const guildKey = BOT_VOICE_STATE_KEY(interaction.guildId!);
    const voiceChannel = member.voice.channel;

    // Get or create guild voice state
    let guildState = globalState.getState(guildKey);
    if (!guildState) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      const player = createAudioPlayer();
      connection.subscribe(player);

      guildState = {
        connection,
        player,
        queue: [],
        playing: false,
        lastPlayed: Date.now(),
      };

      globalState.setState(guildKey, guildState);

      // Player event hooks
      player.on(AudioPlayerStatus.Playing, () => {
        guildState.lastPlayed = Date.now();
        globalState.setState(guildKey, guildState);
      });

      player.on(AudioPlayerStatus.Idle, async () => {
        guildState.lastPlayed = Date.now();
        globalState.setState(guildKey, guildState);
        if (guildState.queue.length > 0) {
          // 1 second gap between tracks
          await new Promise((res) => setTimeout(res, 200));
          playNext(interaction.guildId!);
        } else {
          guildState.playing = false;
        }
      });
    }

    // Add sound to queue
    guildState.queue.push({
      url: audioAttachment.url,
      name: audioAttachment.name,
      interaction,
      channel: voiceChannel,
    });

    // Notify user
    await interaction.editReply({
      content: `✅ Queued **${audioAttachment.name}** to play in <#${voiceChannel.id}>.`,
    });

    // If nothing playing, start playback
    if (!guildState.playing) {
      guildState.playing = true;
      playNext(interaction.guildId!);
    }
  },
};

/**
 * Plays the next sound in the queue for a guild.
 */
async function playNext(guildId: string) {
  const guildState = globalState.getState(BOT_VOICE_STATE_KEY(guildId));
  if (!guildState || guildState.queue.length === 0) {
    guildState.playing = false;
    return;
  }

  const { connection, player } = guildState;
  const next = guildState.queue.shift();

  player.on("stateChange", (oldState: any, newState: any) => {
    console.log(`[VoicePlayer] ${oldState.status} → ${newState.status}`);
  });

  try {
    console.log("[VoicePlayer] Trying");
    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
    const resource = createAudioResource(next.url);
    console.log(`[VoicePlayer] Resource: ${next.url}`);
    player.play(resource);
    await entersState(player, AudioPlayerStatus.Playing, 5_000);

    await next.interaction.followUp({
      content: `🎵 Now playing: **${next.name}** in <#${next.channel.id}>.`,
      flags: "Ephemeral",
    });

    globalState.setState(BOT_VOICE_ACTIVITY_KEY(guildId), Date.now());
  } catch (err) {
    console.log("[VoicePlayer] Failed to start:", err);
    console.error(`[VoicePlayer] Failed to play ${next.name}:`, err);
    await next.interaction.followUp({
      content: `❌ Failed to play **${next.name}**.`,
      flags: "Ephemeral",
    });
    // Continue to next in queue
    playNext(guildId);
  }
}
