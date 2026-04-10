#!/usr/bin/env sh
# Arranque en Render (Linux): exige disco persistente montado en /var/data
# antes de ejecutar Prisma contra SQLite en esa ruta.
set -eu

cd "$(dirname "$0")/.."

if [ ! -d /var/data ]; then
  echo "[render-start] ERROR: no existe /var/data."
  echo "[render-start] En Render: Web Service → Disks → Persistent disk con mount path exacto: /var/data"
  echo "[render-start] Tras crear o cambiar el disco, haz un deploy manual del servicio."
  exit 1
fi

if [ ! -w /var/data ]; then
  echo "[render-start] ERROR: /var/data no es escribible por el proceso."
  exit 1
fi

npm run prisma:prepare
npm run seed:poi
exec npm run start
