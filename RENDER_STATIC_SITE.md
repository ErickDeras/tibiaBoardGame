# Guia de configuracion en Render (sitio estatico)

Este proyecto es monorepo (`frontend` + `backend`). El sitio estatico en Render debe publicar solo el build de `frontend`.

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

Con esto, incluso si Render ejecuta en raiz, el build funciona.

## Configuracion recomendada en Render

### Opcion A (recomendada): usar `render.yaml`

1. En Render: **New +** -> **Blueprint**.
2. Selecciona este repositorio y la rama `ErickDev`.
3. Render detecta `render.yaml` automaticamente.
4. En variables de entorno del servicio estatico, agrega:
   - `VITE_API_BASE_URL=https://TU_BACKEND.onrender.com`
5. Deploy.

### Opcion B: crear Static Site manualmente

Si no usas Blueprint, configura exactamente:

- **Branch**: `ErickDev`
- **Build Command**: `npm run render:build`
- **Publish Directory**: `frontend/dist`
- **Environment Variable**:
  - `VITE_API_BASE_URL=https://TU_BACKEND.onrender.com`

Notas:

- Si dejas `Publish Directory` como `dist`, no encontrara archivos.
- Si escribes `redenr:build`, no falla ahora por el alias, pero usa `render:build` como valor correcto.

## Verificacion rapida post-deploy

1. Abre la URL del static site.
2. En DevTools, verifica que las llamadas vayan a `VITE_API_BASE_URL`.
3. Prueba flujo minimo:
   - Crear tablero
   - Crear objeto
   - Mover objeto

Si falla CORS, revisa el backend para permitir el dominio del frontend de Render.
