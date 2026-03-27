import { useEffect, useRef, useState } from "react";
import "./App.css";
import { api } from "./api";
import { API_BASE, FIELD_BY_SLOT } from "./constants";
import { BoardView } from "./components/BoardView";
import { BestiaryPanel } from "./components/BestiaryPanel";
import { DungeonManager } from "./components/DungeonManager";
import { EquipmentCatalog, emptyEquipmentForm } from "./components/EquipmentCatalog";
import { ObjectEditor } from "./components/ObjectEditor";
import { inventoryWeight, normalizeGameObject } from "./model";
import type {
  BaseStats,
  Board,
  CreatureTemplate,
  Dungeon,
  EquipmentValue,
  GameObject,
  ObjectForm,
  SyncObjectPayload,
} from "./types";

/** Alineado al servidor: solo Weapon suma al ataque base; defensa suma todos los slots. */
function equipmentBonuses(items: EquipmentValue[]) {
  return items.reduce(
    (acc, item) => ({
      weaponAttack: acc.weaponAttack + (item.slot === "Weapon" ? item.valueAttack : 0),
      defenseValue: acc.defenseValue + item.valueDefense,
      swordSkill: acc.swordSkill + item.swordSkill,
      axeSkill: acc.axeSkill + item.axeSkill,
      maceSkill: acc.maceSkill + item.maceSkill,
      distanceSkill: acc.distanceSkill + item.distanceSkill,
      shieldingSkill: acc.shieldingSkill + item.shieldingSkill,
      magicLevel: acc.magicLevel + item.magicLevel,
      weight: acc.weight + item.weight,
    }),
    {
      weaponAttack: 0,
      defenseValue: 0,
      swordSkill: 0,
      axeSkill: 0,
      maceSkill: 0,
      distanceSkill: 0,
      shieldingSkill: 0,
      magicLevel: 0,
      weight: 0,
    },
  );
}

function newCard(n: number) {
  return {
    name: `Carta ${n}`,
    description: "",
    deckCategory: "SPELL_ATTACK" as const,
    manaCost: null as number | null,
    staminaCost: null as number | null,
    capacityCost: null as number | null,
    rapidSpell: false,
    spellSkillBonus: 0,
    critMultiplier: null as number | null,
  };
}

const emptyForm: ObjectForm = {
  x: 0,
  y: 0,
  name: "",
  objectKind: "PLAYER",
  profession: "guerrero",
  creatureTemplateId: null,
  helmet: "",
  armor: "",
  legs: "",
  boots: "",
  weapon: "",
  shield: "",
  ring: "",
  necklace: "",
  backpackEquipment: "",
  hitpoints: 100,
  manaPoints: 50,
  staminaPoints: 5,
  attackValue: 0,
  defenseValue: 0,
  magicAttackValue: 0,
  swordSkill: 0,
  axeSkill: 0,
  maceSkill: 0,
  distanceSkill: 0,
  shieldingSkill: 0,
  magicLevel: 0,
  experiencePoints: 0,
  experienceLevel: 1,
  gold: 0,
  manaRegen: 0,
  staminaRegen: 0,
  capacityMax: 400,
  spriteUrl: "",
  inventorySlots: [],
  cards: [newCard(1), newCard(2), newCard(3), newCard(4), newCard(5)],
};

