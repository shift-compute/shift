# Shift — Documentación completa y plan de implementación

> Proyecto para **ETHGlobal Mumbai 2026** (presencial, 5–7 de noviembre de 2026, Jio World Centre).
> Premio principal: **0G — "Build with 0G PC"** + bonus iAI. Objetivo secundario: top 10 finalistas de ETHGlobal.
> Acceso a créditos del usuario: **Plan A — delegación con llave de gestión (`mk-`) y llaves `sk-` efímeras.**

---

## 0. Instrucciones para la IA que va a programar esto

Lee este documento completo antes de escribir código. Reglas obligatorias:

1. **Cero ejecuciones simuladas.** El DevRel de 0G (Gathin, workshop del 5 de noviembre) dijo explícitamente que no quieren "mock execution": si algo no funciona, debe quedar así, pero real. Nunca generes respuestas falsas, saldos inventados, request IDs ficticios ni transacciones simuladas. No hay "modo demo" con datos falsos.
2. **Etiquetas de certeza.** Cada dato técnico de este documento está marcado como:
   - **[VERIFICADO]**: confirmado en documentación oficial de 0G o fuentes revisadas.
   - **[VERIFICAR]**: muy probable pero no confirmado; debe comprobarse en la Fase 0 antes de construir encima. Si la comprobación falla, usa el fallback indicado.
3. **Fuente de verdad del API de 0G:** la especificación OpenAPI del Router (`https://0gfoundation.github.io/0g-router/`, botón "Download OpenAPI specification"). Descárgala al inicio y genera tipos con `openapi-typescript`. Si algo de este documento contradice la especificación, **gana la especificación**.
4. **Nunca envíes llaves `sk-` ni `mk-` al navegador.** Todo uso de llaves ocurre en el servidor.
5. **Commits ordenados: entre 50 y 90 en todo el proyecto.** Un commit por ítem de `PROGRESS.md`, sin commits gigantes ni cientos de commits mínimos. Reglas completas en la sección 27 y en `CLAUDE.md`.
6. **TypeScript estricto** en todo el proyecto (`"strict": true`). Valida toda entrada externa con `zod`.
7. **Orden del repo:** cada archivo va donde dice `docs/STRUCTURE.md`, y `PROGRESS.md` se actualiza en el mismo commit que el trabajo que describe.

---

## 1. Resumen del producto

**Shift convierte los créditos diarios de IA de 0G que se perderían cada noche en trabajo útil y verificable: primero para el usuario y, lo que sobre, para un bien común.**

### Problema
- Los créditos de iAI se renuevan a las **00:00 UTC** y **lo no usado expira, sin acumularse** [VERIFICADO — blog oficial de iAI].
- Cada iAI en staking recibe **1.271 créditos/día** (valor declarado > $1/día) [VERIFICADO].
- Casi nadie usa su cuota completa todos los días → valor desperdiciado → tener iAI parece menos valioso.

### Solución (flujo del usuario)
1. **Durante el día**, el usuario deja tareas en una cola (audio para transcribir y resumir, documento para analizar, idea para generar una imagen).
2. **Antes del corte** (ventana 23:00–23:50 UTC = 04:30–05:20 IST), un **optimizador** reparte el saldo sobrante entre las tareas, eligiendo para cada una el modelo más barato que cumpla la calidad necesaria, usando los **modelos de decisión de 0G** (Laya / Vela).
3. **Lo que sobra** se dona a una **cola común** (traducir documentación pública de Ethereum al hindi y marathi), con **control de calidad de doble modelo**.
4. **Procedencia verificable:** cada resultado guarda su request ID y traza de 0G; el lote nocturno se ancla en **0G Chain** como capa de **atribución y curaduría** (qué resultado pertenece a qué usuario, cuánto donó cada quien, qué entró al dataset), complementando la prueba nativa de inferencia de 0G.

### Ajuste clave (pedido implícitamente por 0G)
iAI es un **bonus**, no el criterio principal (Gathin). Por eso Shift funciona con **cualquier cuenta de 0G Private Computer**:
- **Modo iAI:** gasta solo `credit_balance` sobrante (créditos que expiran).
- **Modo presupuesto:** el usuario define un tope nocturno en USD; se gasta hasta ese tope.

### Frase "qué se rompe si quitas 0G" (requisito de entrega de 0G)
> "Without 0G, there are no expiring daily credits to rescue, no TEE-verified receipts proving which model produced each result, and no on-chain record of who donated compute to the commons."

---

## 2. Contexto de la hackathon y criterios de evaluación

### Premio objetivo: 0G "Build with 0G PC" — $5,000 (1.º $2,500 / 2.º $1,500 / 3.º $1,000) [VERIFICADO]
**Debe mostrar** (texto del brief de 0G):
- Inferencia en **0G Private Computer en el flujo principal, con request IDs**.
- Una app funcional que el juez pueda probar, con una razón clara para volver mañana.
- Una frase sobre qué se rompe si se quita 0G.
- **Bonus iAI:** un usuario conectando su cuenta de 0G y su saldo de créditos bajando mientras usa la app.

**No quieren:** wrappers de chat genéricos; apps donde la IA se puede quitar sin que nadie lo note.

**Entregables de 0G** [VERIFICADO]:
- Nombre y descripción corta.
- Repo público de GitHub (README + instrucciones de instalación).
- Video demo **menor a 3 minutos** + enlace a demo en vivo.
- Direcciones de contratos desplegados.
- Nombres de integrantes y contacto (Telegram y X).

### Consejos del DevRel de 0G (workshop, 5 nov)
- Construir algo con **profundidad** en el uso de IA: usar la complejidad del stack, **los modelos de decisión**, o usar el flujo completo **de forma más eficiente** que otras apps. → Es exactamente nuestro optimizador.
- Su propio caso de uso de los modelos de decisión: elegir entre respuesta rápida y pensamiento profundo según la tarea. → Lo mismo que hace nuestro optimizador.
- **Compartir request IDs / recibos como prueba** de uso de 0G Compute.
- Créditos de mainnet para construir: se piden en el **grupo de Telegram de builders de 0G** en ETHGlobal.

### Finalistas ETHGlobal
- Todos los proyectos pasan por evaluación general. Para destacar: ejecución real demostrable (ciclos nocturnos reales con transacciones y request IDs), interfaz pulida, pitch más amplio que un solo sponsor: *"cómputo de IA que se iba a desperdiciar, convertido en bienes públicos con procedencia verificable"*.

### Fechas
- Cortes reales de créditos durante el evento: **00:00 UTC = 05:30 IST** del 6, 7 y 8 de noviembre.
- **Meta:** ciclo nocturno real completo en el corte del **7 de noviembre (ventana 04:30–05:20 IST)**; segundo ciclo el 8 si la fecha límite lo permite.
- Fecha límite de entrega: una fuente indica **8 de noviembre 09:00 IST** [VERIFICAR en el dashboard de ETHGlobal].

---

## 3. Alcance (MoSCoW)

### Must (núcleo, sin esto no se entrega)
- M1. Conexión de cuenta 0G con llave `mk-` (Plan A), validación de permisos y lectura de saldo.
- M2. Ciclo de vida de llaves `sk-` efímeras: crear → usar → revocar, con límite de gasto.
- M3. Cola de tareas con 3 tipos: `AUDIO_SUMMARY`, `DOC_ANALYSIS`, `IMAGE_FROM_PROMPT`.
- M4. Optimizador de presupuesto con clasificación de complejidad vía modelo de decisión.
- M5. Worker nocturno real (ventana 23:00–23:50 UTC) + botón "Ejecutar ahora" que corre **el mismo pipeline real**.
- M6. Resultados subidos a **0G Storage**; traza (`x_0g_trace`, `X-Request-ID`) guardada por tarea.
- M7. Contrato `ShiftLedger` en 0G Chain + árbol de Merkle del lote nocturno anclado.
- M8. Página de verificación pública.
- M9. Panel de gasto: cuánto se pagó con crédito vs depósito (si el API lo expone).

### Should
- S1. Cola común (traducción EN→HI/MR) con control de calidad de doble modelo + modelo de decisión.
- S2. Registro on-chain de donaciones por usuario + tabla de donantes.

### Could (solo si el núcleo está listo en la hora 20)
- C1. Cifrado de resultados personales con llave pública del navegador (sealed box).
- C2. Integración con Arkiv para la cola efímera (ver Apéndice A).
- C3. Custodia de llaves `mk-` dentro de un TEE (dstack / Phala Cloud).

### Won't (fuera de alcance)
- Bóveda de iAI (custodia de tokens), app móvil, E2EE sellado (`_e2ee`), múltiples idiomas fuera de HI/MR, pagos.

---

## 4. Arquitectura

