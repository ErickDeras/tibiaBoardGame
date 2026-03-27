import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

type Profession = "mago" | "guerrero" | "paladin" | "druida";

type Card = {
  id?: string;
  name: string;
  description: string;
};

type Board = {
  id: string;
  name: string;
  width: number;
  height: number;
  _count?: { objects: number };
};

type GameObject = {
  id: string;
  boardId: string;
  x: number;
  y: number;
  name: string;
  profession: Profession;
  helmet: string;
  armor: string;
  legs: string;
  boots: string;
  weapon: string;
  shield: string;
  ring: string;
  necklace: string;
  backpack: string;
  hitpoints: number;
  manaPoints: number;
  staminaPoints: number;
  spriteUrl: string;
  cards: Card[];
};

type ObjectForm = Omit<GameObject, "id" | "boardId">;
type SyncObjectPayload = Omit<GameObject, "boardId">;

const RAW_API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  "http://localhost:4000";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

const newCard = (n: number): Card => ({ name: `Carta ${n}`, description: "" });

const emptyForm: ObjectForm = {
  x: 0,
  y: 0,
  name: "",
  profession: "guerrero",
  helmet: "",
  armor: "",
  legs: "",
  boots: "",
  weapon: "",
  shield: "",
  ring: "",
  necklace: "",
  backpack: "",
  hitpoints: 100,
  manaPoints: 50,
  staminaPoints: 5,
  spriteUrl: "",
  cards: [newCard(1), newCard(2), newCard(3), newCard(4), newCard(5)],
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch {
    throw new Error(
      `No se pudo conectar con la API (${API_BASE}). Verifica VITE_API_BASE_URL y que el backend este activo con HTTPS.`,
    );
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Error de API");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function App() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [objects, setObjects] = useState<GameObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string>("");
  const [form, setForm] = useState<ObjectForm>(emptyForm);
  const [boardName, setBoardName] = useState("Nuevo tablero");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const objectsRef = useRef<GameObject[]>([]);

  const selectedBoard = boards.find((b) => b.id === selectedBoardId);
  const selectedObject = objects.find((o) => o.id === selectedObjectId);

  useEffect(() => {
    if (window.location.protocol === "https:" && API_BASE.startsWith("http://")) {
      setError(
        `Configuracion invalida: el sitio usa HTTPS y la API esta en HTTP (${API_BASE}). Usa una URL HTTPS en VITE_API_BASE_URL.`,
      );
    }
  }, []);

  useEffect(() => {
    void loadBoards();
  }, []);

  useEffect(() => {
    if (!selectedBoardId) return;
    void loadObjects(selectedBoardId);
  }, [selectedBoardId]);

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  useEffect(() => {
    if (!selectedBoardId) return;

    const autosave = setInterval(() => {
      const payload: { objects: SyncObjectPayload[] } = {
        objects: objectsRef.current.map((obj) => ({ ...obj })),
      };
      void api(`/boards/${selectedBoardId}/sync`, {
        method: "POST",
        body: JSON.stringify(payload),
      }).catch((err) => {
        setError(String(err));
      });
    }, 30_000);

    return () => clearInterval(autosave);
  }, [selectedBoardId]);

  useEffect(() => {
    if (selectedObject) {
      setForm({
        x: selectedObject.x,
        y: selectedObject.y,
        name: selectedObject.name,
        profession: selectedObject.profession,
        helmet: selectedObject.helmet,
        armor: selectedObject.armor,
        legs: selectedObject.legs,
        boots: selectedObject.boots,
        weapon: selectedObject.weapon,
        shield: selectedObject.shield,
        ring: selectedObject.ring,
        necklace: selectedObject.necklace,
        backpack: selectedObject.backpack,
        hitpoints: selectedObject.hitpoints,
        manaPoints: selectedObject.manaPoints,
        staminaPoints: selectedObject.staminaPoints,
        spriteUrl: selectedObject.spriteUrl,
        cards: selectedObject.cards.map((card) => ({
          name: card.name,
          description: card.description,
        })),
      });
    } else {
      setForm(emptyForm);
    }
  }, [selectedObject]);

  const objectByCell = useMemo(() => {
    const map = new Map<string, GameObject>();
    objects.forEach((obj) => map.set(`${obj.x}-${obj.y}`, obj));
    return map;
  }, [objects]);

  async function loadBoards() {
    setLoading(true);
    setError("");
    try {
      const data = await api<Board[]>("/boards");
      setBoards(data);
      if (!selectedBoardId && data[0]) setSelectedBoardId(data[0].id);
      if (selectedBoardId && !data.some((b) => b.id === selectedBoardId)) {
        setSelectedBoardId(data[0]?.id ?? "");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadObjects(boardId: string) {
    setLoading(true);
    setError("");
    try {
      const data = await api<GameObject[]>(`/boards/${boardId}/objects`);
      setObjects(data);
      if (selectedObjectId && !data.some((o) => o.id === selectedObjectId)) {
        setSelectedObjectId("");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function createBoard() {
    try {
      await api<Board>("/boards", {
        method: "POST",
        body: JSON.stringify({ name: boardName.trim() || "Tablero" }),
      });
      await loadBoards();
    } catch (err) {
      setError(String(err));
    }
  }

  async function renameBoard() {
    if (!selectedBoardId) return;
    try {
      await api<Board>(`/boards/${selectedBoardId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: boardName.trim() || "Tablero" }),
      });
      await loadBoards();
    } catch (err) {
      setError(String(err));
    }
  }

  async function deleteBoard() {
    if (!selectedBoardId) return;
    try {
      await api<void>(`/boards/${selectedBoardId}`, { method: "DELETE" });
      setObjects([]);
      setSelectedObjectId("");
      await loadBoards();
    } catch (err) {
      setError(String(err));
    }
  }

  async function saveObject() {
    if (!selectedBoardId) return;
    const payload = { ...form };

    try {
      if (selectedObjectId) {
        await api<GameObject>(`/objects/${selectedObjectId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await api<GameObject>(`/boards/${selectedBoardId}/objects`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await loadObjects(selectedBoardId);
    } catch (err) {
      setError(String(err));
    }
  }

  async function removeObject() {
    if (!selectedObjectId || !selectedBoardId) return;
    try {
      await api<void>(`/objects/${selectedObjectId}`, { method: "DELETE" });
      setSelectedObjectId("");
      await loadObjects(selectedBoardId);
    } catch (err) {
      setError(String(err));
    }
  }

  async function moveSelectedObject(x: number, y: number) {
    if (!selectedObjectId || !selectedBoardId) return;
    try {
      await api(`/objects/${selectedObjectId}/move`, {
        method: "POST",
        body: JSON.stringify({ x, y }),
      });
      await loadObjects(selectedBoardId);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <main className="layout">
      <aside className="sidebar">
        <h1>Tableros</h1>
        <div className="block">
          <input value={boardName} onChange={(e) => setBoardName(e.target.value)} />
          <div className="row">
            <button onClick={() => void createBoard()}>Crear</button>
            <button onClick={() => void renameBoard()} disabled={!selectedBoardId}>
              Renombrar
            </button>
            <button onClick={() => void deleteBoard()} disabled={!selectedBoardId}>
              Eliminar
            </button>
          </div>
        </div>

        <div className="block">
          <h2>Lista de tableros</h2>
          {boards.map((board) => (
            <button
              key={board.id}
              className={board.id === selectedBoardId ? "item selected" : "item"}
              onClick={() => setSelectedBoardId(board.id)}
            >
              {board.name}
            </button>
          ))}
        </div>

        <div className="block">
          <h2>Objetos ({objects.length})</h2>
          {objects.map((obj) => (
            <button
              key={obj.id}
              className={obj.id === selectedObjectId ? "item selected" : "item"}
              onClick={() => setSelectedObjectId(obj.id)}
            >
              {obj.name} ({obj.profession}) [{obj.x},{obj.y}]
            </button>
          ))}
        </div>
      </aside>

      <section className="main">
        <header className="toolbar">
          <h2>{selectedBoard ? `Tablero: ${selectedBoard.name}` : "Sin tablero"}</h2>
          {loading && <span>Cargando...</span>}
          {error && <span className="error">{error}</span>}
        </header>

        <section className="board">
          {Array.from({ length: 12 * 12 }).map((_, index) => {
            const x = index % 12;
            const y = Math.floor(index / 12);
            const obj = objectByCell.get(`${x}-${y}`);
            return (
              <button
                key={`${x}-${y}`}
                className={`cell ${selectedObjectId && selectedObject?.x === x && selectedObject?.y === y ? "active" : ""}`}
                onClick={() => {
                  if (obj) {
                    setSelectedObjectId(obj.id);
                    return;
                  }
                  void moveSelectedObject(x, y);
                }}
              >
                {obj ? (
                  <div className="spriteWrap">
                    {obj.spriteUrl ? <img src={obj.spriteUrl} alt={obj.name} className="sprite" /> : "@"}
                    <small>{obj.name}</small>
                  </div>
                ) : (
                  <span className="coords">
                    {x},{y}
                  </span>
                )}
              </button>
            );
          })}
        </section>
      </section>

      <aside className="editor">
        <h2>{selectedObjectId ? "Editar objeto" : "Crear objeto"}</h2>
        <div className="form">
          <label>
            Nombre
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>
          <label>
            Profesion
            <select
              value={form.profession}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, profession: e.target.value as Profession }))
              }
            >
              <option value="mago">mago</option>
              <option value="guerrero">guerrero</option>
              <option value="paladin">paladin</option>
              <option value="druida">druida</option>
            </select>
          </label>

          <div className="row3">
            <label>
              X
              <input
                type="number"
                min={0}
                max={11}
                value={form.x}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, x: Number(e.target.value) }))
                }
              />
            </label>
            <label>
              Y
              <input
                type="number"
                min={0}
                max={11}
                value={form.y}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, y: Number(e.target.value) }))
                }
              />
            </label>
            <label>
              Sprite URL
              <input
                value={form.spriteUrl}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, spriteUrl: e.target.value }))
                }
              />
            </label>
          </div>

          <div className="row3">
            <label>
              HP
              <input
                type="number"
                min={0}
                value={form.hitpoints}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, hitpoints: Number(e.target.value) }))
                }
              />
            </label>
            <label>
              Mana
              <input
                type="number"
                min={0}
                value={form.manaPoints}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, manaPoints: Number(e.target.value) }))
                }
              />
            </label>
            <label>
              Stamina
              <input
                type="number"
                min={0}
                value={form.staminaPoints}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, staminaPoints: Number(e.target.value) }))
                }
              />
            </label>
          </div>

          {(
            [
              "helmet",
              "armor",
              "legs",
              "boots",
              "weapon",
              "shield",
              "ring",
              "necklace",
              "backpack",
            ] as const
          ).map((key) => (
            <label key={key}>
              {key}
              <input
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </label>
          ))}

          <h3>Cartas (5)</h3>
          {form.cards.map((card, idx) => (
            <div className="cardRow" key={idx}>
              <input
                placeholder={`Carta ${idx + 1} nombre`}
                value={card.name}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    cards: prev.cards.map((c, i) =>
                      i === idx ? { ...c, name: e.target.value } : c,
                    ),
                  }))
                }
              />
              <input
                placeholder="Descripcion"
                value={card.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    cards: prev.cards.map((c, i) =>
                      i === idx ? { ...c, description: e.target.value } : c,
                    ),
                  }))
                }
              />
            </div>
          ))}

          <div className="row">
            <button onClick={() => void saveObject()} disabled={!selectedBoardId || !form.name.trim()}>
              {selectedObjectId ? "Guardar cambios" : "Crear objeto"}
            </button>
            <button onClick={() => setSelectedObjectId("")}>Nuevo</button>
            <button onClick={() => void removeObject()} disabled={!selectedObjectId}>
              Eliminar
            </button>
          </div>

          {form.spriteUrl && (
            <div className="preview">
              <img src={form.spriteUrl} alt="preview" />
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}

export default App;
