# Guia de configuracion en Render (frontend + backend)

Este proyecto es monorepo (`frontend` + `backend`). Para que guardar objetos funcione, el sitio estatico necesita un backend API accesible por HTTPS.

## Por que aparecio el error ENOENT

Error visto:

- `Could not read package.json: /opt/render/project/src/package.json`

Causas:

1. Render estaba ejecutando el build en la raiz del repo donde antes no habia `package.json`.
2. El comando ingresado tenia typo: `npm run redenr:build` en lugar de `npm run render:build`.

## Solucion aplicada en el codigo

Se agrego en la raiz:

- `package.json` con scripts:
  - `render:build` (instala y compila frontend)
  - `redenr:build` (alias para tolerar el typo)

Y se actualizo `render.yaml` para publicar:

- `publishPath: frontend/dist`
- servicio `web` para backend (`tibia-boardgame-backend`)
- servicio `static` para frontend (`tibia-boardgame-frontend`)

Con esto, incluso si Render ejecuta en raiz, el build funciona.

Adicionalmente, el frontend ahora muestra errores mas claros cuando no puede conectar la API.

## Configuracion recomendada en Render

### Opcion A (recomendada): usar `render.yaml` (Blueprint)

1. En Render: **New +** -> **Blueprint**.
2. Selecciona este repositorio y la rama `ErickDev`.
3. Render detecta `render.yaml` automaticamente y crea:
   - Web Service backend
   - Static Site frontend
4. Abre el servicio estatico y define:
   - `VITE_API_BASE_URL=https://<url-del-backend>.onrender.com`
5. Re-deploy del static site.

### Opcion B: crear servicios manualmente

#### 1) Backend (Web Service)

- **Branch**: `ErickDev`
- **Root Directory**: vacio (raiz)
- **Build Command**:
  - `npm --prefix backend ci && npm --prefix backend run prisma:generate && npm --prefix backend run build`
- **Start Command**:
  - `npm --prefix backend exec prisma db push && npm --prefix backend run start`
- **Environment Variables**:
  - `DATABASE_URL=file:/var/data/dev.db`
  - `PORT=10000`
- **Disk**:
  - mount path `/var/data` (1 GB)

#### 2) Frontend (Static Site)

- **Branch**: `ErickDev`
- **Build Command**: `npm run render:build`
- **Publish Directory**: `frontend/dist`
- **Environment Variable**:
  - `VITE_API_BASE_URL=https://<url-del-backend>.onrender.com`

Notas:

- Si dejas `Publish Directory` como `dist`, no encontrara archivos.
- Si escribes `redenr:build`, no falla ahora por el alias, pero usa `render:build` como valor correcto.
- Si `VITE_API_BASE_URL` usa `http://` mientras el frontend esta en `https://`, el navegador bloqueara la solicitud.

## Verificacion rapida post-deploy

1. Abre la URL del static site.
2. En DevTools, verifica que las llamadas vayan a `VITE_API_BASE_URL` y respondan `200/201`.
3. Prueba flujo minimo:
   - Crear tablero
   - Crear objeto
   - Mover objeto