```
                         ┌──────────────────────────────────────────┐
                         │               Navegador                  │
                         │ Next.js UI (sin llaves, solo sesión)     │
                         └───────────────┬──────────────────────────┘
                                         │ HTTPS (cookie de sesión)
                         ┌───────────────▼──────────────────────────┐
                         │        apps/web  (Next.js 15, API)       │
                         │ - Onboarding mk- (cifra y guarda)        │
                         │ - CRUD de tareas, uploads                │
                         │ - Vista previa del plan (precios reales) │
                         │ - Verificador (lee contrato + proofs)    │
                         └───────┬───────────────────┬──────────────┘
                                 │ Postgres (Prisma) │
                         ┌───────▼───────────────────▼──────────────┐
                         │        apps/worker (Node, cron)          │
                         │ 1. Lee saldo (mk-)                       │
                         │ 2. Crea sk- efímera con tope             │
                         │ 3. Optimiza (decision models)            │
                         │ 4. Ejecuta tareas → 0G Router            │
                         │ 5. Cola común + control de calidad       │
                         │ 6. Sube resultados → 0G Storage          │
                         │ 7. Revoca sk-                            │
                         │ 8. Merkle + anchor → 0G Chain            │
                         └───┬──────────────┬──────────────┬────────┘
                             │              │              │
             ┌───────────────▼───┐  ┌───────▼───────┐  ┌───▼──────────────┐
             │ 0G Router (PC)    │  │ 0G Storage    │  │ 0G Chain (EVM)   │
             │ router-api.0g.ai  │  │ (SDK TS)      │  │ ShiftLedger │
             │ chat/audio/image/ │  │ root hashes   │  │ roots + donations│
             │ decisions/account │  │               │  │                  │
             └───────────────────┘  └───────────────┘  └──────────────────┘
```

**Decisión de diseño importante:** 0G ya asienta una prueba por cada interacción con modelos (dicho en el workshop). **No duplicamos esa prueba.** Nuestro Merkle ancla **atribución y curaduría**: pertenencia de cada resultado al lote del usuario, montos donados y aprobación de la cola común. El verificador enlaza cada resultado a su request ID nativo de 0G.

---

## 5. Stack técnico

| Capa | Tecnología | Notas |
|---|---|---|
| Monorepo | pnpm workspaces | `apps/web`, `apps/worker`, `packages/core`, `contracts` |
| Lenguaje | TypeScript 5.x estricto | Node 20 LTS o 22 LTS |
| Frontend + API | Next.js 15 (App Router), React 19 | Route handlers para la API interna |
| Estilos | Tailwind CSS 4 + shadcn/ui | Ver sección 18 para dirección visual |
| Wallet (opcional) | wagmi v2 + viem v2 + RainbowKit + `siwe` | Solo para iniciar sesión con wallet; no se firman pagos |
| Sesión | `iron-session` | Cookie cifrada, httpOnly, sameSite=lax |
| Base de datos | PostgreSQL 16 + Prisma ORM | Railway o Neon |
| Validación | `zod` | Toda entrada externa |
| Cliente 0G Router | `openai` SDK (baseURL del Router) + `fetch` tipado | Endpoints no estándar (`/v1/decisions`, `/v1/account/*`, `/v1/api-keys`) con fetch + tipos de OpenAPI |
| Tipos del API | `openapi-typescript` | Generados desde la spec oficial |
| Worker | Node + `node-cron` + `p-limit` | Un solo proceso, lock en DB |
| PDF | `pdf-parse` | Extraer texto de documentos |
| Merkle | `@openzeppelin/merkle-tree` (StandardMerkleTree) | Compatible con `MerkleProof` de OZ |
| Contratos | Foundry (forge) + OpenZeppelin Contracts v5 | Solidity ^0.8.24 |
| 0G Storage | SDK TypeScript oficial de 0G Storage + `ethers` v6 | Nombre exacto del paquete [VERIFICAR en docs.0g.ai/…/storage/sdk] |
| Cifrado en reposo | `node:crypto` AES-256-GCM | Para llaves `mk-` |
| Cifrado de resultados (Could) | `libsodium-wrappers` (crypto_box_seal) | Llave privada solo en el navegador |
| Logs | `pino` con redacción de secretos | Redactar `authorization`, `mk-`, `sk-` |
| Tests | `vitest` + `forge test` | |
| Hosting | Railway (web + worker + Postgres) | Necesario proceso persistente para el worker; Vercel no sirve para el worker |

> Fija versiones exactas en el lockfile. No uses rangos sin lockfile.

---

## 6. Estructura del repositorio

> El repo arranca con el kit de la Fase 0 (`scripts/`, `contracts/`, `docs/`) y se convierte en este monorepo en el ítem F1.1 de `PROGRESS.md`. El detalle de qué va en cada carpeta, y las reglas de ubicación, están en `docs/STRUCTURE.md`.

```
shift/
├── apps/
│   ├── web/                         # Next.js (UI + API interna)
│   │   ├── app/
│   │   │   ├── page.tsx             # Inicio: cuenta regresiva al corte + estado
│   │   │   ├── connect/page.tsx     # Asistente de conexión mk-
│   │   │   ├── queue/page.tsx       # Cola de tareas + vista previa del plan
│   │   │   ├── nights/[id]/page.tsx # Resultados de una noche
│   │   │   ├── commons/page.tsx     # Dataset común + donantes
│   │   │   ├── verify/page.tsx      # Verificador público
│   │   │   └── api/
│   │   │       ├── session/route.ts
│   │   │       ├── connect/route.ts         # POST mk-, DELETE desconectar
│   │   │       ├── account/route.ts         # saldo actual (vía mk-)
│   │   │       ├── tasks/route.ts           # GET/POST
│   │   │       ├── tasks/[id]/route.ts      # GET/DELETE
│   │   │       ├── plan/preview/route.ts    # estimación real con precios reales
│   │   │       ├── runs/now/route.ts        # dispara pipeline real para el usuario
│   │   │       ├── nights/[id]/route.ts
│   │   │       ├── commons/route.ts
│   │   │       └── verify/[requestId]/route.ts
│   │   └── lib/ (session, auth, ui helpers)
│   └── worker/
│       └── src/
│           ├── index.ts             # cron + lock
│           ├── pipeline/runNight.ts # orquestación por usuario
│           ├── pipeline/runUser.ts
│           ├── pipeline/commons.ts
│           ├── pipeline/anchor.ts
│           └── sweeper.ts           # revoca llaves huérfanas
├── packages/
│   └── core/
│       └── src/
│           ├── zg/router.ts         # cliente 0G Router (sk- y mk-)
│           ├── zg/types.ts          # generado desde OpenAPI
│           ├── zg/models.ts         # catálogo, precios, tiers
│           ├── zg/decisions.ts      # /v1/decisions
│           ├── zg/storage.ts        # 0G Storage upload/download
│           ├── zg/chain.ts          # viem client + contrato
│           ├── optimizer/           # estimación de costos + asignación
│           ├── tasks/               # ejecutores por tipo
│           ├── crypto/vault.ts      # AES-256-GCM para mk-
│           ├── merkle/              # construcción de hojas y pruebas
│           └── config.ts            # env validado con zod
├── contracts/
│   ├── src/ShiftLedger.sol
│   ├── test/ShiftLedger.t.sol
│   └── script/Deploy.s.sol
├── prisma/schema.prisma
├── scripts/
│   ├── smoke.ts                     # Fase 0: verificación de supuestos
│   └── seed-commons.ts              # carga textos fuente de la cola común
├── data/commons/                    # textos fuente (licencia compatible)
├── docs/ (este archivo)
└── README.md
```

---

## 7. Integración con 0G Router (Private Computer)

### 7.1 URLs base [VERIFICADO]
| Red | UI | API |
|---|---|---|
| Mainnet | `https://pc.0g.ai` | `https://router-api.0g.ai/v1` |
| Testnet | `https://pc.testnet.0g.ai` | `https://router-api-testnet.integratenetwork.work/v1` |

Mainnet y testnet tienen saldos y llaves separados. **Usamos mainnet**, porque los créditos de iAI y los créditos de builders de 0G son de mainnet.

### 7.2 Autenticación [VERIFICADO]
| Tipo | Prefijo | Para qué |
|---|---|---|
| API key | `sk-` | Inferencia (`/v1/chat/completions`, etc.). Se cobra contra el saldo. **No puede** leer `/v1/account/*`. |
| Management key | `mk-` | Administrar cuenta: leer saldo/uso, listar/crear/revocar `sk-`. **No se cobra. No puede hacer inferencia.** |

Ambas van en `Authorization: Bearer <key>`. No existe OAuth ni "Sign in with 0G" para terceros.

**Permisos (scopes) de `mk-`** [VERIFICADO]:
| Acción | Endpoint | Scope |
|---|---|---|
| Leer saldo / uso / historial | `GET /v1/account/*` | `account:read` |
| Listar `sk-` | `GET /v1/api-keys` | `keys:read` |
| Crear `sk-` | `POST /v1/api-keys` | `keys:create` |
| Editar / revocar `sk-` | `PATCH` / `DELETE /v1/api-keys/:id` | `keys:manage` |
| Gestionar otras `mk-` | `/v1/management-keys/*` | Imposible con `mk-` (requiere sesión de wallet) |

