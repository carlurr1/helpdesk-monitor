# Monitor Help Desk — ETB

Monitor unificado de casos de **soporte técnico** en Salesforce por **segmento de
cliente** (Distrito, Élite, Premium, Mayoristas, Silver, Gold). Un selector arriba
cambia todo el tablero. Reemplaza el Monitor Distrito de Google Apps Script.

## Arquitectura (híbrida)

```
Salesforce ──sync cada pocos min──►  Supabase (Postgres)  ◄──lee── Next.js (Vercel)
   │  (login SOAP, solo SOPORTE           │  casos + clientes           │  UI, mapa,
   │   TECNICO, sin Cancelado, por NIT)   │  (JOIN por NIT)             │  gráficas
   └──alertas en vivo───────────────────────────────────────────────────┘
```

- **KPIs, tablas, mapa y gráficas** se leen de Supabase → milisegundos, sin reventar
  el límite de API de Salesforce por más agentes que entren.
- **Alertas** se consultan en vivo a SF.
- El **segmento** NO está en Salesforce: vive en la **base de clientes** (Excel) y se
  cruza por **NIT** contra los casos de SF.

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** + **Recharts**
- **Salesforce**: login SOAP (usuario + contraseña + token) y consulta REST
- **Supabase** (Postgres): cache de casos + base de segmentos por NIT

## Modelo de datos

**Reglas de la consulta de casos (confirmadas):**
- `RecordType.Name = 'SOPORTE TECNICO'` (solo soporte).
- `Status != 'Cancelado'` (se excluyen).
- **Sin filtro de owner** — todo por NIT: base `ID_IDENTIFICACION` ↔ Salesforce
  `Account."Número de Documento"`.

**Segmentos** (`src/lib/segmentos.ts`) — la **MESA** manda. Base de Julio:
18.524 filas → **18.513 NITs únicos** (11 duplicados descartados).

| Segmento | Clientes | Mesa(s) |
|---|---:|---|
| Silver | 17.949 | S1 / S2 / S6 + N1 + U1 (proyección/NUEVO/universidades) |
| Gold | 227 | GOLD |
| Mayoristas | 165 | MAYORISTAS |
| Distrito | 84 | DISTRITO |
| Premium | 79 | P1..P5 + MEN |
| Élite | 9 | ELITE |
| **TOTAL** | **18.513** | |

> **No existe bucket "Otros".** La MESA es la fuente de verdad: mesa **N1**
> (proyecciones/demos que aún no contratan), S1/S2/S6, U1 o vacío se suman a
> **Silver**. La columna `SEGMENTO` vieja se ignora para clasificar.

## Geo / mapa — BLINDADO

La ubicación sale del campo de ciudad del caso en SF (`SF_CITY_FIELD`, configurable).
`src/lib/geo.ts` resuelve ciudad → coordenadas con fallback a departamento y detalle de
localidades de Bogotá (para Distrito).

> Si una ciudad no se reconoce, `resolverGeo()` devuelve `null`: **el caso sigue
> contando** en KPIs, filtros y tablas; solo no se pinta en el mapa. Nada se rompe.

## Estructura

```
src/
├── app/
│   ├── layout.tsx / page.tsx / globals.css   ← shell + landing (Fase 2: tablero)
├── lib/
│   ├── salesforce.ts   ← login SOAP + query REST + SOQL de casos (3 reglas)
│   ├── segmentos.ts    ← normalización de segmento + NIT (la MESA manda)
│   ├── geo.ts          ← ciudad/departamento → coordenadas (blindado)
│   ├── supabase.ts     ← clientes server (service_role) y browser (anon)
│   └── stats.ts        ← percentiles / formato de tiempos
supabase/
└── schema.sql          ← tablas clientes, casos + vista casos_segmentados
scripts/
└── ingest-clientes.ts  ← carga la base Excel → Supabase.clientes
```

## Puesta en marcha

```bash
cp .env.example .env.local        # llenar credenciales (nunca commitear)
npm install
# 1. crear tablas: pegar supabase/schema.sql en el SQL editor de Supabase
# 2. cargar la base de clientes:
npm run ingest:dry -- ./BASE_CLIENTES.xlsx   # valida y muestra la distribución
npm run ingest     -- ./BASE_CLIENTES.xlsx   # sube a Supabase
npm run dev
```

## Variables de entorno

Ver `.env.example`. Salesforce (`SF_USERNAME/PASSWORD/TOKEN/DOMAIN`), nombres de campo
API (`SF_NIT_FIELD`, `SF_RECORD_TYPE`, `SF_CITY_FIELD`), Supabase (`SUPABASE_URL`,
`SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) y
`CRON_SECRET` (protege el sync). Las credenciales van solo en `.env.local` y en las
*Environment Variables* de Vercel.

## Sync automático (cron)

Los casos se refrescan con un cron que llama a **`/api/sync`**, protegido con
`CRON_SECRET` (Vercel lo envía como `Authorization: Bearer`).

- **`vercel.json`** usa `0 11 * * *` (diario, 6 a.m. Colombia) — el máximo que
  permite el plan **Hobby**. En **Pro**, cámbialo a `*/5 * * * *` (cada 5 min).
- **Sync frecuente en Hobby (gratis):** un cron externo (cron-job.org) o un
  GitHub Action que haga `curl` a `/api/sync` cada pocos minutos.
- **Manual:** `curl -H "Authorization: Bearer <CRON_SECRET>" https://TU-APP.vercel.app/api/sync`
- El endpoint corre el mismo `syncCasos()` que `npm run sync` (SF → `casos`).

## Roadmap

- [x] **Fase 0** — Capa de datos: esquema, normalización de segmento/NIT, ingesta, cliente SF, geo.
- [ ] **Fase 1** — Sync SF → Supabase (`scripts/sync-casos.ts` + cron) con las 3 reglas.
- [ ] **Fase 2** — UI: selector de segmento + KPIs, tablas, gráficas.
- [ ] **Fase 3** — Mapa adaptativo (Bogotá para Distrito, nacional para el resto).
- [ ] **Fase 4** — Alertas en vivo + export (Excel/imagen) + pulido visual.
- [ ] **Fase 5** — Accesos por equipo de help desk (Supabase Auth + roles).

## Pendientes de confirmar

1. **Cruce NIT Distrito/Élite** (Colab): pegar en `NIT_OVERRIDES` de `src/lib/segmentos.ts`.
2. **Nombres de campo SF reales**: `Número de Documento`, ciudad, tipo de registro (van en `.env.local`).
