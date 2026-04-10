import { useState } from "react";

export type ChatLine = { id: string; label: string; body: string; createdAt: string };

type Props = {
  open: boolean;
  onToggleOpen: () => void;
  messages: ChatLine[];
  onSend: (body: string) => void;
};

export function GroupChatPanel({ open, onToggleOpen, messages, onSend }: Props) {
  const [draft, setDraft] = useState("");

  function submit() {
    const t = draft.trim();
    if (!t) return;
    onSend(t);
    setDraft("");
  }

  return (
    <div className={`group-chat ${open ? "group-chat--open" : "group-chat--collapsed"}`}>
      <button type="button" className="group-chat__toggle" onClick={onToggleOpen}>
        {open ? "Contraer chat" : "Chat grupal"}
      </button>
      {open ? (
        <div className="group-chat__body">
          <div className="group-chat__messages">
            {messages.map((m) => (
              <div key={m.id} className="group-chat__line">
                <span className="group-chat__meta">{m.label}</span>
                <span className="group-chat__text">{m.body}</span>
              </div>
            ))}
          </div>
          <div className="group-chat__input-row">
            <input
              className="group-chat__input"
              value={draft}
              placeholder="Mensaje..."
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <button type="button" onClick={submit}>
              Enviar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
