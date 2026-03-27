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
- Movimiento adyacente con consumo de stamina
- Colision de objetos en celdas ocupadas

## Uso de la aplicacion

1. Crea un tablero en el panel izquierdo.
2. Selecciona el tablero.
3. En el panel derecho crea un objeto con:
   - Nombre y profesion (`mago`, `guerrero`, `paladin`, `druida`)
   - Equipo: `helmet`, `armor`, `legs`, `boots`, `weapon`, `shield`, `ring`, `necklace`, `backpack`
   - Stats: `hitpoints`, `manaPoints`, `staminaPoints`
   - `spriteUrl` para mostrar imagen del sprite
   - 5 cartas (nombre y descripcion)
4. Guarda el objeto.
5. Mueve el objeto en el tablero con clic sobre una celda destino:
   - Solo permite celdas adyacentes
   - Consume 1 punto de stamina por movimiento
   - Bloquea movimiento a celdas ocupadas
6. Usa la lista lateral para seleccionar, editar o eliminar objetos.
7. Tambien puedes renombrar o eliminar tableros.

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

### Importante

- Este despliegue es **solo frontend estatico**.
- El backend debe estar desplegado aparte (Render Web Service u otro proveedor) y permitir CORS desde el dominio del frontend.