function toSaveBody(form: ObjectForm) {
  return {
    x: form.x,
    y: form.y,
    name: form.name,
    objectKind: form.objectKind,
    profession: form.objectKind === "CREATURE" ? null : form.profession,
    creatureTemplateId: form.creatureTemplateId,
    helmet: form.helmet,
    armor: form.armor,
    legs: form.legs,
    boots: form.boots,
    weapon: form.weapon,
    shield: form.shield,
    ring: form.ring,
    necklace: form.necklace,
    backpackEquipment: form.backpackEquipment,
    hitpoints: form.hitpoints,
    manaPoints: form.manaPoints,
    staminaPoints: form.staminaPoints,
    attackValue: form.attackValue,
    defenseValue: form.defenseValue,
    magicAttackValue: form.magicAttackValue,
    swordSkill: form.swordSkill,
    axeSkill: form.axeSkill,
    maceSkill: form.maceSkill,
    distanceSkill: form.distanceSkill,
    shieldingSkill: form.shieldingSkill,
    magicLevel: form.magicLevel,
    experiencePoints: form.experiencePoints,
    experienceLevel: form.experienceLevel,
    gold: form.gold,
    manaRegen: form.manaRegen,
    staminaRegen: form.staminaRegen,
    capacityMax: form.capacityMax,
    spriteUrl: form.spriteUrl,
    cards: form.cards.map((c) => ({
      name: c.name,
      description: c.description,
      deckCategory: c.deckCategory,
      manaCost: c.manaCost,
      staminaCost: c.staminaCost,
      capacityCost: c.capacityCost,
      rapidSpell: c.rapidSpell,
      spellSkillBonus: c.spellSkillBonus,
      critMultiplier: c.critMultiplier,
    })),
    inventorySlots:
      form.objectKind === "PLAYER"
        ? form.inventorySlots.map((s) => ({
            slotIndex: s.slotIndex,
            itemName: s.itemName,
            weight: s.weight,
            quantity: s.quantity,
          }))
        : [],
  };
}