**Scopes que pedimos al usuario:** `account:read`, `keys:create`, `keys:manage` (modo "Custom" en pc.0g.ai → Settings → Management Keys). No pedimos `keys:read`: guardamos el `id` de cada llave que creamos y revocamos por id.

### 7.3 Endpoints que usamos
| Uso | Método y ruta | Llave | Estado |
|---|---|---|---|
| Datos de la cuenta (dirección, moneda) | `GET /v1/account` | `mk-` | Endpoint [VERIFICADO]; campos exactos [VERIFICAR] |
| Saldo del ledger del Router | `GET /v1/account/balance` | `mk-` | [VERIFICADO]: devuelve `deposit_balance + credit_balance` (y `pending_charge`) |
| Saldo combinado para mostrar | `GET /v1/account/funds` | `mk-` | [VERIFICADO] |
| Historial de uso | `GET /v1/account/usage/history` | `mk-` | [VERIFICADO]; `credit_used` / `deposit_used` por solicitud documentado para cuentas USD [VERIFICAR para cuentas 0G] |
| Crear llave efímera | `POST /v1/api-keys` | `mk-` | [VERIFICADO] acepta `"trust_mode": "private"`; nombre del campo de límite de crédito [VERIFICAR] |
| Revocar llave | `DELETE /v1/api-keys/:id` | `mk-` | [VERIFICADO] |
| Catálogo y precios | `GET /v1/models` | ninguna/`sk-` | [VERIFICADO] (incluye `pricing`, `pricing_usd`, `e2ee`, capacidades) |
| Chat | `POST /v1/chat/completions` | `sk-` | [VERIFICADO], compatible OpenAI |
| Transcripción | `POST /v1/audio/transcriptions` | `sk-` | [VERIFICADO]; usar `response_format: json` o `verbose_json`; **no** `stream`, **no** `text/srt/vtt` |
| Imagen | `POST /v1/images/generations` | `sk-` | [VERIFICADO]; respetar `image_capabilities` (`max_n`, tamaños) |
| Decisiones | `POST /v1/decisions` | `sk-` | Endpoint [VERIFICADO]; forma: `model`, `state`, `questions` con respuestas tipificadas `choice` / `score` / `noul` y probabilidades calibradas [VERIFICAR schema exacto] |

### 7.4 Encabezados y campos importantes
- `X-0G-Provider-Trust-Mode: private | verified | standard` [VERIFICADO]. Si no hay proveedor para ese nivel: **`503 no_provider_for_trust_mode`**, nunca baja de nivel en silencio.
- Body `verify_tee: true` → la traza reporta `tee_verified` [VERIFICADO]. Interpretación: `true` = firma verificada; `false` = atestación mala; **ausente = sin veredicto (no es fallo)**.
- Respuesta: encabezado **`X-Request-ID`** (id oficial del Router, el mismo de `x_0g_trace.request_id` y del historial de uso) [VERIFICADO]. **Guardarlo siempre.**
- Respuesta: objeto **`x_0g_trace`** con `request_id`, `provider`, `provider_identity`, `tee_verified` (si se pidió) y `billing` (`input_cost`, `output_cost`, `total_cost`, `currency` = `"0g"` (wei) o `"usd"` (micro-USD), y `total_cost_usd_micro` [beta]) [VERIFICADO].
- Encabezado de solicitud **`X-Client-Request-Id`** (≤ 512 ASCII) para rastrear solicitudes abandonadas [VERIFICADO, beta]. Usar el id de intento de nuestra tarea.
- **Una solicitud abandonada se cobra igual** [VERIFICADO]: no cancelar a ciegas; siempre registrar.

### 7.5 Errores que hay que manejar
| Código | Significado | Acción |
|---|---|---|
| `402 insufficient_balance` | Sin saldo para la solicitud | Detener el lote del usuario |
| `402 pay_no_balance` / `pay_insufficient_spendable` / `pay_debt_threshold` | Variantes de saldo (cuentas USD) | Detener |
| `429 credit_limit_exceeded` | La llave efímera alcanzó su tope | **Fin normal del presupuesto**: detener y pasar a revocar |
| `429 fair_share_exceeded` / `429` con `Retry-After` | Capacidad del proveedor | Reintentar tras `Retry-After`, máx. 3 veces |
| `401 api_key_revoked` | Llave revocada | Esperado tras revocar |
| `403 insufficient_scope` | Falta permiso en `mk-` | Mostrar al usuario qué scope falta |
| `503 no_provider_for_trust_mode` | No hay proveedor en ese nivel | Cambiar a otro modelo del mismo tipo con ese nivel |
| `503 vault_unavailable` / `pay_gate_unavailable` | Lectura de saldo falló | Reintentar con backoff |
| `400 model_not_capable` / `model_format_mismatch` | Modelo no sirve esa operación | Excluir el modelo y replanificar |

### 7.6 Modelo de saldo [VERIFICADO]
- `/v1/account/balance` = ledger del Router (`deposit_balance + credit_balance`), **excluye** la bóveda compartida (Payment Layer) en cuentas 0G.
- Cuentas en USD: montos en micro-USD. Cuentas en 0G: en wei.
- El crédito promocional **expirado o de otro servicio de 0G no cuenta** como gastable.
- **Nuestra unidad interna: micro-USD.** Convertir usando `x_0g_trace.billing.total_cost_usd_micro` para costos reales y `pricing_usd` del catálogo para estimaciones. Si la cuenta es en 0G, convertir el saldo con la tasa implícita del catálogo [VERIFICAR] o trabajar en wei para esa cuenta (el optimizador acepta ambas unidades con un adaptador).

### 7.7 Modelos con privacidad en enclave (TeeML) — octubre 2026 [VERIFICADO, puede cambiar]
| Modelo | Tipo |
|---|---|
| 0GM-1.0-35B-A3B | chat (cifrado extremo a extremo disponible) |
| GLM-5.3 | chat |
| Laya | modelo de decisión (contexto 512 tokens inglés / 1024 multilingüe) |
| Vela 2.0 9B | modelo de decisión (contexto ~16k) |
| Whisper Large v3 | voz a texto |
| Z-Image-Turbo | texto a imagen |
| Qwen3 Embedding 0.6B / 8B | embeddings |

**Los IDs exactos de modelo se leen de `GET /v1/models` en tiempo de ejecución; nunca se escriben a mano.** Filtrar por `verifiability: "TeeML"` para privado.

---

## 8. Plan A — Delegación con llave de gestión (especificación completa)

### 8.1 Onboarding (una sola vez por usuario)
1. El usuario abre `/connect`. Se muestra un asistente con 4 pasos y enlace directo a `https://pc.0g.ai` → **Settings → Management Keys**.
2. Instrucciones exactas en pantalla:
   - Crear llave con preset **Custom**.
   - Marcar **solo**: `account:read`, `keys:create`, `keys:manage`.
   - Nombre sugerido: `shift`.
   - Copiar la llave (se muestra una sola vez).
3. El usuario pega la llave. El servidor:
   1. Valida formato (`^mk-` + longitud mínima).
   2. Llama `GET /v1/account` y `GET /v1/account/balance`. Si `403 insufficient_scope`, responde qué scope falta.
   3. **Prueba de `keys:create` y `keys:manage` sin gastar:** crea una `sk-` con nombre `shift-probe-<ts>` y la revoca de inmediato. Si falla, indica qué scope falta.
   4. Cifra la `mk-` con AES-256-GCM (llave maestra del servidor) y guarda `ciphertext`, `iv`, `authTag`. **Nunca** se guarda en texto plano, nunca se registra en logs, nunca vuelve al navegador.
   5. Guarda `accountAddress`, `currency` y el saldo inicial.
4. El usuario elige el modo: **iAI (solo créditos)** o **Presupuesto (tope en USD)**.
5. Botón **"Desconectar"**: borra la `mk-` cifrada y recuerda al usuario revocarla en pc.0g.ai.

### 8.2 Ciclo de vida de la llave efímera (cada noche, por usuario)
```
leer saldo (mk-)
  → calcular presupuesto = gastable − margen de seguridad
  → si presupuesto < mínimo útil: saltar usuario
  → crear sk- {name: "shift-<YYYYMMDD>-<runId>", trust_mode: "private",
               <campo de límite>: presupuesto}           // [VERIFICAR nombre del campo]
  → guardar keyId + createdAt en NightRun (ANTES de usarla)
  → ejecutar tareas con sk- (optimizador)
  → finally: DELETE /v1/api-keys/:keyId  → guardar revokedAt
  → leer historial de uso y saldo final → calcular creditUsed / depositUsed
```

