# Tibia Board MVP

Aplicacion web fullstack con frontend y backend separados para gestionar tableros 12x12 con objetos movibles, atributos RPG y cartas.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Base de datos: SQLite + Prisma ORM
- Tests backend: Vitest + Supertest

## Requisitos

- Node.js 20+ (recomendado)
- npm 10+

## Estructura del proyecto

- `frontend/` interfaz React
- `backend/` API REST, reglas de juego y persistencia SQLite
- `descripcion.txt` reglas base del juego usadas para enriquecer el dominio

## Instalacion

Desde la raiz del proyecto:

```bash
cd frontend && npm install
cd ../backend && npm install
```

## Configuracion de base de datos

En `backend/.env` ya existe:

```env
DATABASE_URL="file:./dev.db"
```

Generar cliente Prisma y crear tablas:

```bash
cd backend
npm run prisma:generate
npx prisma db push
```

## Ejecucion en desarrollo

### 1) Levantar backend

```bash
cd backend
npm run dev
```

Servidor API en:

- `http://localhost:4000`

### 2) Levantar frontend

En otra terminal:

```bash
cd frontend
npm run dev
```

Aplicacion web en:

- URL que muestre Vite (normalmente `http://localhost:5173`)

## Build de produccion

### Backend

```bash
cd backend
npm run build
npm run start
```

### Frontend

```bash
cd frontend
npm run build
npm run preview
```

## Tests

Solo backend por ahora:

```bash
cd backend
npm run test
```

Incluye pruebas para:

- Creacion de tablero y objeto
- Movimiento adyacente con consumo de stamina (jugador) y sin coste (criatura)
- Colision de objetos en celdas ocupadas
- Spawn desde plantilla y `collect-loot` con capacidad
- Sincronizacion masiva tras renombre de campos (`/boards/:id/sync`)

## Uso de la aplicacion

1. Crea un tablero en el panel izquierdo.
2. Selecciona el tablero.
3. En el panel derecho crea un objeto con:
   - Tipo `PLAYER` o `CREATURE`; profesion (`mago`, `guerrero`, `paladin`, `druida`) solo para jugadores
   - Equipo: `helmet`, `armor`, `legs`, `boots`, `weapon`, `shield`, `ring`, `necklace`, `backpackEquipment` (item equipado en slot mochila)
   - Stats: `hitpoints`, `manaPoints`, `staminaPoints`, `attackValue`, `defenseValue`, `experienceLevel`, `gold`, `manaRegen`, `staminaRegen`, `capacityMax`
   - Inventario (jugador): slots con `itemName`, `peso` y `cantidad` respecto a `capacityMax`
   - `spriteUrl` para mostrar imagen del sprite
   - 5 cartas con `deckCategory`, costes opcionales de mana/stamina/capacidad
4. Guarda el objeto.
5. Mueve el objeto en el tablero con clic sobre una celda destino:
   - Solo permite celdas adyacentes
   - Consume 1 punto de stamina por movimiento para jugadores; las criaturas no gastan stamina
   - Bloquea movimiento a celdas ocupadas
6. Mazmorras: crea una mazmorra, vincula hasta 4 tableros (pisos 1–4) y cambia de piso desde el panel.
7. Bestiario: plantillas globales con loot; modo spawn + clic en celda vacia coloca la criatura en el tablero activo.
8. Loot: en una criatura con plantilla y entradas de loot, “Recolectar loot” envia el botin al jugador elegido si cabe en `capacityMax`.
9. Usa la lista lateral para seleccionar, editar o eliminar objetos.
10. Tambien puedes renombrar o eliminar tableros.

## API principal (resumen)

### Tableros

- `GET /boards`
- `POST /boards`
- `PATCH /boards/:id`
- `DELETE /boards/:id`

### Objetos

- `GET /boards/:id/objects`
- `POST /boards/:id/objects`
- `PATCH /objects/:id`
- `DELETE /objects/:id`
- `POST /objects/:id/move`
- `POST /objects/:id/collect-loot` (body: `collectorObjectId`; solo criaturas con loot en plantilla)
- `POST /boards/:id/sync` (sincroniza coleccion de objetos del tablero)

### Mazmorras

- `GET /dungeons`
- `GET /dungeons/:id`
- `POST /dungeons`
- `PATCH /dungeons/:id`
- `DELETE /dungeons/:id`
- `POST /dungeons/:id/floors` (body: `boardId`, `floor` 1–4)

### Bestiario y spawn

- `GET /creature-templates`
- `POST /creature-templates`
- `PATCH /creature-templates/:id`
- `DELETE /creature-templates/:id`
- `POST /creature-templates/:id/loot`
- `DELETE /loot-entries/:id`
- `POST /boards/:boardId/spawn-creature` (body: `templateId`, `x`, `y`)

## Notas

- El tablero es fijo de `12x12`.
- Se permite multiples objetos por tablero, pero solo uno por celda.
- Si quieres cambiar el host/puerto del backend, usa la variable `PORT`.

## Deploy en Render (sitio estatico)

Este repo incluye `render.yaml` para crear un **Static Site** en Render usando `frontend/`.

### Archivos y scripts agregados para Render

- `render.yaml` en la raiz del proyecto
- Script frontend `render:build` para build en Render
- Script frontend `start` para arranque tipo preview (util para validaciones)
- Uso de `VITE_API_BASE_URL` en frontend para apuntar al backend desplegado

### Pasos en Render

1. En Render, crea un nuevo servicio desde el repositorio.
2. Render detectara `render.yaml`.
3. Confirma el servicio estatico `tibia-boardgame-frontend`.
4. Define la variable de entorno:
   - `VITE_API_BASE_URL=https://TU-BACKEND.onrender.com`
5. Ejecuta deploy.

### Backend en Render (persistencia + seed inicial)

- `render.yaml` configura el backend con disco persistente (`/var/data`) y `DATABASE_URL=file:///var/data/dev.db`.
- `startCommand` usa `npm --prefix backend run render:start`, que ejecuta:
  1. `prisma:prepare`
  2. `seed:poi` (idempotente)
  3. `start`

Con esto, al reiniciar en producción no se deben perder registros mientras el disco siga adjunto, y la configuración inicial POI se carga automáticamente cuando la DB está vacía.

### Importante

- Este despliegue es **solo frontend estatico**.
- El backend debe estar desplegado aparte (Render Web Service u otro proveedor) y permitir CORS desde el dominio del frontend.

Guia detallada:

- `RENDER_STATIC_SITE.md`
