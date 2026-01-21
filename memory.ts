import { encodeBase64 as b64encode, decodeBase64 as b64decode } 
  from "https://deno.land/std@0.224.0/encoding/base64.ts";

const MEMORY_FILE = "__memory__.json";
const SECRET_KEY = Deno.env.get("MEMORY_SECRET") ?? "000111111111111";

async function getCryptoKey() {
  const raw = new TextEncoder().encode(SECRET_KEY.padEnd(32, "0"));
  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getCryptoKey();
  const encoded = new TextEncoder().encode(text);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return b64encode(new Uint8Array([...iv, ...new Uint8Array(ciphertext)]));
}

async function decrypt(b64: string): Promise<string> {
  try {
    const data = b64decode(b64);
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);

    const key = await getCryptoKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return "";
  }
}

interface UserMemory {
  [userId: string]: string[];
}

let memory: UserMemory = {};

try {
  const data = await Deno.readTextFile(MEMORY_FILE);
  memory = JSON.parse(data);
} catch {
  memory = {};
}

async function saveMemory() {
  await Deno.writeTextFile(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

export async function addUserMemory(userId: string, text: string) {
  const encrypted = await encrypt(text);

  if (!memory[userId]) memory[userId] = [];
  memory[userId].push(encrypted);

  await saveMemory();
}

export async function getUserMemory(userId: string): Promise<string[]> {
  const list = memory[userId] ?? [];
  const decrypted: string[] = [];

  for (const enc of list) {
    const msg = await decrypt(enc);
    if (msg.trim().length > 0) decrypted.push(msg);
  }

  return decrypted;
}

export async function resetUserMemory(userId: string) {
  delete memory[userId];
  await saveMemory();
}