### 8.3 Invariantes de seguridad (no negociables)
1. **Presupuesto en modo iAI = `credit_balance` − 10 %** (margen configurable). Nunca incluir `deposit_balance`.
2. **Doble tope:** límite en la propia llave (si el API lo soporta) **y** contabilidad propia del optimizador que detiene la ejecución antes de llegar al presupuesto.
3. **Toda llave creada se revoca** en un bloque `finally`. Además, un **sweeper** cada 10 minutos revoca cualquier llave con `revokedAt = null` y antigüedad > 2 horas.
4. Ventana dura: nada se ejecuta después de **23:50 UTC**.
5. Tras cada solicitud se acumula el costo real (`x_0g_trace.billing`). Si el gasto real supera la estimación en > 20 %, se replanifica.
6. Si el API **no** permite límite por llave (fallback de U2): en modo iAI se lee `/v1/account/balance` cada 5 solicitudes y se detiene cuando `credit_balance` ≤ margen. Documentarlo en el README con honestidad.

### 8.4 Prueba de "solo créditos"
- Tras el lote: `GET /v1/account/usage/history` filtrado por los request IDs del lote. Mostrar `credit_used` vs `deposit_used` por solicitud y totales en la UI.
- Si el historial no trae esa división para cuentas 0G (fallback de U3): mostrar `credit_balance` antes y después y `deposit_balance` antes y después.

---

## 9. Pipeline nocturno (worker)

### 9.1 Programación
- `node-cron` revisa cada minuto. Ventana de ejecución: `NIGHT_START_UTC` (default `23:00`) a `NIGHT_HARD_STOP_UTC` (default `23:50`).
- `nightId` = fecha UTC en formato `YYYYMMDD` del día que termina en ese corte.
- **Lock** en DB (`Night.status = RUNNING` con `UPDATE ... WHERE status = 'PENDING'`) para que solo una instancia corra.
- Botón **"Ejecutar ahora"** (`POST /api/runs/now`): ejecuta `runUser()` real para el usuario actual con `nightId = "manual-<timestamp>"`. Mismo código, mismas llamadas reales, mismo anclaje (en un lote manual). **No es una simulación.**

### 9.2 `runNight(nightId)`
1. Seleccionar usuarios conectados con tareas `QUEUED` o con modo de donación activo.
2. Para cada usuario (secuencial entre usuarios, concurrencia interna `MAX_CONCURRENCY = 3`): `runUser(user, nightId)`.
3. `anchorNight(nightId)`: construir Merkle con todas las hojas del lote, subir manifiesto a 0G Storage, llamar `anchorNight` y `recordDonations` en el contrato.
4. Marcar `Night.status = DONE`.

### 9.3 `runUser(user, nightId)`
1. Descifrar `mk-` en memoria (nunca a disco).
2. Leer saldo → presupuesto (sección 8).
3. Crear `sk-` efímera (registrar en `NightRun`).
4. Cargar catálogo `GET /v1/models` (cache 10 min).
5. **Planificar** con el optimizador (sección 10).
6. **Ejecutar** tareas del plan: por cada tarea → ejecutor por tipo (sección 11) → subir salida a 0G Storage → guardar traza y costo real → crear hoja de Merkle.
7. Con el presupuesto restante → **cola común** (sección 12), atribuyendo el costo como donación del usuario.
8. `finally`: revocar `sk-`, borrar `mk-` de memoria, leer historial de uso, guardar resumen en `NightRun`.

### 9.4 Tolerancia a fallos
- Una tarea que falla queda `FAILED` con el error real; **no se reintenta indefinidamente** (máx. 2 reintentos solo para `429`/`5xx`).
- Si se cae el worker a mitad de lote, al reiniciar el sweeper revoca la llave y las tareas `RUNNING` vuelven a `QUEUED` si no tienen request ID.

---

## 10. Optimizador de presupuesto

### 10.1 Entradas
- `budget` (micro-USD), `deadline` (23:50 UTC), lista de tareas (`type`, `priority 1–3`, tamaño de entrada).
- Catálogo filtrado por tipo y nivel de confianza (preferir `private`; si el tipo no tiene modelo privado, `verified`).
- Tabla de **calidad relativa** por modelo (config en `packages/core/optimizer/quality.ts`, editable): p. ej. chat → `0GM-1.0 = 2`, `GLM-5.3 = 3`. Valores iniciales razonables; documentar que son heurísticos.

### 10.2 Clasificación de complejidad con modelo de decisión
Por cada tarea de texto, una llamada a `POST /v1/decisions` con Vela (o Laya si el texto cabe en 512 tokens):
```json
{
  "model": "<id de Vela desde /v1/models>",
  "state": "<descripción breve de la tarea + primeros ~1500 caracteres de la entrada>",
  "questions": [
    { "id": "complexity", "type": "choice",
      "text": "How much reasoning does this task need?",
      "options": ["simple", "standard", "complex"] }
  ]
}
```
[VERIFICAR schema exacto en OpenAPI.] Mapeo: `simple → calidad mínima 1`, `standard → 2`, `complex → 3`. Si la probabilidad máxima < 0.5, usar `standard`. El costo de esta llamada se descuenta del presupuesto.

> Esto replica lo que Gathin describió en el workshop: usar modelos de decisión para elegir entre respuesta rápida y razonamiento profundo.

### 10.3 Estimación de costo por opción (tarea × modelo)
- **Chat:** `tokens_in ≈ ceil(chars / 4)`; `tokens_out` por tipo (resumen 400, análisis 700). `costo = tokens_in × pricing_usd.prompt + tokens_out × pricing_usd.completion`.
- **Transcripción:** `duración (s) × precio por segundo` del catálogo [VERIFICAR unidad del precio de Whisper]. Duración leída del archivo en el upload (`music-metadata`).
- **Imagen:** precio por imagen del tier de tamaño (`pricing_usd.variants`) o por tokens si el modelo cobra por tokens.
- **Decisión:** precio del catálogo.
- Factor de seguridad: multiplicar estimación × 1.15.

### 10.4 Asignación (mochila de elección múltiple, greedy)
```
opciones(t) = modelos válidos para t con calidad ≥ minCalidad(t), ordenados por costo
plan = {}
restante = budget
// Paso 1: base barata, por prioridad
para t en tareas ordenadas por (prioridad desc, createdAt asc):
    o = opción más barata de t
    si o.costo ≤ restante: plan[t] = o; restante -= o.costo
    si no: t queda para la próxima noche (status DEFERRED)
// Paso 2: mejoras por mejor (Δcalidad × peso_prioridad) / Δcosto
mientras exista mejora con Δcosto ≤ restante:
    elegir mejora con mayor ratio; aplicarla; restante -= Δcosto
// Paso 3: reservar margen de cola común
commonsBudget = restante
```
- **Replanificación:** tras cada tarea ejecutada, si `costo_real > 1.2 × estimado`, recalcular con el presupuesto real restante.
- **Vista previa:** `/api/plan/preview` corre el mismo optimizador con saldo y precios **reales** y lo muestra como "estimación de esta noche". Es un cálculo real, no una ejecución simulada.

---

## 11. Tipos de tarea (MVP)

| Tipo | Entrada | Pasos (llamadas reales) | Salida |
|---|---|---|---|
| `AUDIO_SUMMARY` | audio ≤ 10 MB (mp3, m4a, wav) | 1) `/v1/audio/transcriptions` (Whisper, `verbose_json`) 2) `/v1/chat/completions`: resumen + puntos clave | JSON `{transcript, summary, keyPoints[]}` |
| `DOC_ANALYSIS` | PDF/TXT/MD ≤ 5 MB | 1) extraer texto (`pdf-parse`) en servidor 2) chat: resumen, acciones, riesgos | JSON `{summary, actionItems[], risks[]}` |
| `IMAGE_FROM_PROMPT` | texto (idea) | 1) chat: mejorar prompt 2) `/v1/images/generations` (`b64_json`) | PNG + JSON `{prompt, revisedPrompt}` |

Reglas comunes:
- Todas las llamadas con `X-0G-Provider-Trust-Mode` según el nivel elegido, `verify_tee: true` en el body de chat/imagen/audio cuando el endpoint lo acepte [VERIFICAR por endpoint], y `X-Client-Request-Id = <taskId>-<attempt>-<step>`.
- Guardar **cada** `X-Request-ID` y `x_0g_trace` de cada paso en `Task.steps[]`.
- Prompts de sistema en inglés; la salida en el idioma del usuario si se detecta.
- Archivos de entrada: guardados en un volumen persistente (`UPLOAD_DIR`) hasta procesarse; se borran 24 h después.

---

## 12. Cola común con control de calidad

### 12.1 Fuente
- Párrafos cortos (≤ 120 palabras) de documentación pública de Ethereum con licencia compatible. Opción sugerida: contenido de ethereum.org (repo público) [VERIFICAR licencia antes de usar y citarla en el README].
- `scripts/seed-commons.ts` carga ~200 párrafos en `CommonsItem` con `status = PENDING`, idioma destino `hi` o `mr`.

### 12.2 Proceso por ítem (con el presupuesto restante del usuario donante)
1. **Traducción A:** chat con modelo A (p. ej. 0GM-1.0, privado).
2. **Traducción B:** chat con modelo B distinto (p. ej. GLM-5.3, privado).
3. **Compuerta de calidad:** `POST /v1/decisions` con un modelo de decisión multilingüe:
   - `state`: texto fuente + traducción A + traducción B (cortos para caber en el contexto; Laya multilingüe ≈ 1024 tokens; si no cabe, usar Vela 2.0 9B).
   - Pregunta `choice`: "Do translation A and translation B convey the same meaning as the source?" opciones `["yes", "no"]`.
