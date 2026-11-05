# Shift — Kit de la Fase 0

> Este archivo vive en `docs/PHASE0_KIT.md`. Los comandos se ejecutan desde la raíz del repo.

Primer paso del plan (`SHIFT_PLAN.md`, sección 21): comprobar con llamadas **reales** los supuestos del Plan A antes de construir encima, y dejar listo el contrato `ShiftLedger`.

## Qué incluye

| Archivo | Para qué |
|---|---|
| `scripts/smoke.ts` | Pruebas reales U1–U8 contra el 0G Router (saldo, catálogo, llave efímera, inferencia con `verify_tee`, historial de uso, decisiones, revocación). Revoca la llave siempre, aunque algo falle. |
| `scripts/inspect-openapi.ts` | Extrae del OpenAPI oficial los schemas exactos (campo de límite por llave, `/v1/decisions`, etc.). |
| `scripts/merkle-vector.ts` | Genera el vector de prueba de hojas de Merkle en TypeScript. |
| `contracts/src/ShiftLedger.sol` | Contrato final de anclaje y donaciones. |
| `contracts/test/ShiftLedger.t.sol` | 7 tests, incluido el de **paridad TS ↔ Solidity** del hash de hoja (ya pasan). |
| `contracts/script/Deploy.s.sol` | Despliegue en 0G Chain. |
| `docs/spike/merkle-vector.json` | Vector usado por el test de paridad. |

Todos los scripts compilan con TypeScript estricto y los tests del contrato pasan (`7 passed`).

## Pasos

### 1. Instalar
```bash
npm install
cp .env.example .env
```

### 2. Llave de gestión del equipo
En `https://pc.0g.ai` → Settings → Management Keys → preset **Custom** → marcar `account:read`, `keys:create`, `keys:manage`. Pegarla en `ZG_MK_KEY` del `.env`. La cuenta necesita créditos: pídanlos en el Telegram de builders de 0G.

### 3. OpenAPI (antes de la prueba de llaves)
Descarga la especificación desde `https://0gfoundation.github.io/0g-router/` (botón "Download OpenAPI specification"), guárdala en `docs/spike/openapi.json` y ejecuta:
```bash
npm run inspect-openapi -- docs/spike/openapi.json
```
Revisa `docs/spike/openapi-excerpt.md`. Pon el nombre real del campo de límite por llave en `SMOKE_KEY_LIMIT_FIELD` y un valor pequeño en `SMOKE_KEY_LIMIT_VALUE` (en la unidad que indique el spec).

### 4. Prueba real
```bash
npm run smoke
```
- Resumen en consola con ✅ / ❌ por cada prueba.
- Resultados completos sin secretos en `docs/spike/SPIKE_RESULTS.json` y catálogo en `docs/spike/models.json`.
- Gasto: una llamada de chat de 5 tokens y una de decisión. Imagen y audio solo si activas `SMOKE_IMAGE=1` o `SMOKE_AUDIO_FILE`.
- Si **U4** (revocación) falla, revoca la llave a mano en pc.0g.ai → API Keys.

### 5. Contratos
```bash
cd contracts
git clone --depth 1 --branch v1.9.4 https://github.com/foundry-rs/forge-std lib/forge-std
forge test
```
Si `forge` no puede descargar el compilador, baja el binario `solc-static-linux` v0.8.24 de los releases de `ethereum/solidity` y usa `forge test --use /ruta/al/solc`.

Despliegue (cuando U10 confirme chain ID y RPC):
```bash
forge script script/Deploy.s.sol --rpc-url zg_mainnet --broadcast --private-key $OPERATOR_PRIVATE_KEY
```
Guarda la dirección en `LEDGER_CONTRACT_ADDRESS`.

## Cómo leer los resultados

| Resultado | Qué decidir |
|---|---|
| U1 ✅ y U3 ✅ con `credit_used` | Modo iAI confirmado: el presupuesto usa solo `credit_balance`. |
| U1 o U3 ❌ | Fallback: modo presupuesto como principal (plan, sección 21). |
| U2 ✅ con campo de límite | Doble tope activo (llave + optimizador). |
| U2 ✅ sin campo de límite | Control de gasto propio con lectura de saldo cada 5 llamadas. |
| U4 ❌ | Bloqueante: no lanzar hasta resolver la revocación. |
| U7 ❌ | Usar el cuerpo del error y el extracto del OpenAPI para corregir el schema; si no se resuelve, fallback con chat JSON estricto. |

Copia el resumen a `docs/SPIKE_RESULTS.md` y compártelo con el equipo: con eso se arranca la Fase 1.
