// Thin client for the WhatsApp MCP daemon (github.com/Sealjay/mcp-whatsapp) over its HTTP MCP endpoint.

const DAEMON = process.env.WA_DAEMON || "http://127.0.0.1:8766/mcp";
let rpcId = 0;

export async function call(name, args) {
  const res = await fetch(DAEMON, {
    method: "POST",
    // Hukam only ever writes to allowlisted numbers and groups, so it skips the daemon's anti-spam send interval.
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "X-Rate-Limit-Override": "true" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }),
  });
  const raw = await res.text();
  const body = raw.trimStart().startsWith("{")
    ? raw
    : raw.split("\n").find((l) => l.startsWith("data:"))?.slice(5) ?? "{}";
  const json = JSON.parse(body);
  if (json.error) throw new Error(`${name}: ${json.error.message}`);
  const text = (json.result?.content ?? []).map((c) => c.text).join("\n");
  if (json.result?.isError) throw new Error(`${name}: ${text}`);
  return text;
}

// "[2026-10-24 06:51:47] [ID: 3EB0...] Chat: Name From: Sender: body..." (body may span lines)
const HEADER = /^\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\] (?:\[ID: ([A-Za-z0-9]+)\] )?Chat: .*? From: (.*?): ([\s\S]*)$/;

export function parseMessages(text) {
  return text
    .split(/\n(?=\[\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\] )/)
    .map((chunk) => chunk.match(HEADER))
    .filter(Boolean)
    .map(([, ts, id, from, body]) => {
      // Media lines look like "[audio - Message ID: X - Chat JID: Y] caption"
      const media = body.match(/^\[(\w+) - Message ID: ([A-Za-z0-9]+) - Chat JID: [^\]]+\]\s*/);
      return {
        ts,
        id: id || media?.[2] || null,
        from,
        fromMe: from === "Me",
        media: media?.[1] ?? null,
        body: (media ? body.slice(media[0].length) : body).trim(),
      };
    });
}

// A chat target is a 1:1 phone number (digits) or a group JID ("<id>@g.us").
export const jid = (target) => (target.includes("@") ? target : `${target}@s.whatsapp.net`);
export const isGroup = (target) => target.endsWith("@g.us");

export async function recent(target, limit = 10, sender) {
  const text = await call("list_messages", {
    chat_jid: jid(target),
    limit,
    context_before: 0,
    context_after: 0,
    ...(sender ? { sender_phone_number: sender } : {}),
  });
  return parseMessages(text).sort((a, b) => a.ts.localeCompare(b.ts));
}

// Groups we belong to: JID -> { name, members: [{ jid, phone, lid }] }. Members are keyed by LID in "lid" groups.
export async function groups() {
  const text = await call("list_groups", {});
  const list = JSON.parse(text.slice(text.indexOf("[")));
  const user = (j) => (j || "").split("@")[0].split(":")[0];
  return new Map(
    list.map((g) => [
      g.JID,
      { name: g.Name, members: (g.Participants || []).map((p) => ({ jid: p.JID, phone: user(p.PhoneNumber), lid: user(p.LID || p.JID) })) },
    ]),
  );
}

// Decrypts a media message into the daemon's store and returns its absolute path.
export async function downloadMedia(target, messageId) {
  const text = await call("download_media", { chat_jid: jid(target), message_id: messageId });
  const result = JSON.parse(text.slice(text.indexOf("{"), text.indexOf("}", text.indexOf('"Path"')) + 1));
  if (!result.Success || !result.Path) throw new Error(`download_media: ${result.Message}`);
  return result.Path;
}

export const send = (target, message) => call("send_message", { recipient: target, message });

// senderJid is required by WhatsApp in group chats (the participant who wrote the message).
export const react = (target, messageId, emoji, senderJid) =>
  messageId
    ? call("send_reaction", { chat_jid: jid(target), message_id: messageId, emoji, ...(senderJid ? { sender_jid: senderJid } : {}) }).catch(() => {})
    : null;

// Blue ticks: tell the sender we have read their message.
export const markRead = (target, messageId, senderJid) =>
  messageId
    ? call("mark_read", { chat_jid: jid(target), message_ids: [messageId], ...(senderJid ? { sender_jid: senderJid } : {}) }).catch(() => {})
    : null;

export const typing = (target, active = true) => call("send_typing", { chat_jid: jid(target), active }).catch(() => {});