4. Aceptar **traducción A** si `P(yes) ≥ 0.75`; si no, `REJECTED` con la probabilidad registrada. Los rechazados también se muestran (prueba de que el filtro funciona).
5. Subir el ítem aceptado (fuente, traducción, modelos, request IDs, probabilidad) a 0G Storage.
6. Sumar el costo real de los 3 pasos a la donación del usuario para esa noche.

---

## 13. 0G Storage

- Usar el SDK TypeScript oficial de 0G Storage (ver `docs.0g.ai` → Building on 0G → 0G Storage → SDK). Nombre del paquete, URL del indexer y red [VERIFICAR en Fase 0].
- **Qué se sube:**
  - Por tarea: un JSON `TaskOutput` (salida + metadatos + request IDs + trazas) y, si aplica, la imagen.
  - Por ítem común aceptado: JSON `CommonsOutput`.
  - Por noche: `NightManifest.json` con todas las hojas, sus datos y pruebas de Merkle.
- Guardar el **root hash** (bytes32) y el hash de transacción de cada subida.
- La cuenta que paga las subidas es la wallet del operador (`OPERATOR_PRIVATE_KEY`) con 0G para gas.
- Fallback si mainnet de Storage da problemas: usar testnet de Storage y declararlo en el README (sin ocultarlo).

---

## 14. Contrato `ShiftLedger` y árbol de Merkle

### 14.1 Red
| Red | Chain ID | RPC | Explorador |
|---|---|---|---|
| 0G Mainnet | `16661` [VERIFICAR] | `https://evmrpc.0g.ai` [VERIFICAR] | `https://chainscan.0g.ai` [VERIFICADO] |
| 0G Galileo Testnet | [VERIFICAR en docs] | `https://evmrpc-testnet.0g.ai` [VERIFICAR] | explorador de testnet [VERIFICAR] |

- **Desplegar en mainnet** (el gas es mínimo y es coherente con usar créditos de mainnet). Fallback: Galileo testnet (faucet `https://faucet.0g.ai` [VERIFICADO]), declarado en el README.
- La wallet del operador necesita algo de 0G para gas (pedir al equipo de 0G o comprar una cantidad mínima).

### 14.2 Hojas del árbol (una por solicitud de inferencia)
Usar `StandardMerkleTree` de `@openzeppelin/merkle-tree` con esta codificación exacta:

```ts
const LEAF_TYPES = [
  "bytes32", // requestIdHash   = keccak256(utf8(X-Request-ID))
  "address", // owner           = dirección de la cuenta 0G del usuario (o donante en la cola común)
  "bytes32", // taskIdHash      = keccak256(utf8(taskId o commonsItemId))
  "bytes32", // outputRoot      = root hash de 0G Storage de la salida
  "bytes32", // modelHash       = keccak256(utf8(modelId))
  "uint8",   // trustTier       = 0 standard, 1 verified, 2 private
  "uint64",  // costUsdMicro    = costo real en micro-USD
  "bool",    // isCommons
] as const;
```
`StandardMerkleTree` hace doble hash: `leaf = keccak256(bytes.concat(keccak256(abi.encode(values...))))`. El contrato verifica con `MerkleProof.verify` sobre ese `leaf`. **Escribir un test que compare el hash calculado en TS con el calculado en Solidity.**

### 14.3 Código del contrato
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ShiftLedger
/// @notice Anchors Shift nightly batches (attribution + curation) and records compute donations.
/// 0G already settles a proof per model interaction; this contract adds WHO each result belongs to,
/// WHO donated compute to the commons, and WHICH commons results passed the quality gate.
contract ShiftLedger is Ownable {
    struct Night {
        bytes32 root;          // Merkle root of all inference leaves in the batch
        bytes32 manifestRoot;  // 0G Storage root hash of NightManifest.json
        uint32 itemCount;
        uint64 anchoredAt;
        bool donationsRecorded;
    }

    /// nightId: YYYYMMDD for scheduled nights, unix seconds for manual runs.
    mapping(uint64 => Night) public nights;
    mapping(uint64 => mapping(address => uint64)) public donatedUsdMicro;
    mapping(address => uint64) public totalDonatedUsdMicro;

    event NightAnchored(uint64 indexed nightId, bytes32 root, bytes32 manifestRoot, uint32 itemCount);
    event DonationRecorded(uint64 indexed nightId, address indexed donor, uint64 amountUsdMicro);

    error AlreadyAnchored(uint64 nightId);
    error NotAnchored(uint64 nightId);
    error DonationsAlreadyRecorded(uint64 nightId);
    error LengthMismatch();

    constructor(address operator) Ownable(operator) {}

    function anchorNight(uint64 nightId, bytes32 root, bytes32 manifestRoot, uint32 itemCount)
        external
        onlyOwner
    {
        if (nights[nightId].anchoredAt != 0) revert AlreadyAnchored(nightId);
        nights[nightId] = Night(root, manifestRoot, itemCount, uint64(block.timestamp), false);
        emit NightAnchored(nightId, root, manifestRoot, itemCount);
    }

    function recordDonations(uint64 nightId, address[] calldata donors, uint64[] calldata amounts)
        external
        onlyOwner
    {
        Night storage n = nights[nightId];
        if (n.anchoredAt == 0) revert NotAnchored(nightId);
        if (n.donationsRecorded) revert DonationsAlreadyRecorded(nightId);
        if (donors.length != amounts.length) revert LengthMismatch();
        n.donationsRecorded = true;
        for (uint256 i = 0; i < donors.length; i++) {
            donatedUsdMicro[nightId][donors[i]] += amounts[i];
            totalDonatedUsdMicro[donors[i]] += amounts[i];
            emit DonationRecorded(nightId, donors[i], amounts[i]);
        }
    }

    function verifyLeaf(uint64 nightId, bytes32[] calldata proof, bytes32 leaf) external view returns (bool) {
        bytes32 root = nights[nightId].root;
        if (root == bytes32(0)) return false;
        return MerkleProof.verify(proof, root, leaf);
    }
}
```

> **Versión final del contrato:** la del kit de la Fase 0 (`contracts/src/ShiftLedger.sol`), que añade la validación `EmptyRoot` y la función `leafHash` para el test de paridad TS ↔ Solidity (7 tests pasando). Si difiere de este bloque, gana la del kit.

### 14.4 `anchorNight` en el worker
1. Reunir todas las hojas del lote (tareas + cola común).
2. Construir `StandardMerkleTree.of(values, LEAF_TYPES)`; guardar root y prueba de cada hoja en DB.
3. Generar `NightManifest.json` (`nightId`, `root`, hojas con valores y pruebas, metadatos legibles) → subir a 0G Storage → `manifestRoot`.
4. `anchorNight(nightId, root, manifestRoot, count)` → esperar recibo → guardar `anchorTx`.
5. `recordDonations(nightId, donantes, montos)` → guardar `donationsTx`.
6. Si el lote está vacío, no anclar.

---

## 15. Verificador público (`/verify`)
1. El usuario pega un **request ID** (o abre `/verify?rid=...`).
2. `GET /api/verify/[requestId]` devuelve: valores de la hoja, prueba, `nightId`, `manifestRoot`, `x_0g_trace` guardada (proveedor, `provider_identity`, `tee_verified`, nivel), root de la salida en 0G Storage.
3. **En el navegador** (no confiar en nuestro servidor para el veredicto):
   - Recalcular el hash de la hoja con `StandardMerkleTree.leafHash` / `verify`.
   - Leer `nights(nightId)` y llamar `verifyLeaf` en 0G Chain vía RPC público con `viem`.
4. Mostrar: ✔ pertenece al lote anclado en el bloque X (enlace a chainscan), modelo, nivel de confianza, resultado de `tee_verified` (con su significado correcto: ausente ≠ fallo), y enlace a la salida en 0G Storage.
5. Botón opcional: "Verify from the manifest": descarga el manifiesto desde 0G Storage por `manifestRoot` y verifica sin usar nuestra base de datos.

---

## 16. Base de datos (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Mode { IAI_CREDITS_ONLY BUDGET }
enum TaskType { AUDIO_SUMMARY DOC_ANALYSIS IMAGE_FROM_PROMPT }
enum TaskStatus { QUEUED PLANNED RUNNING DONE FAILED DEFERRED CANCELLED }
enum NightStatus { PENDING RUNNING ANCHORING DONE FAILED }
enum CommonsStatus { PENDING RUNNING ACCEPTED REJECTED FAILED }

model User {
  id               String   @id @default(cuid())
  accountAddress   String   @unique          // dirección de la cuenta 0G (desde GET /v1/account)
  currency         String                    // "usd" | "0g"
  mode             Mode     @default(IAI_CREDITS_ONLY)
  nightlyBudgetUsdMicro BigInt?              // solo en modo BUDGET
  donateLeftover   Boolean  @default(true)
  mkCiphertext     Bytes?
  mkIv             Bytes?
  mkAuthTag        Bytes?
  mkConnectedAt    DateTime?
  encPublicKey     String?                   // Could: llave pública del navegador (base64)
  createdAt        DateTime @default(now())
  tasks            Task[]
  runs             NightRun[]
}

model Task {
  id            String     @id @default(cuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id])
  type          TaskType
  status        TaskStatus @default(QUEUED)
  priority      Int        @default(2)       // 1 baja, 2 normal, 3 alta
  inputPath     String?                      // archivo en UPLOAD_DIR
  inputMeta     Json?                        // {bytes, durationSec, mime, chars}
  prompt        String?
  nightId       BigInt?
  complexity    String?                      // simple | standard | complex
  chosenModel   String?
  estCostUsdMicro    BigInt?
  actualCostUsdMicro BigInt?
  steps         Json?                        // [{step, model, requestId, trace, costUsdMicro}]
  outputRoot    String?                      // root hash 0G Storage
  outputTx      String?
  error         String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  @@index([userId, status])
}

model Night {
  id            BigInt      @id            // YYYYMMDD o unix seconds (manual)
  status        NightStatus @default(PENDING)
  startedAt     DateTime?
  finishedAt    DateTime?
  merkleRoot    String?
  manifestRoot  String?
  anchorTx      String?
  donationsTx   String?
  itemCount     Int         @default(0)
  runs          NightRun[]
  leaves        MerkleLeaf[]
}

model NightRun {
  id               String   @id @default(cuid())
  nightId          BigInt
  night            Night    @relation(fields: [nightId], references: [id])
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  ephemeralKeyId   String?
  keyCreatedAt     DateTime?
  keyRevokedAt     DateTime?
  balanceBefore    Json?
  balanceAfter     Json?
  budgetUsdMicro   BigInt?
  spentUsdMicro    BigInt   @default(0)
  donatedUsdMicro  BigInt   @default(0)
  creditUsed       String?
  depositUsed      String?
  status           String   @default("PENDING")
  error            String?
  @@unique([nightId, userId])
}

model CommonsItem {
  id              String        @id @default(cuid())
  sourceRef       String                     // URL/archivo + párrafo
  sourceText      String
  targetLang      String                     // "hi" | "mr"
  status          CommonsStatus @default(PENDING)
  translationA    String?
  translationB    String?
  modelA          String?
  modelB          String?
  gateModel       String?
  gateProbability Float?
  requestIds      String[]
  outputRoot      String?
  donorUserId     String?
  nightId         BigInt?
  costUsdMicro    BigInt?
  updatedAt       DateTime      @updatedAt
}

model MerkleLeaf {
  id          String  @id @default(cuid())
  nightId     BigInt
  night       Night   @relation(fields: [nightId], references: [id])
  requestId   String  @unique
  values      Json                           // valores en el orden de LEAF_TYPES
  leafHash    String
  proof       Json                           // bytes32[]
}
```

