# Sistema de combate, progresión, cartas y mazmorras

Documento de diseño alineado a las reglas narradas (Game Master). Sirve como referencia para implementación en código y balanceo. Donde el texto original deja márgenes, se proponen fórmulas cerradas y parámetros tunables (`k`, `α`, etc.).

---

## 1. Principios de atributos y separación de conceptos

| Concepto | Origen principal | Notas |
|----------|------------------|--------|
| **Experience points (XP)** | Completar misiones y derrotar criaturas | Moneda de progreso “de campaña”. |
| **Experience level** | Derivado de XP (curva cuadrática, §2) | Escala poder global del personaje. |
| **Skill points (SP)** | Acciones en combate (§6) | Se acumulan por acción; Happy Hour puede duplicar la ganancia. |
| **Skill level** (por línea: espada, hacha, maza, distancia, escudo, magia, etc.) | Conversión cuadrática desde SP acumulados en esa línea (§3) | **No entra en la fórmula base de `attackValue`.** Afecta precisión, condiciones de crítico, daño con ciertas cartas/talentos futuros o tablas opcionales — no al valor de ataque bruto del arma. |
| **Attack value** | Arma (`weaponAttackPoints`) + experience level (§4) | Coherente con tu aclaración: el skill level de melee **no** escala el `attackValue` base. |
| **Magic attack value** | Implementación análoga para magia (§5) | Base para runas de ataque y escalado de sanación por runas. |

---

## 2. Experience level desde experience points (curva cuadrática)

Se fijan dos anclas:

- Para alcanzar **nivel de experiencia 1** se requieren **100 XP** acumulados (umbral inferior del nivel 1 respecto al 0, o el primer umbral tras el estado inicial — ajústalo en UI como “XP total de carrera”).
- Para alcanzar **nivel de experiencia 2** se requieren **230 XP** acumulados en total.

Se modela el **XP total mínimo** para **haber alcanzado** el nivel \(L\) como una cuadrática en \(L\):

\[
\text{XP\_umbral}(L) = a L^2 + b L
\]

Sustituyendo \(L=1 \Rightarrow 100\) y \(L=2 \Rightarrow 230\):

\[
a + b = 100,\quad 4a + 2b = 230
\Rightarrow a = 15,\; b = 85
\]

**Fórmula de umbrales cumulativos:**

\[
\boxed{\text{Experiencia necesaria para estar en nivel } L \text{ (como piso de XP total)} = 15L^2 + 85L}
\]

Comprobación: \(L=1 \to 100\), \(L=2 \to 230\), \(L=3 \to 390\).

**Nivel a partir de XP total (`totalXp`):** sea \(L^\* = \max\left\{ L \in \mathbb{N}_0 \mid 15L^2 + 85L \le \text{totalXp} \right\}\). En implementación, resolver la ecuación \(15L^2 + 85L - \text{totalXp} = 0\) y tomar la parte entera del raíz positiva con cuidado en bordes.

**Inversa (referencia):**

\[
L = \left\lfloor \frac{-85 + \sqrt{85^2 + 60\cdot \text{totalXp}}}{30} \right\rfloor
\]

(validar con tests unitarios en valores 0, 99, 100, 229, 230).

> **XP en runtime:** Otorgar XP al cerrar quest / morir criatura; el servidor recalcula `experienceLevel` con la fórmula anterior (o almacena solo `totalXp` y deriva el nivel siempre).

---

## 3. Skill level desde skill points (curva cuadrática por línea de habilidad)

Anclas:

- **Skill level 1** ↔ **10** skill points acumulados en esa línea.
- **Skill level 2** ↔ **23** skill points acumulados.

Misma familia \(a'S^2 + b'S\):

\[
a' + b' = 10,\quad 4a' + 2b' = 23
\Rightarrow a' = 1{,}5,\; b' = 8{,}5
\]

\[
\boxed{\text{SP umbral para skill level } S = \frac{3}{2}S^2 + \frac{17}{2}S = 1{,}5\,S^2 + 8{,}5\,S}
\]

(\(S=1 \to 10\), \(S=2 \to 23\), \(S=3 \to 39\).)

**Skill level desde puntos acumulados en la línea** `skillPoints[line]`:

\[
\text{skillLevel}(line) = \max\left\{ S \mid 1{,}5S^2 + 8{,}5S \le \text{skillPoints}[line] \right\}
\]

> **Importante:** Este valor **no** se usa dentro de `attackValue` base (§4). Puede usarse para: tiradas de impacto, críticos, desbloqueo de cartas, o daño de habilidades que digan explícitamente “escala con skill level”.

---

## 4. Attack value (sin skill level de arma en la fórmula base)

**Regla de diseño:** el **skill level** de espada/hacha/maza **no** modifica el cálculo del `attackValue` base. El arma aporta puntos fijos (“attack points” del ítem); el nivel de experiencia escala el uso efectivo del arma.

