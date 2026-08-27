-- ============================================================
--  Monitor Help Desk — Esquema Supabase (Postgres)
--  Modelo: segmento por NIT (base de clientes) + casos desde Salesforce.
--  El segmento NO vive en Salesforce: vive aquí y se cruza por NIT.
-- ============================================================

-- ── Dimensión: base de clientes ────────────────────────────
-- Se carga desde BASE_CLIENTES (Excel) con scripts/ingest-clientes.
-- Se actualiza cuando cambie la base; NO se consulta a Salesforce.
create table if not exists clientes (
  nit             text primary key,      -- ID_IDENTIFICACION (= "Número de Documento" en SF)
  nombre          text,                  -- NOMBRE_CUENTA
  propietario     text,                  -- PROPIETARIO_CUENTA
  segmento_raw    text,                  -- SEGMENTO      (columna vieja, ruidosa; solo referencia)
  segmento_uen    text,                  -- SEGMENTO_UEN  (NUEVO/SILVER/GOLD/DISTRITO/...)
  mesa            text,                  -- MESA          (fuente de verdad: N1/S1/GOLD/DISTRITO/...)
  segmento        text,                  -- NORMALIZADO: Distrito/Élite/Premium/Mayoristas/Silver/Gold
  gestionado      boolean default true,  -- con la regla actual toda la base es gestionada
  actualizado_en  timestamptz default now()
);
create index if not exists idx_clientes_segmento on clientes(segmento);

-- ── Hechos: casos (sincronizados desde Salesforce cada pocos min) ──
-- Reglas de la consulta SF:
--   • Tipo de registro (RecordType) = 'SOPORTE TECNICO'
--   • Estado (Status) != 'Cancelado'
--   • SIN filtro de owner  →  todo se cruza por NIT
create table if not exists casos (
  id                text primary key,    -- SF Case Id
  numero            text,                -- CaseNumber
  nit               text,               -- Case.AccountNumber__c ("Nit Cliente")
  cuenta_nombre     text,               -- Account.Name
  tipo_registro     text,               -- RecordType.Name (debe ser 'SOPORTE TECNICO')
  estado            text,               -- Status
  categoria         text,
  tipologia         text,
  abierto           boolean,            -- IsClosed = false
  fecha_apertura    timestamptz,        -- CreatedDate  → "ingresos"
  fecha_cierre      timestamptz,        -- ClosedDate   → "cerrados"
  inicio_afectacion timestamptz,        -- FechaInicioAfectacion__c → TMS
  fin_afectacion    timestamptz,        -- FechaFinAfectacion__c
  ciudad            text,               -- de SF → mapa nacional
  departamento      text,
  lat               double precision,
  lng               double precision,
  sincronizado_en   timestamptz default now()
);
create index if not exists idx_casos_nit on casos(nit);
create index if not exists idx_casos_abierto on casos(abierto);
create index if not exists idx_casos_apertura on casos(fecha_apertura);
create index if not exists idx_casos_cierre on casos(fecha_cierre);

-- ── Vista: casos enriquecidos con el segmento del cliente ──
-- Aquí ocurre el cruce por NIT. El front consulta esta vista, no Salesforce.
-- Un caso cuyo NIT no está en la base queda 'Sin clasificar' (sigue contando).
create or replace view casos_segmentados as
select
  c.*,
  coalesce(cl.segmento, 'Sin clasificar') as segmento,
  cl.gestionado,
  cl.nombre as cliente_base
from casos c
left join clientes cl on cl.nit = c.nit
where c.estado is distinct from 'Cancelado';   -- doble candado anti-cancelado
