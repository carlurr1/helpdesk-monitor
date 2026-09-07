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
  nit_ext           text,               -- Identificador Externo (Distrito/Élite comparten NIT)
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
  direccion         text,               -- Direccion_Instalacion__c (para ubicar en el navegador)
  proceso           text,               -- Proceso__c
  origen            text,               -- Origin (Origen del caso)
  id_servicio       text,               -- IDServicio__c
  id_legado         text,               -- Id_Sistema_Legado__c (INC000…)
  departamento      text,
  lat               double precision,
  lng               double precision,
  sincronizado_en   timestamptz default now()
);
create index if not exists idx_casos_nit on casos(nit);
create index if not exists idx_casos_nit_ext on casos(nit_ext);
create index if not exists idx_casos_abierto on casos(abierto);
create index if not exists idx_casos_apertura on casos(fecha_apertura);
create index if not exists idx_casos_cierre on casos(fecha_cierre);

-- ── Caché de geocodificación (dirección → lat/lng) ────────
-- Evita volver a llamar al geocodificador (Nominatim/OSM) por la misma
-- dirección en cada sync. Se llena solo; respeta el límite de 1 req/s.
create table if not exists geocache (
  direccion       text primary key,     -- dirección normalizada (MAYÚSCULAS, sin dobles espacios)
  lat             double precision,
  lng             double precision,
  ciudad          text,                 -- localidad/ciudad legible que devolvió el geocodificador
  fuente          text,                 -- 'nominatim' | 'texto' | 'bogota-centro'
  actualizado_en  timestamptz default now()
);

-- ── Vista: casos enriquecidos con el segmento del cliente ──
-- Aquí ocurre el cruce por NIT. El front consulta esta vista, no Salesforce.
-- Un caso cuyo NIT no está en la base queda 'Sin clasificar' (sigue contando).
-- El cruce por NIT tiene un caso especial: Distrito y Élite (entidades
-- distritales de Bogotá) COMPARTEN el NIT (899999061) y se diferencian por el
-- Identificador Externo (899999061013, …). La base los trae con ese identificador
-- en la misma columna del NIT. Por eso se cruza PRIMERO por nit_ext (identificador
-- externo) y, si no encontró, por el NIT normal.
-- Nota: al agregar columnas a `casos`, `create or replace view` falla porque
-- `c.*` corre las posiciones. Por eso se BORRA y se recrea.
drop view if exists casos_segmentados;
create view casos_segmentados as
select
  c.*,
  coalesce(cle.segmento, cln.segmento, 'Sin clasificar') as segmento,
  coalesce(cle.gestionado, cln.gestionado)               as gestionado,
  coalesce(cle.nombre, cln.nombre)                        as cliente_base
from casos c
left join clientes cle on cle.nit = c.nit_ext   -- 1º por Identificador Externo
left join clientes cln on cln.nit = c.nit        -- 2º por NIT
where c.estado is distinct from 'Cancelado';     -- doble candado anti-cancelado