Propuesta (tunable):

\[
\boxed{\text{attackValue} = \bigl\lfloor \text{weaponAttackPoints} \cdot (1 + \alpha \cdot (\text{experienceLevel}-1)) \cdot (1 + \epsilon) \bigr\rfloor}
\]

- `weaponAttackPoints`: suma desde equipo (arma principal + bonos de ítem si aplica).
- `α` (~0.03–0.08): cuánto pesa el nivel de experiencia sobre el arma.
- `ε` pequeño (0 o buffs temporales): no incluye skill level melee.

**Defense value** puede seguir un esquema paralelo con puntos de armadura/escudo y `experienceLevel`, también **sin** mezclar skill level de shielding en la base si quieres la misma filosofía.

---

## 5. Magic attack value (runas de ataque, escalado de sanación de runas)

Análogo al ataque físico, pero usando **puntos de ataque mágico del equipo** (varita/bastón/libro) y **experience level**. El **magic skill level** (de la línea de magia) **no** entra en la base si mantienes paralelismo con §4; o bien entra solo en **cartas de hechizo** que lo indiquen.

\[
\boxed{\text{magicAttackValue} = \bigl\lfloor \text{weaponMagicAttackPoints} \cdot (1 + \alpha_m \cdot (\text{experienceLevel}-1)) \bigr\rfloor}
\]

- **Runa de ataque (daño):** daño base (tabla de carta) + `magicAttackValue` (o multiplicador × `magicAttackValue`).
- **Runa de sanación:** curación base + \( \beta \cdot \text{magicAttackValue} \) (o tabla por rango de `magicLevel` skill si prefieres que la runa escale con pericia de magia; entonces sería **excepción** documentada donde sí interviene skill).

---

## 6. Stamina, Happy Hour y ganancia de skill points

- Al **entrar en mazmorra:** `staminaPoints = 500`.
- **Happy Hour:** los **primeros 100 puntos de stamina gastados** en la mazmorra duplican la ganancia de **skill points** (no necesariamente el gasto de otras estadísticas). Llevar contador `staminaSpentHappyHourCap = min(gasto acumulado, 100)`.
- **Consumo:** ataques básicos, hechizos que usan stamina, runas (todas las runas usan stamina según tu texto).

**Ganancia de SP (por acción, por línea afectada):**

| Acción | SP base (por línea relevante) |
|--------|-------------------------------|
| Ataque básico (melee a distancia según arma) | +1 a la línea del arma usada |
| Ataque con spell que da bonus (ej. carta tipo “Exori” +1) | +1 + `spellCardSkillBonus` a la línea que indique la carta |

Si la acción cae dentro del tramo Happy Hour (el gasto de stamina de esa acción sigue contando en el primer bloque de 100 gastados), multiplicar el SP ganado por **×2** (redondeo hacia abajo si aplica).

---

## 7. Cartas: mano, mazos y costes

### 7.1 Límites estructurales

- **Mano:** exactamente **5** cartas al final del mantenimiento de turno del jugador activo (ver §9).
- **Mazo de hechizos (spell cards):** máximo **30** cartas; **reutilizables** (vuelven al mazo o a descarte recuperable según implementación).
- **Mazo de runas:** máximo **30** cartas; **no reutilizables** (tras jugar, a descarte agotado / fuera de partida).
- Mazos adicionales de items (según `descripcion.txt`) pueden coexistir con límites similares.

### 7.2 Tipos de carta Spell (coste según tu lista)

| Tipo | Efecto en habilidades | Coste principal |
|------|----------------------|-----------------|
| **Melee spell card** | SP de pericia en **sword / axe / mace** | **Stamina** |
| **Magic spell card** | Pericia hacia **magic level** | **Mana** |
| **Support spell card** | Pericia hacia **magic level** | **Mana** |
| **Healing spell card** | Pericia hacia **magic level** | **Mana** |

Opcional: subtipos `SPELL_*` del enum actual en base de datos encajan con estas categorías.

### 7.3 Runas (siempre stamina)

| Tipo | Efecto |
|------|--------|
| **Attack rune** | Daño basado en **magic attack value** (§5) |
| **Healing rune** | Curación basada en **magic attack value** / tabla de `magicLevel` (definir una convención única en implementación) |

### 7.4 Healing spell — *rapid spell*

- Atributo **rapid spell:** la carta puede jugarse **fuera del turno** del jugador (reacción).
- **Consecuencia:** al usarla de este modo, el jugador **no** ejecuta el paso de “robar hasta 5” asociado a esa jugada (no recupera/refresca mano por ese efecto).

---

## 8. Sistema de combate y daño crítico

### 8.1 Secuencia sugerida por turno (jugador o enemigo)

