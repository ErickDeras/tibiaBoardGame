import type { InventorySlotRow } from "../types";
import { inventoryWeight } from "../model";

type Props = {
  slots: InventorySlotRow[];
  capacityMax: number;
  onChange: (next: InventorySlotRow[]) => void;
  readOnly?: boolean;
};

export function InventoryPanel({ slots, capacityMax, onChange, readOnly }: Props) {
  const used = inventoryWeight(slots);

  function updateRow(index: number, patch: Partial<InventorySlotRow>) {
    const next = slots.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  }

  function removeRow(index: number) {
    onChange(slots.filter((_, i) => i !== index));
  }

  function addRow() {
    const nextIndex = slots.reduce((m, s) => Math.max(m, s.slotIndex), -1) + 1;
    onChange([
      ...slots,
      { slotIndex: nextIndex, itemName: "Item", weight: 0, quantity: 1 },
    ]);
  }

  return (
    <div className="block">
      <h3>Inventario</h3>
      <p>
        Peso: {used} / {capacityMax} (capacidad max.)
      </p>
      {!readOnly && (
        <button type="button" onClick={addRow}>
          Añadir slot
        </button>
      )}
      {slots.map((row, index) => (
        <div key={`${row.slotIndex}-${index}`} className="cardRow">
          <input
            disabled={readOnly}
            placeholder="Nombre"
            value={row.itemName}
            onChange={(e) => updateRow(index, { itemName: e.target.value })}
          />
          <input
            disabled={readOnly}
            type="number"
            min={0}
            title="Peso"
            value={row.weight}
            onChange={(e) => updateRow(index, { weight: Number(e.target.value) })}
          />
          <input
            disabled={readOnly}
            type="number"
            min={1}
            title="Cantidad"
            value={row.quantity}
            onChange={(e) => updateRow(index, { quantity: Number(e.target.value) })}
          />
          {!readOnly && (
            <button type="button" onClick={() => removeRow(index)}>
              Quitar
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
