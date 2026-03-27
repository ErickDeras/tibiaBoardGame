import { EQUIPMENT_SLOTS } from "../constants";
import type { EquipmentEditorForm, EquipmentSlot, EquipmentValue } from "../types";
import { api } from "../api";

type Props = {
  selectedBoardId: string;
  equipmentForm: EquipmentEditorForm;
  setEquipmentForm: React.Dispatch<React.SetStateAction<EquipmentEditorForm>>;
  equipmentItems: EquipmentValue[];
  onAfterSave: () => Promise<void>;
  onError: (msg: string) => void;
};

export function EquipmentCatalog({
  selectedBoardId,
  equipmentForm,
  setEquipmentForm,
  equipmentItems,
  onAfterSave,
  onError,
}: Props) {
  async function upsertEquipmentItem() {
    if (!equipmentForm.name.trim() || !selectedBoardId) return;
    try {
      if (equipmentForm.id) {
        await api<EquipmentValue>(`/equipment-items/${equipmentForm.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...equipmentForm, name: equipmentForm.name.trim() }),
        });
      } else {
        await api<EquipmentValue>(`/boards/${selectedBoardId}/equipment-items`, {
          method: "POST",
          body: JSON.stringify({ ...equipmentForm, name: equipmentForm.name.trim() }),
        });
      }
      await onAfterSave();
      setEquipmentForm(emptyEquipmentForm);
    } catch (err) {
      onError(String(err));
    }
  }

  async function removeEquipmentItem(id: string) {
    if (!selectedBoardId) return;
    try {
      await api<void>(`/equipment-items/${id}`, { method: "DELETE" });
      await onAfterSave();
    } catch (err) {
      onError(String(err));
    }
  }

  return (
    <div className="block">
      <h2>Editor de equipo</h2>
      <label>
        Slot
        <select
          value={equipmentForm.slot}
          onChange={(e) =>
            setEquipmentForm((prev) => ({ ...prev, slot: e.target.value as EquipmentSlot }))
          }
        >
          {EQUIPMENT_SLOTS.map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </select>
      </label>
      <label>
        Nombre
        <input
          value={equipmentForm.name}
          onChange={(e) => setEquipmentForm((prev) => ({ ...prev, name: e.target.value }))}
        />
      </label>
      <div className="row3">
        <label>
          Atk
          <input
            type="number"
            min={0}
            value={equipmentForm.valueAttack}
            onChange={(e) =>
              setEquipmentForm((prev) => ({ ...prev, valueAttack: Number(e.target.value) }))
            }
          />
        </label>
        <label>
          Def
          <input
            type="number"
            min={0}
            value={equipmentForm.valueDefense}
            onChange={(e) =>
              setEquipmentForm((prev) => ({ ...prev, valueDefense: Number(e.target.value) }))
            }
          />
        </label>
        <label>
          Weight
          <input
            type="number"
            min={0}
            value={equipmentForm.weight}
            onChange={(e) =>
              setEquipmentForm((prev) => ({ ...prev, weight: Number(e.target.value) }))
            }
          />
        </label>
      </div>
      <div className="row3">
        <label>
          Sword
          <input
            type="number"
            min={0}
            value={equipmentForm.swordSkill}
            onChange={(e) =>
              setEquipmentForm((prev) => ({ ...prev, swordSkill: Number(e.target.value) }))
            }
          />
        </label>
        <label>
          Axe
          <input
            type="number"
            min={0}
            value={equipmentForm.axeSkill}
            onChange={(e) =>
              setEquipmentForm((prev) => ({ ...prev, axeSkill: Number(e.target.value) }))
            }
          />
        </label>
        <label>
          Mace
          <input
            type="number"
            min={0}
            value={equipmentForm.maceSkill}
            onChange={(e) =>
              setEquipmentForm((prev) => ({ ...prev, maceSkill: Number(e.target.value) }))
            }
          />
        </label>
      </div>
      <div className="row3">
        <label>
          Distance
          <input
            type="number"
            min={0}
            value={equipmentForm.distanceSkill}
            onChange={(e) =>
              setEquipmentForm((prev) => ({ ...prev, distanceSkill: Number(e.target.value) }))
            }
          />
        </label>
        <label>
          Shielding
          <input
            type="number"
            min={0}
            value={equipmentForm.shieldingSkill}
            onChange={(e) =>
              setEquipmentForm((prev) => ({ ...prev, shieldingSkill: Number(e.target.value) }))
            }
          />
        </label>
        <label>
          Magic
          <input
            type="number"
            min={0}
            value={equipmentForm.magicLevel}
            onChange={(e) =>
              setEquipmentForm((prev) => ({ ...prev, magicLevel: Number(e.target.value) }))
            }
          />
        </label>
      </div>
      <div className="row">
        <button type="button" onClick={() => void upsertEquipmentItem()}>
          Guardar item
        </button>
        <button type="button" onClick={() => setEquipmentForm(emptyEquipmentForm)}>
          Limpiar
        </button>
      </div>
      {equipmentItems.map((item) => (
        <div key={item.id} className="item">
          [{item.slot}] {item.name} (Atk {item.valueAttack} / Def {item.valueDefense} / W {item.weight})
          <div className="row">
            <button type="button" onClick={() => setEquipmentForm({ ...item })}>
              Editar
            </button>
            <button type="button" onClick={() => void removeEquipmentItem(item.id)}>
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const emptyEquipmentForm: EquipmentEditorForm = {
  slot: "Helmet",
  name: "",
  valueAttack: 0,
  valueDefense: 0,
  swordSkill: 0,
  axeSkill: 0,
  maceSkill: 0,
  distanceSkill: 0,
  shieldingSkill: 0,
  magicLevel: 0,
  weight: 0,
};

export { emptyEquipmentForm };
