/**
 * Standalone, long-running Discord bot process — NOT part of the Next.js
 * app or its deployment. Discord only delivers ordinary DMs to a bot over a
 * persistent Gateway websocket connection (there's no HTTP webhook for
 * this), so this has to run as its own always-on process (e.g. a small
 * VPS/Fly.io/Railway box), separate from wherever `next build`/`next start`
 * runs. Run with `npm run bot:discord`.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, GatewayIntentBits, Partials, ChannelType, Events } from "discord.js";
import { findUserByChannelAccount } from "../src/lib/supabase/channels";
import { handleInboundChannelMessage } from "../src/lib/channels/pipeline";
import { consumeLinkCode } from "../src/lib/discord/linking";

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("DISCORD_BOT_TOKEN is not set — cannot start the Discord bot.");
  process.exit(1);
}

const LINK_CODE_PATTERN = /^[A-Z0-9]{6}$/;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel, Partials.Message],
});

client.once(Events.ClientReady, () => {
  console.log(`Discord bot logged in as ${client.user?.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.channel.type !== ChannelType.DM) return;

  const discordUserId = message.author.id;
  const text = message.content?.trim() ?? "";

  const owner = await findUserByChannelAccount("discord", discordUserId);

  if (!owner) {
    // Not a linked account yet — the only thing we accept from a stranger is a link code.
    if (LINK_CODE_PATTERN.test(text.toUpperCase())) {
      const linked = await consumeLinkCode(text.toUpperCase(), discordUserId, message.author.username, message.channel.id);
      await message.reply(
        linked
          ? "Connected! ScamShield will now watch this DM and reply if something looks suspicious."
          : "That code isn't valid or has expired — generate a new one from Settings → Connected Channels."
      );
    }
    return;
  }

  const imageAttachment = message.attachments.find((a) => a.contentType?.startsWith("image/"));

  try {
    await handleInboundChannelMessage({
      externalMessageId: message.id,
      platformMessageId: message.id,
      platform: "discord",
      conversationId: message.channel.id,
      accountId: discordUserId,
      text: text.length > 0 ? text : null,
      imageUrl: imageAttachment?.url ?? null,
      downloadImage: async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to download Discord attachment: ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
      },
      sendReply: async (replyText) => {
        await message.channel.send(replyText);
      },
    });
  } catch (err) {
    console.error("Discord message processing error:", err);
  }
});

client.login(token);