---

## 17. API interna (Next.js route handlers)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/connect` | ninguna | Recibe `mk-`, valida (sección 8.1), crea `User` y sesión |
| DELETE | `/api/connect` | sesión | Borra `mk-` cifrada |
| GET | `/api/session` | sesión | Usuario actual, modo, estado de conexión |
| GET | `/api/account` | sesión | Saldo actual vía `mk-` (`balance` + `funds`) |
| PATCH | `/api/settings` | sesión | Modo, presupuesto, donar sobrante |
| GET/POST | `/api/tasks` | sesión | Listar / crear tarea (multipart para archivos) |
| DELETE | `/api/tasks/[id]` | sesión | Cancelar tarea en cola |
| GET | `/api/plan/preview` | sesión | Optimizador con saldo y precios reales (no ejecuta) |
| POST | `/api/runs/now` | sesión | Ejecuta el pipeline real ahora (rate limit: 1 cada 10 min) |
| GET | `/api/nights/[id]` | sesión/pública parcial | Resultados del usuario + datos públicos del lote |
| GET | `/api/commons` | pública | Ítems aceptados/rechazados + donantes (desde el contrato) |
| GET | `/api/verify/[requestId]` | pública | Datos para verificación (sección 15) |
| GET | `/api/outputs/[taskId]` | sesión | Descarga la salida desde 0G Storage |

Sesión: cookie `iron-session` con `userId`. **Identidad = cuenta 0G de la `mk-`.** Iniciar sesión de nuevo = volver a pegar la `mk-` (se valida contra el `accountAddress` guardado). SIWE con wallet es opcional y solo si la dirección coincide con la de la cuenta 0G.

---

## 18. Frontend

### 18.1 Páginas
1. **Inicio (`/`)**: cuenta regresiva en vivo al próximo 00:00 UTC (con hora IST), saldo gastable de esta noche, estado de la cola y botón "Connect your 0G account".
2. **Conectar (`/connect`)**: asistente de 4 pasos (sección 8.1) con capturas o indicaciones claras de dónde está "Management Keys" en pc.0g.ai.
3. **Cola (`/queue`)**: agregar tareas (subir audio/documento, escribir idea de imagen, prioridad), lista de tareas y **vista previa del plan** de esta noche (modelo elegido, complejidad detectada, costo estimado, qué queda para la cola común).
4. **Noche (`/nights/[id]`)**: resultados con su **tarjeta de procedencia** (request IDs, modelo, nivel de confianza, `tee_verified`, costo, root de 0G Storage, enlace al verificador) y el resumen de gasto crédito vs depósito.
5. **Común (`/commons`)**: traducciones aceptadas y rechazadas con probabilidad del filtro, total donado por usuario (leído del contrato).
6. **Verificar (`/verify`)**: sección 15.

**Idioma de la interfaz: inglés** (jueces internacionales). Textos en sentence case, verbos claros: "Connect your 0G account", "Add task", "Run tonight's shift now", "Verify a result".

### 18.2 Dirección visual
Concepto: **turno de madrugada en Mumbai**: cielo de las 4 AM y luz de farolas de sodio, que se aclara hacia el amanecer cuando termina el lote.

| Token | Hex | Uso |
|---|---|---|
| Sky 4 AM | `#1D2550` | Fondo |
| Late night | `#28316B` | Superficies |
| Sodium | `#F3A33C` | Acción principal, presupuesto |
| First light | `#F7D9C4` | Estados completados, amanecer |
| Haze | `#C9D1E8` | Texto secundario |
| Paper | `#F6F7FB` | Texto principal |

- Tipografía: **Familjen Grotesk** (títulos) + **Atkinson Hyperlegible** (texto y números), con fallbacks del sistema.
- **Elemento distintivo (único lugar con audacia):** la "franja de la noche": una barra horizontal desde ahora hasta las 00:00 UTC donde cada tarea es un bloque de ancho proporcional a su costo; durante la ejecución el presupuesto se va consumiendo de izquierda a derecha y el fondo pasa de Sky 4 AM a First light al terminar. Todo lo demás, sobrio.
- Sin etiquetas en mayúsculas sostenidas, sin tarjetas idénticas con sombra genérica, sin animaciones de entrada en cada sección. Accesible: foco visible, `prefers-reduced-motion` respetado, responsive hasta móvil.

---

## 19. Seguridad
1. `mk-` cifrada con AES-256-GCM (`SHIFT_MASTER_KEY`, 32 bytes aleatorios en base64), IV de 12 bytes único por cifrado. Descifrada solo en memoria del worker o del handler que la necesita.
2. Ninguna llave (`mk-`, `sk-`) en logs, respuestas de API, mensajes de error ni en el navegador. `pino` con `redact: ["req.headers.authorization", "*.mk", "*.sk", "*.apiKey"]` y un filtro regex `/(mk|sk)-[A-Za-z0-9_-]+/g → "[REDACTED]"`.
3. Llaves `sk-` efímeras: tope, nivel `private`, nombre identificable, revocación en `finally` + sweeper.
4. Uploads: validar MIME y tamaño; nombres de archivo aleatorios; nunca ejecutar archivos.
5. Rate limits: `/api/connect` 5/min por IP; `/api/runs/now` 1 cada 10 min por usuario.
6. CORS cerrado al dominio propio. Cookies `httpOnly`, `secure`, `sameSite=lax`.
7. La `OPERATOR_PRIVATE_KEY` solo en el worker. La web solo lee la cadena.
8. **Términos de iAI:** confirmar con 0G (Gathin, booth) que usar créditos vía llaves delegadas y donar el sobrante está permitido. Documentar la respuesta.

---

## 20. Variables de entorno

