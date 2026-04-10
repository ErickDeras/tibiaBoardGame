import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import "./App.css";
import { api } from "./api";
import { API_BASE, FIELD_BY_SLOT, LIVE_SESSION_TOKEN_KEY } from "./constants";
import { GroupChatPanel } from "./components/GroupChatPanel";
import { useSharedRoomRealtime, type ChatEntry } from "./hooks/useSharedRoomRealtime";
import { BoardView } from "./components/BoardView";
import { BestiaryPanel } from "./components/BestiaryPanel";
import { CardTemplatesPanel } from "./components/CardTemplatesPanel";
import { CombatBar } from "./components/CombatBar";
import { PlayerCombatActions } from "./components/PlayerCombatActions";
import { useCombatPlayerTurn } from "./hooks/useCombatPlayerTurn";
import { CombatLog } from "./components/CombatLog";
import { DungeonManager } from "./components/DungeonManager";
import { ItemTemplatesPanel } from "./components/ItemTemplatesPanel";
import { EquipmentCatalog, emptyEquipmentForm } from "./components/EquipmentCatalog";
import { ObjectEditor } from "./components/ObjectEditor";
import {
  experienceLevelFromTotalXp,
  inventoryWeight,
  normalizeGameObject,
  playerAttackLevelBonusPerStep,
  playerDefenseLevelBonusPerStep,
  playerHitpointsManaBaseFromStored,
  playerHpManaBonusPerLevel,
  playerMagicLevelBonusPerStep,
  shieldingDefensePointsFromSkill,
  skillAttackPointsForProfession,
} from "./model";
import type {
  BaseStats,
  Board,
  CardTemplate,
  CombatSession,
  CreatureTemplate,
  Dungeon,
  EquipmentValue,
  GameObject,
  ItemTemplate,
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
  cards: [],
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
      damageSkill: c.damageSkill,
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

export type BoardGamePageProps = {
  sharedMode?: boolean;
  forcedBoardId?: string | null;
};

export function BoardGamePage({
  sharedMode = false,
  forcedBoardId = null,
}: BoardGamePageProps) {
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
  const selectedBoardIdRef = useRef(selectedBoardId);
  const lastAutosaveHashRef = useRef<string>("");
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
  const [cardTemplates, setCardTemplates] = useState<CardTemplate[]>([]);
  const [itemTemplates, setItemTemplates] = useState<ItemTemplate[]>([]);
  const [combatSession, setCombatSession] = useState<CombatSession | null>(null);
  const [combatTargetId, setCombatTargetId] = useState("");
  const [combatBusy, setCombatBusy] = useState(false);
  const [spawnTemplateId, setSpawnTemplateId] = useState("");
  const [spawnMode, setSpawnMode] = useState(false);
  const [lootBusy, setLootBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([]);
  const [chatOpen, setChatOpen] = useState(false);

  const selectedBoard = boards.find((b) => b.id === selectedBoardId);
  const selectedObject = objects.find((o) => o.id === selectedObjectId);
  const playersOnBoard = objects.filter((o) => o.objectKind === "PLAYER");
  const isPlayerCombatTurn =
    combatSession?.status === "ACTIVE" &&
    Boolean(selectedObjectId) &&
    selectedObjectId === combatSession.currentActorId &&
    selectedObject?.objectKind === "PLAYER";

  const refreshCombatFor = useCallback(async (boardId: string) => {
    try {
      const r = await api<{ session: CombatSession | null }>(`/boards/${boardId}/combat`);
      setCombatSession(r.session);
    } catch {
      setCombatSession(null);
    }
  }, []);

  const onCombatObjectsUpdate = useCallback((next: GameObject[]) => {
    setObjects(next);
    objectsRef.current = next;
  }, []);

  const onCombatRefresh = useCallback(async () => {
    if (selectedBoardId) await refreshCombatFor(selectedBoardId);
  }, [selectedBoardId, refreshCombatFor]);

  const playerTurn = useCombatPlayerTurn({
    boardId: selectedBoardId,
    session: combatSession,
    objects,
    selectedObjectId,
    setCombatBusy,
    onObjectsUpdate: onCombatObjectsUpdate,
    onRefreshCombat: onCombatRefresh,
    onError: setError,
  });

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
    void loadCardTemplates();
    void loadItemTemplates();
  }, []);

  useEffect(() => {
    if (sharedMode && forcedBoardId) {
      setSelectedBoardId(forcedBoardId);
    }
  }, [sharedMode, forcedBoardId]);

  useEffect(() => {
    if (!selectedBoardId) return;
    setCombatTargetId("");
    void loadObjects(selectedBoardId);
    void loadEquipmentItems(selectedBoardId);
    void refreshCombatFor(selectedBoardId);
  }, [selectedBoardId]);

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  useEffect(() => {
    selectedBoardIdRef.current = selectedBoardId;
  }, [selectedBoardId]);

  useEffect(() => {
    if (selectedObjectId && !objects.some((o) => o.id === selectedObjectId)) {
      setSelectedObjectId("");
    }
  }, [objects, selectedObjectId]);

  const combatActive = combatSession?.status === "ACTIVE";

  useEffect(() => {
    if (!selectedBoardId || combatActive) return;

    const autosave = setInterval(() => {
      const payload: { objects: SyncObjectPayload[] } = {
        objects: objectsRef.current.map((obj) => {
          const n = normalizeGameObject(obj);
          // Nivel efectivo desde XP (como el backend), no solo experienceLevel en caché,
          // para que tras ganar XP en combate el sync no envíe bases de vida/maná incorrectas.
          const levelForDerivation =
            n.objectKind === "PLAYER" ? experienceLevelFromTotalXp(n.experiencePoints) : n.experienceLevel;
          const steps = Math.max(0, levelForDerivation - 1);
          const vitalGain = playerHpManaBonusPerLevel(n.profession);
          const hpBase =
            n.objectKind === "PLAYER"
              ? Math.max(0, n.hitpoints - steps * vitalGain.hitpoints)
              : n.hitpoints;
          const mpBase =
            n.objectKind === "PLAYER"
              ? Math.max(0, n.manaPoints - steps * vitalGain.manaPoints)
              : n.manaPoints;
          const mlPerStep = playerMagicLevelBonusPerStep(n.profession);
          const mlBase =
            n.objectKind === "PLAYER"
              ? Math.max(0, n.magicLevel - steps * mlPerStep)
              : n.magicLevel;
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
            hitpoints: hpBase,
            manaPoints: mpBase,
            staminaPoints: n.staminaPoints,
            attackValue: n.attackValue,
            defenseValue: n.defenseValue,
            magicAttackValue: n.magicAttackValue,
            swordSkill: n.swordSkill,
            axeSkill: n.axeSkill,
            maceSkill: n.maceSkill,
            distanceSkill: n.distanceSkill,
            shieldingSkill: n.shieldingSkill,
            magicLevel: mlBase,
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
              damageSkill: c.damageSkill,
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

      // En producción, reemplazar el estado entero en cada autosave puede verse como “refresh”
      // (parpadeo / pantalla en blanco si algo falla durante el render). Así que:
      // - si no hay cambios reales, no sincronizamos
      // - si sincronizamos, SOLO reemplazamos `objects` si el server hizo cambios
      const hash = JSON.stringify(payload);
      if (hash === lastAutosaveHashRef.current) return;

      void api<{
        created: number;
        updated: number;
        merged: number;
        objects: GameObject[];
      }>(`/boards/${selectedBoardId}/sync`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
        .then((res) => {
          lastAutosaveHashRef.current = hash;
          if (res.created > 0 || res.updated > 0) {
            setObjects(res.objects.map(normalizeGameObject));
          }
        })
        .catch((err) => {
          setError(String(err));
        });
    }, 30_000);

    return () => clearInterval(autosave);
  }, [selectedBoardId, combatActive]);

  useEffect(() => {
    if (selectedObject) {
      const o = normalizeGameObject(selectedObject);
      const vitalsBase = playerHitpointsManaBaseFromStored(
        o.objectKind,
        o.profession,
        o.experienceLevel,
        o.hitpoints,
        o.manaPoints,
      );
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
        hitpoints: vitalsBase.hitpoints,
        manaPoints: vitalsBase.manaPoints,
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
      const lvSteps = o.objectKind === "PLAYER" ? Math.max(0, o.experienceLevel - 1) : 0;
      const mlLv = lvSteps * playerMagicLevelBonusPerStep(o.profession);
      if (o.objectKind === "PLAYER") {
        setBaseStats({
          attackValue: 0,
          defenseValue: 0,
          swordSkill: o.swordSkill - bonus.swordSkill,
          axeSkill: o.axeSkill - bonus.axeSkill,
          maceSkill: o.maceSkill - bonus.maceSkill,
          distanceSkill: o.distanceSkill - bonus.distanceSkill,
          shieldingSkill: o.shieldingSkill - bonus.shieldingSkill,
          magicLevel: o.magicLevel - bonus.magicLevel - mlLv,
          capacityMax: o.capacityMax + bonus.weight,
        });
      } else {
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
      }
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

    const L = experienceLevelFromTotalXp(form.experiencePoints);
    const steps = form.objectKind === "PLAYER" ? Math.max(0, L - 1) : 0;
    const atkStep = playerAttackLevelBonusPerStep(form.profession);
    const defStep = playerDefenseLevelBonusPerStep(form.profession);
    const mlStep = playerMagicLevelBonusPerStep(form.profession);

    setForm((prev) => {
      let nextAttack: number;
      let nextDefense: number;
      let nextMagicLevel: number;
      let nextMagicAttack: number;

      if (prev.objectKind === "PLAYER") {
        const charMagicBase = baseStats.magicLevel + bonus.magicLevel;
        const swordT = baseStats.swordSkill + bonus.swordSkill;
        const axeT = baseStats.axeSkill + bonus.axeSkill;
        const maceT = baseStats.maceSkill + bonus.maceSkill;
        const distT = baseStats.distanceSkill + bonus.distanceSkill;
        const shieldT = baseStats.shieldingSkill + bonus.shieldingSkill;
        const atkFromSkills = skillAttackPointsForProfession(prev.profession, {
          swordSkill: swordT,
          axeSkill: axeT,
          maceSkill: maceT,
          distanceSkill: distT,
          magicBase: charMagicBase,
        });
        const shieldPts = shieldingDefensePointsFromSkill(shieldT);
        nextAttack = atkFromSkills + bonus.weaponAttack + steps * atkStep;
        nextDefense = bonus.defenseValue + shieldPts + steps * defStep;
        nextMagicLevel = charMagicBase + steps * mlStep;
        nextMagicAttack = nextMagicLevel;
      } else {
        nextAttack = baseStats.attackValue + bonus.weaponAttack;
        nextDefense = baseStats.defenseValue + bonus.defenseValue;
        nextMagicLevel = baseStats.magicLevel + bonus.magicLevel;
        nextMagicAttack = prev.magicAttackValue;
      }

      const next = {
        attackValue: nextAttack,
        defenseValue: nextDefense,
        swordSkill: baseStats.swordSkill + bonus.swordSkill,
        axeSkill: baseStats.axeSkill + bonus.axeSkill,
        maceSkill: baseStats.maceSkill + bonus.maceSkill,
        distanceSkill: baseStats.distanceSkill + bonus.distanceSkill,
        shieldingSkill: baseStats.shieldingSkill + bonus.shieldingSkill,
        magicLevel: nextMagicLevel,
        magicAttackValue: nextMagicAttack,
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
        prev.magicAttackValue === next.magicAttackValue &&
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
    form.experiencePoints,
    form.profession,
    form.objectKind,
    form.swordSkill,
    form.axeSkill,
    form.maceSkill,
    form.distanceSkill,
    form.shieldingSkill,
    baseStats,
  ]);

  const appendChat = useCallback((c: ChatEntry) => {
    setChatMessages((prev) => [...prev, c].slice(-30));
  }, []);

  const onRealtimeRefresh = useCallback(() => {
    const id = selectedBoardIdRef.current;
    if (!id) return;
    void (async () => {
      try {
        const data = await api<GameObject[]>(`/boards/${id}/objects`);
        setObjects(data.map(normalizeGameObject));
      } catch (err) {
        setError(String(err));
      }
      try {
        const r = await api<{ session: CombatSession | null }>(`/boards/${id}/combat`);
        setCombatSession(r.session);
      } catch {
        setCombatSession(null);
      }
    })();
  }, []);

  const { sendChat } = useSharedRoomRealtime(
    Boolean(sharedMode && forcedBoardId),
    selectedBoardId || undefined,
    onRealtimeRefresh,
    onRealtimeRefresh,
    undefined,
    appendChat,
  );

  useEffect(() => {
    if (!sharedMode || !chatOpen || !forcedBoardId) return;
    void (async () => {
      try {
        const rows = await api<
          { id: string; username: string; body: string; createdAt: string }[]
        >("/api/room-chat/recent?limit=30");
        setChatMessages(
          rows.map((r) => ({
            id: r.id,
            label: `${r.username}:`,
            body: r.body,
            createdAt: r.createdAt,
          })),
        );
      } catch {
        //
      }
    })();
  }, [sharedMode, chatOpen, forcedBoardId]);

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

  async function loadCardTemplates() {
    try {
      const data = await api<CardTemplate[]>("/card-templates");
      setCardTemplates(data);
    } catch (err) {
      setError(String(err));
    }
  }

  async function loadItemTemplates() {
    try {
      const data = await api<ItemTemplate[]>("/item-templates");
      setItemTemplates(data);
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
      if (sharedMode && forcedBoardId) {
        if (!data.some((b) => b.id === forcedBoardId)) {
          setError("El tablero compartido no existe. Revisa SHARED_BOARD_ID / VITE_SHARED_BOARD_ID.");
        }
      } else {
        if (!selectedBoardId && data[0]) setSelectedBoardId(data[0].id);
        if (selectedBoardId && !data.some((b) => b.id === selectedBoardId)) {
          setSelectedBoardId(data[0]?.id ?? "");
        }
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
      void refreshCombatFor(boardId);
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
    if (form.objectKind === "PLAYER") {
      const selectedItems = equipmentItems.filter((item) => {
        const field = FIELD_BY_SLOT[item.slot];
        return form[field] === item.name;
      });
      const bonus = equipmentBonuses(selectedItems);
      payload.magicLevel = baseStats.magicLevel + bonus.magicLevel;
    }

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
    if (
      combatSession?.status === "ACTIVE" &&
      occupant?.objectKind === "CREATURE" &&
      combatSession.currentActorId === selectedObjectId
    ) {
      setCombatTargetId(occupant.id);
      return;
    }
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

  if (
    sharedMode &&
    typeof localStorage !== "undefined" &&
    !localStorage.getItem(LIVE_SESSION_TOKEN_KEY)
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className={`layout${sharedMode ? " layout--shared" : ""}`}>
      <aside className="sidebar">
        {!sharedMode ? (
          <>
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
          </>
        ) : null}

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
              {obj.profession ? ` / ${obj.profession}` : ""}) [{obj.x},{obj.y}
              {obj.floor != null ? ` z${obj.floor}` : ""}] inv {inventoryWeight(obj.inventorySlots)}w
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

        <CardTemplatesPanel
          templates={cardTemplates}
          onReload={async () => {
            await loadCardTemplates();
          }}
          onError={setError}
        />

        <ItemTemplatesPanel
          items={itemTemplates}
          onReload={async () => {
            await loadItemTemplates();
          }}
          onError={setError}
        />
      </aside>

      <section className="main">
        <header className={`toolbar${sharedMode ? " toolbar--shared" : ""}`}>
          <h2>{selectedBoard ? `Tablero: ${selectedBoard.name}` : "Sin tablero"}</h2>
          {loading && <span>Cargando...</span>}
          {error && <span className="error">{error}</span>}
        </header>

        <div className="board-wrap">
          <BoardView
            objects={objects}
            selectedObjectId={selectedObjectId}
            selectedObject={selectedObject}
            combatTargetId={isPlayerCombatTurn ? combatTargetId : ""}
            onCellClick={handleCellClick}
          />
          {isPlayerCombatTurn ? (
            <PlayerCombatActions
              className="player-combat-actions--floating"
              combatTargetId={combatTargetId}
              objects={objects}
              combatBusy={combatBusy}
              isPlayerTurn
              actorForCards={playerTurn.actorForCards}
              basicKind={playerTurn.basicKind}
              onAttack={() =>
                void playerTurn.submitPlayerTurn({
                  moves: [],
                  basicAttack: { kind: playerTurn.basicKind, targetId: combatTargetId },
                  cardAction: null,
                })
              }
              onPass={() =>
                void playerTurn.submitPlayerTurn({ moves: [], basicAttack: null, cardAction: null })
              }
              onStep={(dx, dy) => playerTurn.step(dx, dy)}
              onUseCard={(cardId) =>
                void playerTurn.submitPlayerTurn({
                  moves: [],
                  basicAttack: null,
                  cardAction: { cardId, targetId: combatTargetId },
                })
              }
              onError={setError}
            />
          ) : null}
        </div>

        {selectedBoardId ? (
          <CombatBar
            boardId={selectedBoardId}
            session={combatSession}
            objects={objects}
            selectedObjectId={selectedObjectId}
            combatTargetId={combatTargetId}
            combatBusy={combatBusy}
            setCombatBusy={setCombatBusy}
            playerTurn={playerTurn}
            onStart={async () => {
              setError("");
              try {
                await api(`/boards/${selectedBoardId}/combat/start`, { method: "POST", body: "{}" });
                await loadObjects(selectedBoardId);
                await refreshCombatFor(selectedBoardId);
              } catch (e) {
                setError(String(e));
              }
            }}
            onEnd={async () => {
              setError("");
              try {
                await api(`/boards/${selectedBoardId}/combat/end`, { method: "POST", body: "{}" });
                await refreshCombatFor(selectedBoardId);
              } catch (e) {
                setError(String(e));
              }
            }}
            onRefreshCombat={async () => {
              if (selectedBoardId) await refreshCombatFor(selectedBoardId);
            }}
            onObjectsUpdate={(next) => {
              setObjects(next);
              objectsRef.current = next;
            }}
            onReloadObjects={async () => {
              if (selectedBoardId) await loadObjects(selectedBoardId);
            }}
            onError={setError}
          />
        ) : null}

        <CombatLog entries={combatSession?.logEntries} />
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
        cardTemplates={cardTemplates}
        onRefreshObjects={async () => {
          if (selectedBoardId) await loadObjects(selectedBoardId);
        }}
        onError={setError}
        combatLocked={combatActive}
      />

      {sharedMode ? (
        <GroupChatPanel
          open={chatOpen}
          onToggleOpen={() => setChatOpen((o) => !o)}
          messages={chatMessages}
          onSend={sendChat}
        />
      ) : null}
    </main>
  );
}