import { useState } from "react";
import { api } from "../api";
import type { Board, Dungeon } from "../types";

type Props = {
  boards: Board[];
  dungeons: Dungeon[];
  selectedDungeonId: string;
  setSelectedDungeonId: (id: string) => void;
  selectedBoardId: string;
  setSelectedBoardId: (id: string) => void;
  onDungeonsChange: () => Promise<void>;
  onError: (msg: string) => void;
};

export function DungeonManager({
  boards,
  dungeons,
  selectedDungeonId,
  setSelectedDungeonId,
  selectedBoardId,
  setSelectedBoardId,
  onDungeonsChange,
  onError,
}: Props) {
  const [name, setName] = useState("Nueva mazmorra");
  const [floorBoardPick, setFloorBoardPick] = useState<Record<number, string>>({
    1: "",
    2: "",
    3: "",
    4: "",
  });

  const selected = dungeons.find((d) => d.id === selectedDungeonId);

  async function createDungeon() {
    try {
      await api<Dungeon>("/dungeons", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() || "Mazmorra" }),
      });
      await onDungeonsChange();
    } catch (e) {
      onError(String(e));
    }
  }

  async function assignFloor(floor: number) {
    const boardId = floorBoardPick[floor];
    if (!selectedDungeonId || !boardId) return;
    try {
      await api(`/dungeons/${selectedDungeonId}/floors`, {
        method: "POST",
        body: JSON.stringify({ floor, boardId }),
      });
      await onDungeonsChange();
    } catch (e) {
      onError(String(e));
    }
  }

  function goToFloor(floor: number) {
    const link = selected?.floors.find((f) => f.floor === floor);
    if (link?.boardId) setSelectedBoardId(link.boardId);
  }

  return (
    <div className="block">
      <h2>Mazmorras</h2>
      <div className="row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
        <button type="button" onClick={() => void createDungeon()}>
          Crear
        </button>
      </div>
      <div className="block">
        {dungeons.map((d) => (
          <button
            key={d.id}
            type="button"
            className={d.id === selectedDungeonId ? "item selected" : "item"}
            onClick={() => setSelectedDungeonId(d.id === selectedDungeonId ? "" : d.id)}
          >
            {d.name}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="block">
          <p>
            <strong>{selected.name}</strong> — elige piso para abrir tablero o vincular uno existente.
          </p>
          <div className="row">
            {[1, 2, 3, 4].map((fl) => {
              const link = selected.floors.find((f) => f.floor === fl);
              const active = link?.boardId === selectedBoardId;
              return (
                <button
                  key={fl}
                  type="button"
                  className={active ? "item selected" : "item"}
                  disabled={!link}
                  onClick={() => goToFloor(fl)}
                  title={link ? link.board.name : "Sin tablero"}
                >
                  Piso {fl}
                </button>
              );
            })}
          </div>
          {[1, 2, 3, 4].map((fl) => (
            <div key={fl} className="row">
              <span>Piso {fl}</span>
              <select
                value={floorBoardPick[fl]}
                onChange={(e) =>
                  setFloorBoardPick((p) => ({ ...p, [fl]: e.target.value }))
                }
              >
                <option value="">Tablero…</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => void assignFloor(fl)}>
                Vincular
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