| Variable | Ejemplo / valor | Usado por |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | web, worker |
| `SESSION_SECRET` | 32+ caracteres aleatorios | web |
| `SHIFT_MASTER_KEY` | base64 de 32 bytes | web, worker |
| `ZG_ROUTER_BASE_URL` | `https://router-api.0g.ai/v1` | core |
| `ZG_CHAIN_ID` | `16661` [VERIFICAR] | core |
| `ZG_CHAIN_RPC_URL` | `https://evmrpc.0g.ai` [VERIFICAR] | core |
| `ZG_EXPLORER_URL` | `https://chainscan.0g.ai` | web |
| `LEDGER_CONTRACT_ADDRESS` | `0x...` (tras desplegar) | core |
| `OPERATOR_PRIVATE_KEY` | `0x...` (solo worker) | worker |
| `ZG_STORAGE_INDEXER_URL` | [VERIFICAR en docs de Storage] | worker, web |
| `NIGHT_START_UTC` | `23:00` | worker |
| `NIGHT_HARD_STOP_UTC` | `23:50` | worker |
| `SAFETY_MARGIN_PCT` | `10` | worker |
| `MAX_CONCURRENCY` | `3` | worker |
| `UPLOAD_DIR` | `/data/uploads` (volumen persistente) | web, worker |
| `COMMONS_GATE_THRESHOLD` | `0.75` | worker |
| `PUBLIC_APP_URL` | `https://shift-...` | web |

Validar todas con `zod` al arrancar; si falta alguna, el proceso no inicia.

---

## 21. Fase 0 — Spike de verificación (primeras 2 horas, OBLIGATORIO)

Crear `scripts/smoke.ts` que ejecute estas pruebas **reales** con la cuenta del equipo (con créditos pedidos en el Telegram de builders de 0G). Registrar resultados en `docs/SPIKE_RESULTS.md`.

| ID | Qué verificar | Cómo | Fallback si falla |
|---|---|---|---|
| U1 | Los créditos aparecen en `credit_balance` | `GET /v1/account/balance` con `mk-` (`account:read`) | Usar `/v1/account/funds`; si los créditos no son distinguibles, ofrecer solo **modo presupuesto** y explicarlo |
| U2 | Campos de `POST /v1/api-keys`: límite de crédito y `trust_mode` | Leer OpenAPI + crear llave real | Sin límite por llave → control propio (sección 8.3, punto 6) |
| U3 | La inferencia con la `sk-` nueva consume crédito, no depósito | 1 chat mínimo + `GET /v1/account/usage/history` (`credit_used`/`deposit_used`) | Comparar saldos antes/después |
| U4 | Revocación inmediata | `DELETE /v1/api-keys/:id` → siguiente llamada `401 api_key_revoked` | — (crítico; si falla, no lanzar) |
| U5 | `GET /v1/account` devuelve dirección y moneda | Llamada real | Usar el root/identificador que devuelva; si no hay dirección, identidad = hash de la `mk-` |
| U6 | Catálogo: IDs de modelos TeeML, precios, unidades (Whisper por segundo, imágenes por tier) | `GET /v1/models` | Ajustar estimador |
| U7 | Schema de `/v1/decisions` y IDs de Laya/Vela | OpenAPI + llamada real | Si falla: clasificación de complejidad con un chat barato en JSON estricto (sigue siendo real; documentarlo) |
| U8 | `x_0g_trace` con `verify_tee: true` en chat, imagen y audio | Llamadas reales | Si un endpoint no acepta `verify_tee`, omitirlo solo ahí |
| U9 | 0G Storage: paquete, indexer, subida y descarga, formato del root | Subir y bajar un JSON | Testnet de Storage, declarado |
| U10 | Chain ID y RPC de mainnet; desplegar contrato de prueba | `cast chain-id`, `forge create` | Galileo testnet, declarado |
| U11 | Fecha y hora límite de entrega | Dashboard de ETHGlobal | — |
| U12 | Permiso de 0G para el uso delegado de créditos de iAI | Preguntar a Gathin en el booth | Si dicen que no: modo presupuesto como principal |

**Regla:** nada que dependa de un supuesto se construye antes de que su prueba pase o tenga fallback decidido.

---

## 22. Plan de trabajo por fases y horas

Supuesto: equipo de 3 personas, ~24 h efectivas cada una. **H0 = momento de empezar a programar.**

| Fase | Horas | Persona A (backend / 0G) | Persona B (contratos / storage) | Persona C (frontend / demo) |
|---|---|---|---|---|
| F0 Spike | H0–H2 | `smoke.ts` U1–U8, U12 | U9–U10, scaffold monorepo, Foundry | Pedir créditos en Telegram, scaffold Next.js, dirección visual |
| F1 Conexión | H2–H8 | Cliente Router (`packages/core/zg`), onboarding `mk-`, vault AES, ciclo de vida `sk-` | Contrato + tests forge + deploy | `/connect`, `/` con cuenta regresiva, sesión |
| F2 Ejecución | H8–H14 | Ejecutores de los 3 tipos, worker + cron + lock, sweeper | Cliente 0G Storage, subida de salidas, Merkle TS + test de paridad con Solidity | `/queue` con uploads y vista previa del plan |
| F3 Optimizador y anclaje | H14–H20 | Optimizador + decisiones + replanificación | `anchorNight`, manifiesto, `recordDonations`, `/api/verify` | `/nights/[id]` con tarjetas de procedencia, `/verify` |
| **Checkpoint H20** | — | **Todo el núcleo (M1–M9) funcionando de punta a punta con una ejecución real "Run now" anclada en 0G Chain.** Si no, todo el equipo cierra el núcleo; S y C se cancelan. | | |
| F4 Común | H20–H26 | Cola común + compuerta de calidad | Seed de textos (licencia), donaciones en contrato | `/commons`, franja de la noche animada |
| Ciclo real | ventana 04:30–05:20 IST del 7 nov | Monitorear el lote nocturno real | Verificar anclaje en chainscan | Capturas y grabación para el video |
| F5 Extras | H26–H30 | (Could) C1 cifrado / C3 TEE | (Could) Apéndice A Arkiv | Pulido, móvil, accesibilidad |
| F6 Entrega | últimas 4–6 h | README, tabla de request IDs | Direcciones y enlaces | Video < 3 min, pitch, envío |

**Orden de recorte si hay retraso:** C1 → C2 → C3 → S2 → compuerta de doble modelo (dejar un modelo + decisión) → S1 completa. **Nunca se recorta:** optimizador, ciclo de vida de llaves, anclaje en 0G Chain, verificador.

---

## 23. Pruebas

1. **Unitarias (`vitest`)**
   - Optimizador: presupuesto 0, presupuesto justo, tareas diferidas, mejoras greedy, replanificación por desvío.
   - Estimador de costos con precios fijos de ejemplo.
   - Vault AES-GCM: cifrar/descifrar, auth tag alterado → error.
   - Merkle: árbol con 1 y N hojas; **paridad** del `leafHash` TS vs Solidity (vector fijo compartido).
   - Redacción de logs: ninguna cadena `mk-`/`sk-` sobrevive.
2. **Contratos (`forge test`)**: solo owner, doble anclaje revierte, donaciones duplicadas revierten, `verifyLeaf` true/false con vector de TS.
3. **Integración real (`scripts/smoke.ts` y `scripts/e2e.ts`)**: con la cuenta del equipo: conectar → 1 tarea de cada tipo → "Run now" → verificar en `/verify`. Costo mínimo.
4. **Checklist manual antes del ciclo real**: worker corriendo, reloj del servidor en UTC, operador con gas, sweeper activo, logs sin secretos.

---

## 24. Guion de la demo (3 minutos)

| Tiempo | Qué se muestra | Qué se dice |
|---|---|---|
| 0:00–0:20 | Inicio: cuenta regresiva al corte | "Every night at 00:00 UTC, unused 0G compute credits expire. By design." |
| 0:20–0:45 | Conectar cuenta con `mk-` de permisos mínimos | "No OAuth exists for third-party apps, so we built scoped delegation: Shift can read balances and mint short-lived capped keys, nothing else." |
| 0:45–1:15 | Cola con 3 tareas + vista previa del plan | "0G's decision models classify each task, and our optimizer picks the cheapest model that meets the quality bar — fast answers for simple tasks, deep reasoning for hard ones." |
| 1:15–1:55 | "Run tonight's shift now": ejecución **real**, saldo bajando, resultados apareciendo | "This is a real run on 0G Private Computer, in TEE-sealed models. The key is created, capped, used, and revoked." |
| 1:55–2:25 | Cola común: una traducción aceptada y una rechazada | "What's left goes to the commons: Ethereum docs in Hindi and Marathi, accepted only when two models agree according to 0G's decision model." |
| 2:25–2:50 | Verificador con un request ID del **ciclo nocturno real** del 7 nov | "Anyone can verify which model produced it, who it belongs to, and who donated the compute — anchored on 0G Chain, stored on 0G Storage." |
| 2:50–3:00 | Cierre | "Without 0G, these credits don't exist and these results have no proof of origin. Shift makes every iAI credit count." |

Grabar el video con un ciclo real ya completado como respaldo, pero en vivo ejecutar "Run now" real.

---

## 25. Checklist de entrega

