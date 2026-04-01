import { useState } from "react";
import { api } from "../api";
import type { ItemTemplate } from "../types";

type Props = {
  items: ItemTemplate[];
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
};

const empty = { name: "", description: "", weight: 0 };

export function ItemTemplatesPanel({ items, onReload, onError }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  function startNew() {
    setEditingId(null);
    setForm({ ...empty, name: "Objeto" });
  }

  function startEdit(t: ItemTemplate) {
    setEditingId(t.id);
    setForm({ name: t.name, description: t.description, weight: t.weight });
  }

  async function save() {
    try {
      const body = {
        name: (form.name ?? "").trim() || "Objeto",
        description: (form.description ?? "").trim(),
        weight: form.weight ?? 0,
      };
      if (editingId) {
        await api<ItemTemplate>(`/item-templates/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api<ItemTemplate>("/item-templates", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      await onReload();
      startNew();
    } catch (e) {
      onError(String(e));
    }
  }

  async function del(id: string) {
    try {
      await api<void>(`/item-templates/${id}`, { method: "DELETE" });
      await onReload();
      if (editingId === id) startNew();
    } catch (e) {
      onError(String(e));
    }
  }

  return (
    <div className="block">
      <h2>Objetos (plantillas)</h2>
      <p className="hint">Catalogo para loot; enlazar desde entradas de loot del bestiario (API).</p>
      <div className="row">
        <button type="button" onClick={startNew}>
          Nueva plantilla
        </button>
      </div>
      {items.map((t) => (
        <div key={t.id} className="item">
          {t.name} ({t.weight}w)
          <div className="row">
            <button type="button" onClick={() => startEdit(t)}>
              Editar
            </button>
            <button type="button" onClick={() => void del(t.id)}>
              Borrar
            </button>
          </div>
        </div>
      ))}
      <div className="block">
        <h3>{editingId ? "Editar" : "Crear"}</h3>
        <label>
          Nombre
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </label>
        <label>
          Descripcion
          <input
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </label>
        <label>
          Peso
          <input
            type="number"
            min={0}
            value={form.weight}
            onChange={(e) => setForm((p) => ({ ...p, weight: Number(e.target.value) }))}
          />
        </label>
        <button type="button" onClick={() => void save()}>
          Guardar
        </button>
      </div>
    </div>
  );
}
