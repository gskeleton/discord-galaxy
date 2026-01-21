import "jsr:@std/dotenv/load";

const token = Deno.env.get("DISCORD_BOT_TOKEN");
if (!token) throw new Error("DISCORD_BOT_TOKEN is not defined in .env!");

import {
  createBot,
  startBot,
  Intents,
} from "https://deno.land/x/discordeno@18.0.1/mod.ts";

import { sendMessageToGroq } from "./groq.ts";
import { addUserMemory, getUserMemory, resetUserMemory } from "./memory.ts";
import { splitMessageWithCodeBlocks } from "./groq.ts";

const bot = createBot({
  token: token,
  intents: Intents.GuildMessages | Intents.MessageContent,
  events: {
    ready() {
      console.log(">>>>>>>>>>>>>>");
      console.log("Bot is online!");
      console.log("<<<<<<<<<<<<<<");
    },

    async messageCreate(bot, message) {
      if (message.isBot) return;

      if (message.content === "!ping") {
        await bot.helpers.sendMessage(message.channelId, { content: "Pong!" });
      }

      const content = message.content.trim();
      const userId = message.authorId;

      if (content.startsWith("!remember ")) {
        const text = content.replace("!remember ", "");
        await addUserMemory(userId, text);
        await bot.helpers.sendMessage(message.channelId, { content: "✔ Disimpan!" });
        return;
      }

      if (content === "!memory") {
        const memories = await getUserMemory(userId);
        if (memories.length === 0) {
          await bot.helpers.sendMessage(message.channelId, { content: "Belum ada memory." });
          return;
        }

        const msg = "**Memory kamu:**\n" + memories.map((m, i) => `${i+1}. ${m}`).join("\n");
        await bot.helpers.sendMessage(message.channelId, { content: msg });
        return;
      }

      if (content === "!forget") {
        await resetUserMemory(userId);
        await bot.helpers.sendMessage(message.channelId, { content: "🗑 Memory direset." });
        return;
      }

      if (content.startsWith("!wanion ")) {
        const userMessage = content.slice(5);
        const instructions = await Deno.readTextFile("__instructions.txt");
        const memories = await getUserMemory(userId);

        const systemPrompt = `
${instructions}

${memories.map(m => "- " + m).join("\n")}
`.trim();

        const finalPrompt = `
${systemPrompt}

User: ${userMessage}
`.trim();

        await addUserMemory(userId, `User said: ${userMessage}`);

        try {
          const reply = await sendMessageToGroq(finalPrompt);
          const parts = splitMessageWithCodeBlocks(reply);

          for (let part of parts) {
            part = part.trim();
            if (part.length === 0) continue;
            await bot.helpers.sendMessage(message.channelId, { content: part });
          }

          await addUserMemory(userId, `Bot replied: ${reply}`);

        } catch (err) {
          console.error(err);
          await bot.helpers.sendMessage(message.channelId, { content: "Error contacting Groq API." });
        }
      }
    }
  }
});

await startBot(bot);