**README.md** debe incluir:
- [ ] Qué es Shift (2 párrafos) y la frase "qué se rompe sin 0G".
- [ ] Cómo usa 0G: Private Computer (modelos, niveles de confianza), modelos de decisión, 0G Storage, 0G Chain (dirección del contrato).
- [ ] **Tabla de request IDs reales** de los ciclos nocturnos (fecha, tarea, modelo, request ID, enlace al verificador).
- [ ] Dirección de `ShiftLedger` y transacciones de anclaje (enlaces a chainscan).
- [ ] Root hashes de manifiestos en 0G Storage.
- [ ] Arquitectura (diagrama de la sección 4).
- [ ] Instalación local paso a paso y variables de entorno.
- [ ] Limitaciones honestas (resultados de la Fase 0, fallbacks usados).
- [ ] Cómo se usó IA para programar (regla de ETHGlobal).
- [ ] Licencia del código (MIT) y de los textos de la cola común.

**Formulario de ETHGlobal / 0G:**
- [ ] Nombre y descripción corta.
- [ ] Repo público con historial de commits constante.
- [ ] Video demo < 3 min.
- [ ] Enlace a demo en vivo.
- [ ] Direcciones de contratos.
- [ ] Integrantes con Telegram y X.
- [ ] Premios seleccionados: 0G (Build with 0G PC) + hasta 2 más (Arkiv si se hizo el Apéndice A).

---

## 26. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Créditos de iAI no distinguibles o no usables vía Router | Media | U1/U3 en Fase 0; modo presupuesto como fallback real |
| `POST /v1/api-keys` sin límite por llave | Media | Control de gasto propio + lectura de saldo cada 5 llamadas |
| Schema de `/v1/decisions` distinto | Media | Leer OpenAPI primero; fallback con chat JSON estricto |
| Proveedor privado saturado (`429`, `503`) | Media | Reintentos con `Retry-After`; modelo alternativo del mismo tipo |
| 0G Storage lento o caído | Baja-media | Reintentos; testnet declarada como fallback |
| Worker caído en la ventana nocturna | Baja | Alertas en logs, sweeper, ejecución manual real de respaldo |
| Juez ve el Merkle como redundante | Media | Explicar: atribución + curaduría, no prueba de inferencia (sección 4) |
| Filtración de `mk-` | Baja | Cifrado en reposo, redacción de logs, scopes mínimos, revocable por el usuario |
| Términos de iAI no permiten el uso | Baja | Confirmar con 0G (U12); modo presupuesto |
| Tiempo insuficiente | Media | Checkpoint H20 y orden de recorte |

---

## Apéndice A — Integración opcional con Arkiv (solo si el núcleo está listo en H20)

- **Idea:** la cola de tareas pendientes como entidades de Arkiv que **expiran en el próximo 00:00 UTC**, igual que los créditos. 0G sigue guardando todo lo permanente (salidas, manifiesto, anclaje).
- **Requisitos del premio "Build on Arkiv (from scratch)"** [VERIFICADO en la página de premios]: escribir en el testnet actual de Arkiv con `@arkiv-network/sdk` o JSON-RPC; al menos una función visible para el usuario que **lea** de Arkiv; README con wallets que escribieron entidades y una consulta ejecutable; archivos `/arkiv/schema.md`, `/arkiv/friction.md`, `/arkiv/reach.md`, `/arkiv/why-arkiv.md`, `/arkiv/how-you-use-arkiv.md`; repo con licencia abierta; declarar uso de IA.
- **Implementación mínima:** al crear una tarea, crear entidad `{taskId, owner, type, priority}` con expiración al próximo corte; la página `/queue` lee la cola desde Arkiv; el worker marca la entidad como procesada.
- **Presupuesto de tiempo:** ventana fija de 6 h. Si no queda funcionando, se elimina sin tocar el núcleo.

---

## Apéndice B — Prompts base

**AUDIO_SUMMARY (resumen):**
```
System: You summarize transcripts. Respond ONLY with JSON:
{"summary": string (max 120 words), "keyPoints": string[] (max 6)}.
Write in the same language as the transcript.
User: <transcript>
```

**DOC_ANALYSIS:**
```
System: You analyze documents. Respond ONLY with JSON:
{"summary": string (max 150 words), "actionItems": string[], "risks": string[]}.
Write in the same language as the document. Do not invent facts that are not in the text.
User: <document text, truncated to the model's context budget>
```

**IMAGE_FROM_PROMPT (mejorar prompt):**
```
System: Rewrite the user's idea into one detailed image prompt (max 60 words).
No real people, no logos, no copyrighted characters. Respond ONLY with the prompt.
User: <idea>
```

**Traducción (cola común):**
```
System: Translate the text from English to <Hindi|Marathi>. Keep technical terms
(Ethereum, smart contract, gas, wallet) in their common usage. Respond ONLY with the translation.
User: <source paragraph>
```

Validar toda salida JSON con `zod`; si falla el parseo, 1 reintento con el mensaje de error; si vuelve a fallar, la tarea queda `FAILED` (real, sin inventar contenido).

---

## Apéndice C — Glosario y referencias

- **iAI (Infinite AI):** activo de 0G; en staking da 1.271 créditos/día, se renuevan a 00:00 UTC sin acumularse.
- **`mk-` / `sk-`:** llaves de gestión / de inferencia del 0G Router.
- **TeeML / private:** el modelo corre dentro de un enclave TEE; ni 0G ni el proveedor ven la inferencia.
- **verified:** la respuesta provino del modelo real (atestación de ruta); **standard:** sin verificación.
- **`x_0g_trace`:** traza por respuesta con request ID, proveedor y costos.
- **Modelos de decisión (Laya, Vela):** responden preguntas tipificadas con probabilidades, no texto.

**Referencias oficiales**
- 0G Router (overview): `https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview`
- Autenticación (`mk-`/`sk-`, scopes): `https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/authentication`
- Router API + OpenAPI + changelog: `https://0gfoundation.github.io/0g-router/`
- Privacidad y niveles de confianza: `https://0g.ai/blog/data-privacy-on-0g-private-computer`
- iAI: `https://0g.ai/blog/introducing-infinite-ai` y `https://0g.ai/blog/infinite-ai-technical-breakdown`
- Compute Finance: `https://0g.ai/blog/compute-finance`
- Premios ETHGlobal Mumbai: `https://ethglobal.com/events/mumbai/prizes`
- Docs generales de 0G (Storage, Chain): `https://docs.0g.ai`
- Workshop de 0G en ETHGlobal Mumbai (Gathin T): `https://www.youtube.com/live/by9Rm-Vh1qY`

---

## 27. Orden del repositorio, seguimiento y commits

La presentación ante ETHGlobal incluye el repo: los jueces ven la estructura, el README y el historial de commits. Estas reglas son obligatorias.

### 27.1 Archivos de orden (incluidos en el kit)
| Archivo | Para qué | Idioma |
|---|---|---|
| `CLAUDE.md` | Reglas de trabajo que Claude Code lee automáticamente en cada tarea | Inglés |
| `PROGRESS.md` | Lista viva: hecho, siguiente, resultados de la Fase 0, ejecuciones reales, decisiones, bloqueos | Inglés |
| `docs/STRUCTURE.md` | Estructura actual y destino del monorepo; dónde va cada archivo | Inglés |
| `README.md` | README público para jueces; se completa en F6 solo con datos reales | Inglés |
| `docs/PHASE0_KIT.md` | Cómo correr el kit de la Fase 0 | Español |
| `LICENSE` | MIT | Inglés |

No se crean otros archivos markdown en la raíz; se agregan secciones a los existentes.

### 27.2 Flujo por ítem
1. Tomar el siguiente ítem sin marcar de `PROGRESS.md`.
2. Implementar solo ese ítem y sus pruebas.
3. Correr typecheck, pruebas y `forge test` si cambian contratos.
4. Marcar el ítem en `PROGRESS.md` (con nota si hubo cambio respecto al plan) **en el mismo commit**.
5. Commit + push. Resumen breve al usuario.

### 27.3 Reglas de commits
- **Meta: 50–90 commits en todo el proyecto** (el `PROGRESS.md` planea ~58 más algunos `fix:`).
- **Un commit = un ítem** de `PROGRESS.md` que compila y pasa pruebas; los ítems grandes se dividen en 2–3 commits.
- **Tamaño orientativo:** 50–400 líneas de código escrito a mano por commit (no cuentan lockfiles, tipos generados ni assets).
- **Sin ruido:** correcciones a un commit aún no subido van con `git commit --amend`; correcciones a trabajo ya subido, en un solo `fix:`.
- **Formato Conventional Commits en inglés**, imperativo, ≤ 72 caracteres: `feat(core): add budget optimizer with greedy upgrades`. Tipos: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`. Ámbitos: `core`, `web`, `worker`, `contracts`, `db`, `scripts`, `spike`.
- **Sin líneas de atribución de IA** en commits ni PRs; el uso de IA se declara una vez en el README ("How we used AI"), como pide ETHGlobal.
- **Ritmo constante** a lo largo de la hackathon; nunca acumular horas de trabajo en un solo commit. No reescribir historial ya subido salvo que el usuario lo pida.