1. Inicio de turno: efectos de duración, regeneraciones de mana (si hay reglas por turno en mesa).
2. Fase de acción: movimiento en tablero (si aplica) + **una** acción principal o acciones menores según reglas de mesa.
3. Resolución de ataques/hechizos/runas: gasto stamina/mana, tiradas, daño.
4. Fin de turno:** solo el jugador activo** roba de sus mazos hasta tener **5** cartas en mano (§9).

### 8.2 Crítico (propuesta coherente sin usar skill en attack value base)

1. **Tirada de impacto:** `d20 + modificador` donde el modificador puede venir de **skill level** de la línea usada (aquí sí entra el skill), ventaja por flanqueo, etc. **El attack value** actúa como daño base o DC del defensor — tú eliges una convención y la mantienes.

2. **Confirmación de crítico:** si la tirada natural está en rango crítico (ej. 20 en d20, o 19–20 con talentos).

3. **Multiplicador de crítico:** \( \text{daño total} = \text{daño base} \times c \) con \(c \in [1.5,\; 2.5]\) según carta/arquetipo.

4. **Crítico “de carta”:** algunas *spell* o *rune* amplían el rango de crítico o \(c\).

Documentar en carta: `critThreshold`, `critMultiplier` opcionales para implementación futura en `Card`/`DeckCategory`.

---

## 9. Turno, iniciativa y robo de cartas

- **Iniciativa al inicio de combate:** `d20 + experienceLevel + skillLevel(relevante)` o fija por agilidad de mesa; empates re-rollean.
- **Robo hasta 5:** solo puede hacerlo el **jugador activo al finalizar su turno**, desde los mazos que correspondan (primero spell deck, reglas de prioridad si mano mixta).
- Enemigos no usan la misma mano salvo que diseñes criaturas con cartas.

---

## 10. Mazmorra en 4 etapas (estilo de campaña)

| Etapa | Contenido | Enemigos |
|-------|-----------|----------|
| 1 | Combate | Multitud: hasta **9** no-jefes |
| 2 | Combate | Multitud: hasta **9** |
| 3 | Combate | Multitud: hasta **9** |
| 4 | Combate | **Boss** (1) + opcional adds |

- Todas las etapas incluyen pelea; entre etapas: descanso corto, loot, eventos (fuera de alcance técnico mínimo).

---

## 11. Hitpoints de criaturas (grupo recomendado 2–4 jugadores)

Sea \(P \in [2,4]\) el tamaño del grupo. Sea `Lv` el nivel de experiencia medio del grupo o el nivel objetivo de la mazmorra.

**Fórmula base (tunable):**

\[
\text{HP\_trash} = \bigl\lceil (8 + 4\cdot \text{Lv}) \cdot (1 + 0.35\cdot(P-2)) \bigr\rceil
\]

- Para **P=2:** factor 1.0  
- **P=3:** ×1.35  
- **P=4:** ×1.70  

**Boss (etapa 4):**

\[
\text{HP\_boss} \approx \bigl\lceil \text{HP\_trash} \cdot (6 + \text{Lv} \cdot 0.5) \bigr\rceil
\]

Ajusta con pruebas de mesa: el objetivo es que el boss aguante 3–5 rondas con 4 jugadores en nivel `Lv`.

---

## 12. Relación con el modelo actual (Prisma / API)

- `GameObject`: ya expone `attackValue`, `defenseValue`, `experiencePoints`, `experienceLevel`, `capacityMax`, `gold`, regeneración, `objectKind`, cartas con `deckCategory` y costes.
- **Recomendación de implementación:**
  - Persistir **`experiencePoints`** y recalcular **`experienceLevel`** con §2 en cada ganancia de XP.
  - Persistir **`skillPoints`** por línea (nuevo modelo o JSON) y derivar **`skillLevel`** por línea con §3, o almacenar solo puntos y calcular al vuelo.
  - No mezclar **skill level** dentro del cálculo automatizado de **`attackValue`** salvo que se añadan campos explícitos “opcionales” para habilidades especiales.
  - Stamina inicial de mazmorra (500) y Happy Hour son **estado de sesión** / efecto de “instancia de mazmorra”, no necesariamente el `staminaPoints` persistido del objeto fuera de partida.

---

## 13. Próximos pasos de código (fuera de este documento)

- Servicio `ProgressionService`: `xpToLevel`, `spToSkillLevel`, `recalculateAttackValue`.
- `DungeonInstance`: `staminaBudget=500`, `happyHourRemaining=100`, cola de turnos.
- Extensión de `Card`: flags `rapidSpell`, `critRange`, `critMultiplier`, `spellSkillBonus`, consumo explícito mana/stamina.
- Tabla de criaturas: `suggestedPartySize`, `hpFormulaTier`.

---

*Última revisión: alineado a reglas narradas del usuario; números de balance (`α`, tablas de crítico, HP) son propuestas y deben validarse en playtest.*
