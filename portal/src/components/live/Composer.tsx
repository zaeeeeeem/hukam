// Send a command to Hukam as the owner, exactly as if typed on WhatsApp. Replies go to the chosen chat.
import { ArrowUp, ChevronDown, Laptop } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { phone } from "../../lib/format";
import { usePortal } from "../../lib/store";

export type ComposerHandle = { fill: (text: string) => void; focus: () => void };

export const Composer = forwardRef<ComposerHandle, { onSent?: (trace: string) => void }>(function Composer({ onSent }, ref) {
  const { state, command, demo } = usePortal();
  const [text, setText] = useState("");
  const [chat, setChat] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    fill: (t: string) => {
      setText(t);
      requestAnimationFrame(() => input.current?.focus());
    },
    focus: () => input.current?.focus(),
  }));

  const chats = state
    ? [
        { id: "", label: `Owner DM · ${phone(state.owner.phone)}` },
        ...state.chats.filter((c) => c.allowed && c.kind === "group").map((c) => ({ id: c.id, label: `Group · ${c.label}` })),
        ...state.settings.allow.filter((p) => p !== state.owner.phone).map((p) => ({ id: p, label: `DM · ${phone(p)}` })),
      ]
    : [{ id: "", label: "Owner DM" }];

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    const trace = await command(t, chat || undefined);
    setBusy(false);
    if (trace) {
      setText("");
      onSent?.(trace);
    }
  }

  return (
    <form
      className="flex shrink-0 flex-col gap-2 border-t border-white/[0.06] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <div className="rounded-[16px] border border-white/10 bg-black/50 transition-colors focus-within:border-white/25">
        <label htmlFor="hukam-command" className="sr-only">
          Command for Hukam
        </label>
        <textarea
          id="hukam-command"
          ref={input}
          rows={2}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Tell Hukam what to do, e.g. claude: add a contact form"
          className="block max-h-36 min-h-[52px] w-full resize-none bg-transparent px-3.5 pt-3 text-[13px] leading-relaxed text-white placeholder:text-white/30 focus:outline-none focus-visible:outline-none"
        />
        <div className="flex items-center gap-2 px-2 pb-2">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="hukam-chat" className="sr-only">
              Reply goes to
            </label>
            <select
              id="hukam-chat"
              value={chat}
              onChange={(e) => setChat(e.target.value)}
              className="h-8 w-full max-w-full min-w-0 cursor-pointer appearance-none truncate rounded-full border border-white/10 bg-white/[0.04] pr-8 pl-3 text-[12px] text-white/75 transition-colors hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-st-active/40"
            >
              {chats.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#111] text-white">
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-white/45" />
          </div>
          <button
            type="submit"
            disabled={!text.trim() || busy}
            aria-label="Send command"
            className="relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-fu-orange/60 bg-[linear-gradient(180deg,rgba(218,78,36,0.22),rgba(31,119,246,0.18))] px-3.5 text-[12px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_0_1px_rgba(31,119,246,0.25)] transition-[opacity,transform] hover:brightness-125 active:scale-[0.98] disabled:opacity-40"
          >
            <ArrowUp className="size-3.5" strokeWidth={2.4} />
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
      <p className="flex items-center gap-1.5 px-1 text-[11px] leading-snug text-white/35">
        <Laptop className="size-3 shrink-0" />
        {demo ? "Demo: simulated locally, nothing is sent." : "Runs as the owner. Hukam replies on WhatsApp in the chosen chat."}
        <span className="ml-auto hidden shrink-0 whitespace-nowrap xl:inline">Enter to send · Shift+Enter new line</span>
      </p>
    </form>
  );
});
