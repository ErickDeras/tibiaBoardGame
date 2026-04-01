import type { GameObject } from "../types";

type Props = {
  objects: GameObject[];
  selectedObjectId: string;
  selectedObject: GameObject | undefined;
  onCellClick: (x: number, y: number, occupant: GameObject | undefined) => void;
};

export function BoardView({ objects, selectedObjectId, selectedObject, onCellClick }: Props) {
  const map = new Map<string, GameObject>();
  objects.forEach((obj) => map.set(`${obj.x}-${obj.y}`, obj));

  return (
    <section className="board">
      {Array.from({ length: 12 * 12 }).map((_, index) => {
        const x = index % 12;
        const y = Math.floor(index / 12);
        const obj = map.get(`${x}-${y}`);
        return (
          <button
            key={`${x}-${y}`}
            type="button"
            className={`cell ${selectedObjectId && selectedObject?.x === x && selectedObject?.y === y ? "active" : ""}`}
            onClick={() => onCellClick(x, y, obj)}
          >
            {obj ? (
              <div className="spriteWrap">
                {obj.spriteUrl ? <img src={obj.spriteUrl} alt={obj.name} className="sprite" /> : "@"}
                <small>
                  {obj.name}
                  {obj.floor != null ? <span className="floorZ"> z{obj.floor}</span> : null}
                </small>
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
  );
}
