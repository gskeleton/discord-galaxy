import "jsr:@std/dotenv/load";

const apiKey = Deno.env.get("GROQ_API_KEY");
if (!apiKey) throw new Error("GROQ_API_KEY is not defined in .env!");

const API_BASE_URL = "https://api.groq.com/openai/v1";
const MAX_LENGTH = 2000;

export function splitMessageWithCodeBlocks(text: string): string[] {
  const parts: string[] = [];
  const tokens = text.split(/(```[\s\S]*?```)/g);
  let buffer = "";

  for (const token of tokens) {
    const isCodeBlock = token.startsWith("```") && token.endsWith("```");

    if (isCodeBlock) {
      if (buffer.length + token.length > MAX_LENGTH) {
        if (buffer.length > 0) parts.push(buffer);
        buffer = "";
      }

      if (token.length > MAX_LENGTH) {
        const chunks = splitLargeCodeBlock(token);
        parts.push(...chunks);
        continue;
      }

      if (buffer.length === 0) {
        buffer = token;
      } else if (buffer.length + token.length <= MAX_LENGTH) {
        buffer += token;
      } else {
        parts.push(buffer);
        buffer = token;
      }
    } 
    
    else {
      if (buffer.length + token.length <= MAX_LENGTH) {
        buffer += token;
      } else {
        parts.push(buffer);
        buffer = token;
      }
    }
  }

  if (buffer.length > 0) parts.push(buffer);
  return parts;
}

function splitLargeCodeBlock(codeBlock: string): string[] {
  const content = codeBlock.replace(/```(\w+)?/, "").slice(0, -3);
  const langMatch = codeBlock.match(/```(\w+)?/);
  const lang = langMatch?.[1] ?? "";

  const chunks: string[] = [];
  let current = "";

  for (const line of content.split("\n")) {
    if ((current + line + "\n").length > MAX_LENGTH - 10) {
      chunks.push("```" + lang + "\n" + current + "```");
      current = "";
    }
    current += line + "\n";
  }

  if (current.length > 0) {
    chunks.push("```" + lang + "\n" + current + "```");
  }

  return chunks;
}

export async function sendMessageToGroq(question: string): Promise<string> {
  const API_KEY = Deno.env.get("GROQ_API_KEY");
  const MODEL = "meta-llama/llama-4-maverick-17b-128e-instruct";
  const BASE_URL = "https://api.groq.com/openai/v1/";

  const res = await fetch(`${BASE_URL}chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
    {
      role: "system",
      content: `I am Asisst, a large language model trained by my creator to assist with a wide range of natural language processing tasks, including web searches when requested. I will follow the provided custom instructions precisely:

When the user's request contains keywords like 'pawn', 'pawn code', 'sa-mp code', 'pawno code', or 'qawno code', I will format all code blocks using the specific C++ style fences:
\`\`\`cpp
// code here
\`\`\`
Do not use // for comments in pawn code blocks; always use /* */ for multi-line comments. (always use /* */ for comments)`
    },
    { 
      role: "user", 
      content: question 
    }
  ],
  max_tokens: 1000,
  temperature: 0.2,
}),
  });

  if (!res.ok) {
    throw new Error(`Groq API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content ?? "No response";
}

const reply = await sendMessageToGroq("Hello, Groq!");
console.log("Groq reply:", reply);