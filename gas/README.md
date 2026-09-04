# Plan B — Monitor Help Desk ETB en Google Apps Script

Dashboard autocontenido que corre 100 % en Google (macro + web app), con la misma
lógica del web app: Salesforce → segmentación por NIT → métricas por segmento →
mapa de calor. Todos los segmentos (Distrito, Élite, Premium, Mayoristas, Silver, Gold).

## Archivos
- `Codigo.gs` — backend (Salesforce, segmentos, geo, métricas, web app).
- `Index.html` — tablero (KPIs, barras tricolor, mapa de calor Leaflet, tabla).
- `appsscript.json` — manifiesto (permisos, zona horaria, runtime V8).

## Instalación (10 min)

1. **Crea la hoja base.** En Google Sheets, crea un archivo y una pestaña llamada
   exactamente `BASE_CLIENTES` con encabezados en la fila 1:
   `ID_IDENTIFICACION`, `MESA` (y opcional `NOMBRE_CUENTA`). Pega ahí tu base
   (los mismos 18.513 NITs). La MESA es la que define el segmento.

2. **Abre el editor de Apps Script.** En esa hoja: *Extensiones → Apps Script*.

3. **Pega los archivos:**
   - Renombra `Código.gs` y pega el contenido de `Codigo.gs`.
   - *+ → HTML*, nómbralo `Index`, pega el contenido de `Index.html`.
   - *Proyecto (⚙) → “Mostrar appsscript.json”* y pega `appsscript.json`.

4. **Configura Salesforce.** Menú de la hoja *Monitor ETB → Configurar Salesforce…*
   (recarga la hoja si no aparece), o en *Apps Script → Configuración del proyecto →
   Propiedades del script* agrega:
   - `SF_USERNAME`, `SF_PASSWORD`, `SF_TOKEN`, `SF_DOMAIN` (`login` o `test`).
   - Opcionales (ya traen default correcto): `SF_NIT_FIELD=AccountNumber__c`,
     `SF_CITY_FIELD=Ciudad_Instalacion__c`,
     `SF_CITY_NAME_FIELD=Ciudad_Instalacion__r.Name`,
     `SF_ADDRESS_FIELD=Direccion_Instalacion__c`,
     `SF_RECORD_TYPE=SOPORTE TECNICO`, `SF_WINDOW_DAYS=60`.

5. **Prueba la conexión.** Menú *Monitor ETB → Probar conexión Salesforce*.
   La primera vez Google pide autorizar permisos (llamadas externas + la hoja).

6. **Publica el tablero.** *Implementar → Nueva implementación → Aplicación web*
   → “Ejecutar como: yo”, “Acceso: cualquiera”. Abre la URL `…/exec`.

## Notas
- Las métricas se calculan en el servidor (Apps Script) y se cachean 5 min, así que
  el tablero abre rápido; “Refrescar” fuerza recálculo.
- El mapa usa Leaflet + leaflet.heat por CDN (permitido en el iframe de Apps Script).
- Distrito y Élite muestran solo Bogotá (con localidades); el resto, Colombia.
- Los casos cuyo NIT no está en `BASE_CLIENTES` quedan como “Sin clasificar”
  (cuentan en Todos, no en un segmento) — igual que en el web app.
- Geolocalización idéntica al web app: coordenadas embebidas en la dirección →
  localidad/ciudad por texto → catálogo → centro de Bogotá.