function App() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [dungeons, setDungeons] = useState<Dungeon[]>([]);
  const [selectedDungeonId, setSelectedDungeonId] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [objects, setObjects] = useState<GameObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string>("");
  const [form, setForm] = useState<ObjectForm>(emptyForm);
  const [boardName, setBoardName] = useState("Nuevo tablero");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const objectsRef = useRef<GameObject[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentValue[]>([]);
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipmentForm);
  const [baseStats, setBaseStats] = useState<BaseStats>({
    attackValue: 0,
    defenseValue: 0,
    swordSkill: 0,
    axeSkill: 0,
    maceSkill: 0,
    distanceSkill: 0,
    shieldingSkill: 0,
    magicLevel: 0,
    capacityMax: 0,
  });
  const [templates, setTemplates] = useState<CreatureTemplate[]>([]);
  const [spawnTemplateId, setSpawnTemplateId] = useState("");
  const [spawnMode, setSpawnMode] = useState(false);
  const [lootBusy, setLootBusy] = useState(false);

  const selectedBoard = boards.find((b) => b.id === selectedBoardId);
  const selectedObject = objects.find((o) => o.id === selectedObjectId);
  const playersOnBoard = objects.filter((o) => o.objectKind === "PLAYER");

  useEffect(() => {
    if (window.location.protocol === "https:" && API_BASE.startsWith("http://")) {
      setError(
        `Configuracion invalida: el sitio usa HTTPS y la API esta en HTTP (${API_BASE}). Usa una URL HTTPS en VITE_API_BASE_URL.`,
      );
    }
  }, []);

  useEffect(() => {
    void loadBoards();
    void loadDungeons();
    void loadTemplates();
  }, []);

  useEffect(() => {
    if (!selectedBoardId) return;
    void loadObjects(selectedBoardId);
    void loadEquipmentItems(selectedBoardId);
  }, [selectedBoardId]);

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  useEffect(() => {
    if (!selectedBoardId) return;

    const autosave = setInterval(() => {
      const payload: { objects: SyncObjectPayload[] } = {
        objects: objectsRef.current.map((obj) => {
          const n = normalizeGameObject(obj);
          return {
            id: n.id,
            x: n.x,
            y: n.y,
            name: n.name,
            objectKind: n.objectKind,
            profession: n.profession,
            creatureTemplateId: n.creatureTemplateId,
            helmet: n.helmet,
            armor: n.armor,
            legs: n.legs,
            boots: n.boots,
            weapon: n.weapon,
            shield: n.shield,
            ring: n.ring,
            necklace: n.necklace,
            backpackEquipment: n.backpackEquipment,
            hitpoints: n.hitpoints,
            manaPoints: n.manaPoints,
            staminaPoints: n.staminaPoints,
            attackValue: n.attackValue,
            defenseValue: n.defenseValue,
            magicAttackValue: n.magicAttackValue,
            swordSkill: n.swordSkill,
            axeSkill: n.axeSkill,
            maceSkill: n.maceSkill,
            distanceSkill: n.distanceSkill,
            shieldingSkill: n.shieldingSkill,
            magicLevel: n.magicLevel,
            experiencePoints: n.experiencePoints,
            experienceLevel: n.experienceLevel,
            gold: n.gold,
            manaRegen: n.manaRegen,
            staminaRegen: n.staminaRegen,
            capacityMax: n.capacityMax,
            spriteUrl: n.spriteUrl,
            cards: n.cards.map((c) => ({
              name: c.name,
              description: c.description,
              deckCategory: c.deckCategory,
              manaCost: c.manaCost,
              staminaCost: c.staminaCost,
              capacityCost: c.capacityCost,
              rapidSpell: c.rapidSpell,
              spellSkillBonus: c.spellSkillBonus,
              critMultiplier: c.critMultiplier,
            })),
            inventorySlots: n.inventorySlots.map((s) => ({
              slotIndex: s.slotIndex,
              itemName: s.itemName,
              weight: s.weight,
              quantity: s.quantity,
            })),
          };
        }),
      };
      void api<{
        created: number;
        updated: number;
        merged: number;
        objects: GameObject[];
      }>(`/boards/${selectedBoardId}/sync`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
        .then((res) => setObjects(res.objects.map(normalizeGameObject)))
        .catch((err) => {
          setError(String(err));
        });
    }, 30_000);

    return () => clearInterval(autosave);
  }, [selectedBoardId]);

  useEffect(() => {
    if (selectedObject) {
      const o = normalizeGameObject(selectedObject);
      setForm({
        x: o.x,
        y: o.y,
        name: o.name,
        objectKind: o.objectKind,
        profession: o.profession,
        creatureTemplateId: o.creatureTemplateId,
        helmet: o.helmet,
        armor: o.armor,
        legs: o.legs,
        boots: o.boots,
        weapon: o.weapon,
        shield: o.shield,
        ring: o.ring,
        necklace: o.necklace,
        backpackEquipment: o.backpackEquipment,
        hitpoints: o.hitpoints,
        manaPoints: o.manaPoints,
        staminaPoints: o.staminaPoints,
        attackValue: o.attackValue,
        defenseValue: o.defenseValue,
        magicAttackValue: o.magicAttackValue,
        swordSkill: o.swordSkill,
        axeSkill: o.axeSkill,
        maceSkill: o.maceSkill,
        distanceSkill: o.distanceSkill,
        shieldingSkill: o.shieldingSkill,
        magicLevel: o.magicLevel,
        experiencePoints: o.experiencePoints,
        experienceLevel: o.experienceLevel,
        gold: o.gold,
        manaRegen: o.manaRegen,
        staminaRegen: o.staminaRegen,
        capacityMax: o.capacityMax,
        spriteUrl: o.spriteUrl,
        cards: o.cards,
        inventorySlots: o.inventorySlots,
      });
      const selectedItems = equipmentItems.filter((item) => {
        const field = FIELD_BY_SLOT[item.slot];
        return o[field] === item.name;
      });
      const bonus = equipmentBonuses(selectedItems);
      setBaseStats({
        attackValue: o.attackValue - bonus.weaponAttack,
        defenseValue: o.defenseValue - bonus.defenseValue,
        swordSkill: o.swordSkill - bonus.swordSkill,
        axeSkill: o.axeSkill - bonus.axeSkill,
        maceSkill: o.maceSkill - bonus.maceSkill,
        distanceSkill: o.distanceSkill - bonus.distanceSkill,
        shieldingSkill: o.shieldingSkill - bonus.shieldingSkill,
        magicLevel: o.magicLevel - bonus.magicLevel,
        capacityMax: o.capacityMax + bonus.weight,
      });
    } else {
      setForm(emptyForm);
      setBaseStats({
        attackValue: 0,
        defenseValue: 0,
        swordSkill: 0,
        axeSkill: 0,
        maceSkill: 0,
        distanceSkill: 0,
        shieldingSkill: 0,
        magicLevel: 0,
        capacityMax: 0,
      });
    }
  }, [selectedObject, equipmentItems]);

  useEffect(() => {
    const selectedItems = equipmentItems.filter((item) => {
      const field = FIELD_BY_SLOT[item.slot];
      return form[field] === item.name;
    });
    const bonus = equipmentBonuses(selectedItems);

    setForm((prev) => {
      const next = {
        attackValue: baseStats.attackValue + bonus.weaponAttack,
        defenseValue: baseStats.defenseValue + bonus.defenseValue,
        swordSkill: baseStats.swordSkill + bonus.swordSkill,
        axeSkill: baseStats.axeSkill + bonus.axeSkill,
        maceSkill: baseStats.maceSkill + bonus.maceSkill,
        distanceSkill: baseStats.distanceSkill + bonus.distanceSkill,
        shieldingSkill: baseStats.shieldingSkill + bonus.shieldingSkill,
        magicLevel: baseStats.magicLevel + bonus.magicLevel,
        capacityMax: Math.max(0, baseStats.capacityMax - bonus.weight),
      };
      if (
        prev.attackValue === next.attackValue &&
        prev.defenseValue === next.defenseValue &&
        prev.swordSkill === next.swordSkill &&
        prev.axeSkill === next.axeSkill &&
        prev.maceSkill === next.maceSkill &&
        prev.distanceSkill === next.distanceSkill &&
        prev.shieldingSkill === next.shieldingSkill &&
        prev.magicLevel === next.magicLevel &&
        prev.capacityMax === next.capacityMax
      ) {
        return prev;
      }
      return { ...prev, ...next };
    });
  }, [
    equipmentItems,
    form.helmet,
    form.armor,
    form.legs,
    form.boots,
    form.weapon,
    form.shield,
    form.necklace,
    form.ring,
    form.backpackEquipment,
    baseStats,
  ]);

  async function loadDungeons() {
    try {
      const data = await api<Dungeon[]>("/dungeons");
      setDungeons(data);
    } catch (err) {
      setError(String(err));
    }
  }

  async function loadTemplates() {
    try {
      const data = await api<CreatureTemplate[]>("/creature-templates");
      setTemplates(data);
    } catch (err) {
      setError(String(err));
    }
  }

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
      setObjects(data.map(normalizeGameObject));
      if (selectedObjectId && !data.some((o) => o.id === selectedObjectId)) {
        setSelectedObjectId("");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadEquipmentItems(boardId: string) {
    try {
      const data = await api<EquipmentValue[]>(`/boards/${boardId}/equipment-items`);
      setEquipmentItems(data);
    } catch (err) {
      setError(String(err));
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
      await loadDungeons();
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
      await loadDungeons();
    } catch (err) {
      setError(String(err));
    }
  }

  async function saveObject() {
    if (!selectedBoardId) return;
    const payload = toSaveBody(form);

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

  async function trySpawnCreature(x: number, y: number) {
    if (!selectedBoardId || !spawnTemplateId) return;
    try {
      await api<GameObject>(`/boards/${selectedBoardId}/spawn-creature`, {
        method: "POST",
        body: JSON.stringify({ templateId: spawnTemplateId, x, y }),
      });
      await loadObjects(selectedBoardId);
    } catch (err) {
      setError(String(err));
    }
  }

  async function collectLoot(collectorObjectId: string) {
    if (!selectedObjectId || !selectedBoardId) return;
    setLootBusy(true);
    setError("");
    try {
      await api(`/objects/${selectedObjectId}/collect-loot`, {
        method: "POST",
        body: JSON.stringify({ collectorObjectId }),
      });
      await loadObjects(selectedBoardId);
    } catch (err) {
      setError(String(err));
    } finally {
      setLootBusy(false);
    }
  }

  function handleCellClick(_x: number, _y: number, occupant: GameObject | undefined) {
    if (occupant) {
      setSelectedObjectId(occupant.id);
      return;
    }
    if (spawnMode && spawnTemplateId) {
      void trySpawnCreature(_x, _y);
      return;
    }
    void moveSelectedObject(_x, _y);
  }

  return (
    <main className="layout">
      <aside className="sidebar">
        <h1>Tableros</h1>
        <DungeonManager
          boards={boards}
          dungeons={dungeons}
          selectedDungeonId={selectedDungeonId}
          setSelectedDungeonId={setSelectedDungeonId}
          selectedBoardId={selectedBoardId}
          setSelectedBoardId={setSelectedBoardId}
          onDungeonsChange={loadDungeons}
          onError={setError}
        />

        <div className="block">
          <h2>Lista de tableros</h2>
          <input value={boardName} onChange={(e) => setBoardName(e.target.value)} />
          <div className="row">
            <button type="button" onClick={() => void createBoard()}>
              Crear
            </button>
            <button type="button" onClick={() => void renameBoard()} disabled={!selectedBoardId}>
              Renombrar
            </button>
            <button type="button" onClick={() => void deleteBoard()} disabled={!selectedBoardId}>
              Eliminar
            </button>
          </div>
          {boards.map((board) => (
            <button
              key={board.id}
              type="button"
              className={board.id === selectedBoardId ? "item selected" : "item"}
              onClick={() => {
                setSelectedBoardId(board.id);
                setSelectedDungeonId("");
              }}
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
              type="button"
              className={obj.id === selectedObjectId ? "item selected" : "item"}
              onClick={() => setSelectedObjectId(obj.id)}
            >
              {obj.name} ({obj.objectKind}
              {obj.profession ? ` / ${obj.profession}` : ""}) [{obj.x},{obj.y}] inv{" "}
              {inventoryWeight(obj.inventorySlots)}w
            </button>
          ))}
        </div>

        <EquipmentCatalog
          selectedBoardId={selectedBoardId}
          equipmentForm={equipmentForm}
          setEquipmentForm={setEquipmentForm}
          equipmentItems={equipmentItems}
          onAfterSave={() => loadEquipmentItems(selectedBoardId)}
          onError={setError}
        />

        <BestiaryPanel
          templates={templates}
          onReload={async () => {
            await loadTemplates();
          }}
          onError={setError}
          spawnTemplateId={spawnTemplateId}
          setSpawnTemplateId={setSpawnTemplateId}
          spawnMode={spawnMode}
          setSpawnMode={setSpawnMode}
        />
      </aside>

      <section className="main">
        <header className="toolbar">
          <h2>{selectedBoard ? `Tablero: ${selectedBoard.name}` : "Sin tablero"}</h2>
          {loading && <span>Cargando...</span>}
          {error && <span className="error">{error}</span>}
        </header>

        <BoardView
          objects={objects}
          selectedObjectId={selectedObjectId}
          selectedObject={selectedObject}
          onCellClick={handleCellClick}
        />
      </section>

      <ObjectEditor
        form={form}
        setForm={setForm}
        baseStats={baseStats}
        setBaseStats={setBaseStats}
        equipmentItems={equipmentItems}
        selectedObjectId={selectedObjectId}
        selectedBoardId={selectedBoardId}
        playersOnBoard={playersOnBoard}
        onSave={saveObject}
        onRemove={removeObject}
        onNew={() => setSelectedObjectId("")}
        onCollectLoot={(collectorId) => void collectLoot(collectorId)}
        lootBusy={lootBusy}
      />
    </main>
  );
}

export default App;
