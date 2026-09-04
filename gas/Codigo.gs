/**
 * ============================================================
 *  Monitor Help Desk · ETB — Plan B en Google Apps Script
 *  Macro/dashboard autocontenido: Salesforce → segmentación por NIT
 *  (base en una hoja) → métricas por segmento → HTML con mapa de calor.
 *
 *  Reglas (idénticas al web app):
 *   • RecordType = 'SOPORTE TECNICO', Status != 'Cancelado', cruce por NIT.
 *   • Segmento por MESA de la base: ELITE→Élite, MAYORISTAS, DISTRITO, GOLD,
 *     MEN/P1..P5→Premium, resto→Silver.
 *   • Distrito y Élite son distritales (mapa Bogotá); el resto, Colombia.
 *
 *  CONFIGURACIÓN (una sola vez): menú "Monitor ETB → Configurar Salesforce"
 *  o Proyecto → Configuración → Propiedades del script:
 *     SF_USERNAME, SF_PASSWORD, SF_TOKEN, SF_DOMAIN(login|test),
 *     SF_NIT_FIELD (def AccountNumber__c), SF_CITY_FIELD (def Ciudad_Instalacion__c),
 *     SF_CITY_NAME_FIELD (def Ciudad_Instalacion__r.Name),
 *     SF_ADDRESS_FIELD (def Direccion_Instalacion__c),
 *     SF_RECORD_TYPE (def SOPORTE TECNICO), SF_WINDOW_DAYS (def 60).
 *  La base de clientes va en una hoja llamada BASE_CLIENTES con encabezados
 *  ID_IDENTIFICACION y MESA (y opcional NOMBRE_CUENTA).
 * ============================================================
 */

// ─── Config ────────────────────────────────────────────────
function cfg_() {
  var p = PropertiesService.getScriptProperties();
  return {
    USERNAME:  p.getProperty('SF_USERNAME') || '',
    PASSWORD:  p.getProperty('SF_PASSWORD') || '',
    TOKEN:     p.getProperty('SF_TOKEN') || '',
    DOMAIN:    p.getProperty('SF_DOMAIN') || 'login',
    NIT_FIELD:  p.getProperty('SF_NIT_FIELD') || 'AccountNumber__c',
    CITY_FIELD: p.getProperty('SF_CITY_FIELD') || 'Ciudad_Instalacion__c',
    CITY_NAME_FIELD: p.getProperty('SF_CITY_NAME_FIELD') || 'Ciudad_Instalacion__r.Name',
    ADDRESS_FIELD: p.getProperty('SF_ADDRESS_FIELD') || 'Direccion_Instalacion__c',
    RECORD_TYPE: p.getProperty('SF_RECORD_TYPE') || 'SOPORTE TECNICO',
    WINDOW_DAYS: parseInt(p.getProperty('SF_WINDOW_DAYS') || '60', 10)
  };
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Monitor ETB')
      .addItem('Abrir tablero (URL de despliegue)', 'mostrarUrl_')
      .addItem('Probar conexión Salesforce', 'probarSF_')
      .addItem('Configurar Salesforce…', 'configurarSF_')
      .addToUi();
  } catch (e) { /* sin hoja activa */ }
}

function configurarSF_() {
  var ui = SpreadsheetApp.getUi();
  var claves = ['SF_USERNAME', 'SF_PASSWORD', 'SF_TOKEN', 'SF_DOMAIN'];
  var p = PropertiesService.getScriptProperties();
  claves.forEach(function (k) {
    var r = ui.prompt('Configurar ' + k, 'Valor actual: ' + (p.getProperty(k) || '(vacío)'), ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() === ui.Button.OK && r.getResponseText()) p.setProperty(k, r.getResponseText().trim());
  });
  ui.alert('Listo. Ahora despliega: Implementar → Nueva implementación → Aplicación web.');
}

function probarSF_() {
  try {
    var s = sfLogin_();
    var d = sfQuery_(s, "SELECT Id FROM Case LIMIT 1");
    SpreadsheetApp.getUi().alert('Conexión OK. Casos accesibles. Sesión creada.');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error: ' + e.message);
  }
}

function mostrarUrl_() {
  SpreadsheetApp.getUi().alert('Despliega la app: Implementar → Nueva implementación → Aplicación web. Luego abre la URL /exec que te da.');
}

// ─── Salesforce (SOAP login + REST query) ──────────────────
function sfLogin_() {
  var c = cfg_();
  if (!c.USERNAME || !c.PASSWORD || !c.TOKEN) throw new Error('Faltan credenciales SF (Monitor ETB → Configurar).');
  var url = 'https://' + c.DOMAIN + '.salesforce.com/services/Soap/u/59.0';
  var body = '<?xml version="1.0" encoding="utf-8"?>' +
    '<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:env="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<env:Body><n1:login xmlns:n1="urn:partner.soap.sforce.com">' +
    '<n1:username>' + xml_(c.USERNAME) + '</n1:username>' +
    '<n1:password>' + xml_(c.PASSWORD + c.TOKEN) + '</n1:password>' +
    '</n1:login></env:Body></env:Envelope>';
  var res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'text/xml', muteHttpExceptions: true,
    headers: { SOAPAction: 'login' }, payload: body
  });
  var t = res.getContentText();
  if (t.indexOf('faultstring') >= 0 || t.indexOf('INVALID_LOGIN') >= 0) {
    var m = t.match(/<faultstring>(.*?)<\/faultstring>/);
    throw new Error('Login SF: ' + (m ? m[1] : 'credenciales incorrectas'));
  }
  var sid = t.match(/<sessionId>(.*?)<\/sessionId>/);
  var surl = t.match(/<serverUrl>(.*?)<\/serverUrl>/);
  if (!sid || !surl) throw new Error('No se pudo leer la sesión SF.');
  return { sessionId: sid[1], instanceUrl: surl[1].split('/services/Soap/')[0] };
}

function sfQuery_(s, soql) {
  var url = s.instanceUrl + '/services/data/v59.0/query/?q=' + encodeURIComponent(soql);
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + s.sessionId }, muteHttpExceptions: true });
  var data = JSON.parse(res.getContentText());
  if (data.errorCode) throw new Error('SF [' + data.errorCode + ']: ' + data.message);
  return data;
}

function sfQueryAll_(s, soql) {
  var data = sfQuery_(s, soql);
  var recs = (data.records || []).slice();
  while (!data.done && data.nextRecordsUrl) {
    var res = UrlFetchApp.fetch(s.instanceUrl + data.nextRecordsUrl, { headers: { Authorization: 'Bearer ' + s.sessionId }, muteHttpExceptions: true });
    data = JSON.parse(res.getContentText());
    recs = recs.concat(data.records || []);
  }
  return recs;
}

function xml_(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function buildSOQL_() {
  var c = cfg_();
  var san = function (f) { return /^[A-Za-z0-9_.]+$/.test(f) ? f : ''; };
  var cols = ['Id', 'CaseNumber', 'Status', 'IsClosed', 'CreatedDate', 'ClosedDate',
    'RecordType.Name', 'Account.Name', san(c.NIT_FIELD), san(c.CITY_FIELD)];
  if (san(c.CITY_NAME_FIELD)) cols.push(san(c.CITY_NAME_FIELD));
  if (san(c.ADDRESS_FIELD)) cols.push(san(c.ADDRESS_FIELD));
  cols = cols.concat(['Tipologia__c', 'TipoCaso__c', 'Categoria_legado__c', 'FechaInicioAfectacion__c', 'FechaFinAfectacion__c']);
  return 'SELECT ' + cols.filter(String).join(', ') +
    " FROM Case WHERE RecordType.Name = '" + c.RECORD_TYPE.replace(/'/g, "\\'") + "'" +
    " AND Status != 'Cancelado' AND (IsClosed = false OR ClosedDate = LAST_N_DAYS:" + c.WINDOW_DAYS + ')' +
    ' ORDER BY CreatedDate DESC';
}

// ─── Segmentación (mesa → segmento) ────────────────────────
var MESA_MAP_ = { MAYORISTAS: 'Mayoristas', GOLD: 'Gold', DISTRITO: 'Distrito', ELITE: 'Élite', MEN: 'Premium' };
var SEGMENTOS_ = ['Distrito', 'Élite', 'Premium', 'Mayoristas', 'Silver', 'Gold'];
var SEG_BOGOTA_ = ['Distrito', 'Élite'];

function segmentoDe_(mesa) {
  var m = String(mesa || '').trim().toUpperCase();
  if (MESA_MAP_[m]) return MESA_MAP_[m];
  if (/^P\d+$/.test(m)) return 'Premium';
  return 'Silver';
}
function nit_(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

/** Lee la hoja BASE_CLIENTES → { nit: {segmento, nombre} }. */
function baseClientes_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss ? ss.getSheetByName('BASE_CLIENTES') : null;
  if (!sh) throw new Error('Falta la hoja "BASE_CLIENTES" con columnas ID_IDENTIFICACION y MESA.');
  var vals = sh.getDataRange().getValues();
  if (!vals.length) return {};
  var head = vals[0].map(function (h) { return String(h).trim().toUpperCase(); });
  var iId = head.indexOf('ID_IDENTIFICACION');
  var iMesa = head.indexOf('MESA');
  var iNom = head.indexOf('NOMBRE_CUENTA');
  if (iId < 0 || iMesa < 0) throw new Error('BASE_CLIENTES necesita columnas ID_IDENTIFICACION y MESA.');
  var map = {};
  for (var r = 1; r < vals.length; r++) {
    var nit = nit_(vals[r][iId]);
    if (!nit) continue;
    map[nit] = { segmento: segmentoDe_(vals[r][iMesa]), nombre: iNom >= 0 ? String(vals[r][iNom] || '') : '' };
  }
  return map;
}

// ─── Geo (catálogo + texto + coordenadas) ──────────────────
var DEP_ = {'AMAZONAS':[-4.2153,-69.9406],'ANTIOQUIA':[6.2518,-75.5636],'ARAUCA':[7.0847,-70.7591],'ATLANTICO':[10.9685,-74.7813],'BOLIVAR':[10.3910,-75.4794],'BOYACA':[5.5353,-73.3678],'CALDAS':[5.0703,-75.5138],'CAQUETA':[1.6144,-75.6062],'CASANARE':[5.3378,-72.3959],'CAUCA':[2.4448,-76.6147],'CESAR':[10.4631,-73.2532],'CHOCO':[5.6919,-76.6583],'CORDOBA':[8.7479,-75.8814],'CUNDINAMARCA':[4.6486,-74.2479],'HUILA':[2.9273,-75.2819],'LA GUAJIRA':[11.5444,-72.9072],'MAGDALENA':[11.2404,-74.1990],'META':[4.1420,-73.6266],'NARINO':[1.2136,-77.2811],'NORTE DE SANTANDER':[7.9463,-72.8988],'PUTUMAYO':[0.4359,-76.5262],'QUINDIO':[4.5389,-75.6807],'RISARALDA':[4.8133,-75.6961],'SANTANDER':[7.1193,-73.1227],'SUCRE':[9.3047,-75.3978],'TOLIMA':[4.4389,-75.2322],'VALLE DEL CAUCA':[3.4516,-76.5320]};
var CIU_ = {'BOGOTA':[4.7110,-74.0721],'MEDELLIN':[6.2442,-75.5812],'CALI':[3.4516,-76.5320],'BARRANQUILLA':[10.9685,-74.7813],'CARTAGENA':[10.3910,-75.4794],'CUCUTA':[7.8939,-72.5078],'BUCARAMANGA':[7.1193,-73.1227],'PEREIRA':[4.8133,-75.6961],'SANTA MARTA':[11.2404,-74.1990],'IBAGUE':[4.4389,-75.2322],'MANIZALES':[5.0703,-75.5138],'VILLAVICENCIO':[4.1420,-73.6266],'NEIVA':[2.9273,-75.2819],'PASTO':[1.2136,-77.2811],'MONTERIA':[8.7479,-75.8814],'ARMENIA':[4.5389,-75.6807],'VALLEDUPAR':[10.4631,-73.2532],'SINCELEJO':[9.3047,-75.3978],'POPAYAN':[2.4448,-76.6147],'TUNJA':[5.5353,-73.3678],'RIOHACHA':[11.5444,-72.9072],'QUIBDO':[5.6919,-76.6583],'FLORENCIA':[1.6144,-75.6062],'YOPAL':[5.3378,-72.3959],'SOACHA':[4.5794,-74.2168],'BELLO':[6.3379,-75.5556],'SOLEDAD':[10.9186,-74.7645],'ENVIGADO':[6.1667,-75.5833],'ITAGUI':[6.1719,-75.6111],'PALMIRA':[3.5394,-76.3036],'GUAMAL':[3.8804,-73.7669]};
var LOC_ = {'USAQUEN':[4.7014,-74.0317],'CHAPINERO':[4.6486,-74.0628],'SANTA FE':[4.6097,-74.0817],'SAN CRISTOBAL':[4.5717,-74.0862],'USME':[4.5092,-74.1253],'TUNJUELITO':[4.5753,-74.1317],'BOSA':[4.6183,-74.1900],'KENNEDY':[4.6280,-74.1614],'FONTIBON':[4.6714,-74.1469],'ENGATIVA':[4.7089,-74.1197],'SUBA':[4.7411,-74.0836],'BARRIOS UNIDOS':[4.6669,-74.0786],'TEUSAQUILLO':[4.6447,-74.0936],'LOS MARTIRES':[4.6019,-74.0953],'ANTONIO NARINO':[4.5886,-74.1019],'PUENTE ARANDA':[4.6236,-74.1214],'LA CANDELARIA':[4.5964,-74.0756],'RAFAEL URIBE':[4.5636,-74.1086],'CIUDAD BOLIVAR':[4.5131,-74.1628],'SUMAPAZ':[4.1989,-74.2319]};
var LOC_KEYS_ = Object.keys(LOC_).sort(function (a, b) { return b.length - a.length; });
var CIU_KEYS_ = Object.keys(CIU_).sort(function (a, b) { return b.length - a.length; });

function normGeo_(s) {
  var t = String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.replace(/\bBOGOTA D C\b/g, 'BOGOTA').replace(/\bBOGOTA DC\b/g, 'BOGOTA');
}
function tienePalabra_(t, tok) { return (' ' + t + ' ').indexOf(' ' + tok + ' ') >= 0; }
function looksLikeId_(v) { return /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(String(v == null ? '' : v).trim()); }

function validarCoord_(lat, lng) {
  var dentro = function (la, ln) { return la >= -5 && la <= 15 && ln >= -82 && ln <= -66; };
  if (dentro(lat, lng)) return [lat, lng];
  if (dentro(lng, lat)) return [lng, lat];
  return null;
}
function extraerCoord_(texto) {
  var s = String(texto == null ? '' : texto);
  var dec = s.match(/(-?\d{1,2}\.\d{3,})\s*[, ]\s*(-?\d{1,3}\.\d{3,})/);
  if (dec) { var g = validarCoord_(parseFloat(dec[1]), parseFloat(dec[2])); if (g) return g; }
  var re = /(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)?\s*["″]?\s*([NSEWO])?/gi, m, pts = [];
  while ((m = re.exec(s)) && pts.length < 2) {
    var val = parseFloat(m[1]) + (parseFloat(m[2] || '0') || 0) / 60 + (parseFloat(m[3] || '0') || 0) / 3600;
    pts.push({ val: val, dir: (m[4] || '').toUpperCase() });
  }
  if (pts.length >= 2) {
    var lat = pts[0].dir === 'S' ? -pts[0].val : pts[0].val;
    var lng = -Math.abs(pts[1].val);
    var g2 = validarCoord_(lat, lng); if (g2) return g2;
  }
  return null;
}
function cityName_(rec) {
  var c = cfg_();
  var rel = c.CITY_NAME_FIELD;
  if (rel) {
    var parts = rel.split('.'), o = rec[parts[0]];
    var name = o ? o[parts[1] || 'Name'] : null;
    if (name) return String(name).trim();
  }
  var direct = rec[c.CITY_FIELD];
  if (direct != null && !looksLikeId_(direct)) return String(direct).trim();
  return '';
}
function address_(rec) {
  var c = cfg_(); if (!c.ADDRESS_FIELD) return '';
  var v = c.ADDRESS_FIELD.indexOf('.') >= 0
    ? c.ADDRESS_FIELD.split('.').reduce(function (o, k) { return o ? o[k] : null; }, rec)
    : rec[c.ADDRESS_FIELD];
  if (v == null || looksLikeId_(v)) return '';
  return String(v).trim();
}
/** coordenadas → localidad/ciudad en texto → catálogo → centro Bogotá. */
function geoDeCaso_(ciudad, direccion) {
  var coord = extraerCoord_(direccion) || extraerCoord_(ciudad);
  if (coord) return { lat: coord[0], lng: coord[1] };
  var t = normGeo_((ciudad || '') + ' ' + (direccion || ''));
  if (t) {
    for (var i = 0; i < LOC_KEYS_.length; i++) if (tienePalabra_(t, LOC_KEYS_[i])) return { lat: LOC_[LOC_KEYS_[i]][0], lng: LOC_[LOC_KEYS_[i]][1] };
    for (var j = 0; j < CIU_KEYS_.length; j++) if (tienePalabra_(t, CIU_KEYS_[j])) return { lat: CIU_[CIU_KEYS_[j]][0], lng: CIU_[CIU_KEYS_[j]][1] };
  }
  var cc = normGeo_(ciudad);
  if (cc && DEP_[cc]) return { lat: DEP_[cc][0], lng: DEP_[cc][1] };
  if (/\bBOGOTA\b/.test(t)) return { lat: 4.6533, lng: -74.0836 };
  return null;
}

// ─── Métricas ──────────────────────────────────────────────
function categoriaDe_(cat, tip) {
  var t = (String(cat || '') + ' ' + String(tip || '')).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (t.indexOf('INCIDENTE') >= 0) return 'Incidente';
  if (t.indexOf('EVENTO') >= 0) return 'Evento';
  if (t.indexOf('REQUERIMIENTO') >= 0 || t.indexOf('SOLICITUD') >= 0 || t.indexOf('PETICION') >= 0) return 'Requerimiento';
  return 'Otros';
}
function edadDias_(fecha, now) { if (!fecha) return 0; return Math.max(0, Math.round((now - new Date(fecha)) / 86400000 * 10) / 10); }
function semaforo_(e) { return e >= 8 ? 'critical' : (e >= 5 ? 'warning' : 'healthy'); }
function keyDia_(d) { return Utilities.formatDate(d, 'America/Bogota', 'yyyy-MM-dd'); }

/** Trae y arma todos los casos (una vez por carga; cachea 5 min). */
function traerCasos_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('casos');
  if (hit) return JSON.parse(hit);
  var s = sfLogin_();
  var recs = sfQueryAll_(s, buildSOQL_());
  var base = baseClientes_();
  var c = cfg_();
  var casos = recs.map(function (r) {
    var ciudad = cityName_(r);
    var dir = address_(r);
    var geo = geoDeCaso_(ciudad, dir);
    var nit = nit_(r[c.NIT_FIELD]);
    var cl = base[nit];
    return {
      numero: r.CaseNumber || '', nit: nit,
      cuenta: (r.Account && r.Account.Name) || (cl && cl.nombre) || nit,
      estado: r.Status || '', abierto: r.IsClosed === false,
      categoria: r.Categoria_legado__c || r.TipoCaso__c || '', tipologia: r.Tipologia__c || '',
      apertura: r.CreatedDate || null, cierre: r.ClosedDate || null,
      ini: r.FechaInicioAfectacion__c || null, fin: r.FechaFinAfectacion__c || null,
      ciudad: ciudad, direccion: dir,
      lat: geo ? geo.lat : null, lng: geo ? geo.lng : null,
      segmento: cl ? cl.segmento : 'Sin clasificar'
    };
  });
  try { cache.put('casos', JSON.stringify(casos), 300); } catch (e) { /* > 100KB no cachea */ }
  return casos;
}

/** Función pública llamada desde el HTML. Devuelve métricas para un segmento. */
function getData(segmento) {
  var todos = traerCasos_();
  var now = new Date();
  var rows = (!segmento || segmento === 'Todos') ? todos : todos.filter(function (r) { return r.segmento === segmento; });

  // Conteo por segmento (siempre completo)
  var porSeg = {}; SEGMENTOS_.forEach(function (s) { porSeg[s] = 0; });
  todos.forEach(function (r) { if (porSeg[r.segmento] != null) porSeg[r.segmento]++; });

  var abiertos = rows.filter(function (r) { return r.abierto; });
  var puntos = {}, semCount = { critical: 0, warning: 0, healthy: 0 };
  var aging = { '0-2': 0, '3-4': 0, '5-7': 0, '8-14': 0, '15+': 0 };
  var clientes = {}, criticos = {}, estados = {};
  abiertos.forEach(function (r) {
    var e = edadDias_(r.apertura, now), sm = semaforo_(e);
    semCount[sm]++;
    if (e <= 2) aging['0-2']++; else if (e <= 4) aging['3-4']++; else if (e <= 7) aging['5-7']++; else if (e <= 14) aging['8-14']++; else aging['15+']++;
    var cat = categoriaDe_(r.categoria, r.tipologia);
    acumTri_(clientes, r.cuenta, cat);
    acumTri_(estados, r.estado || 'Sin estado', cat);
    if (sm === 'critical') acumTri_(criticos, r.cuenta, cat);
    var lat = r.lat, lng = r.lng;
    if (lat == null || lng == null) { var g = geoDeCaso_(r.ciudad, r.direccion); if (g) { lat = g.lat; lng = g.lng; } }
    if (lat != null && lng != null) {
      var k = lat.toFixed(4) + ',' + lng.toFixed(4);
      if (!puntos[k]) puntos[k] = { lat: lat, lng: lng, ciudad: r.ciudad || 'Sin ciudad', count: 0 };
      puntos[k].count++;
    }
  });

  // Tendencia 14 días
  var tend = [], idx = {};
  for (var i = 13; i >= 0; i--) { var d = new Date(now.getTime() - i * 86400000); var kk = keyDia_(d); idx[kk] = tend.length; tend.push({ dia: kk.slice(5), ingresos: 0, cierres: 0 }); }
  var ingMes = 0, cieMes = 0, ingHoy = 0, cieHoy = 0, hoy = keyDia_(now), sumaEdad = 0;
  rows.forEach(function (r) {
    if (r.apertura) { var d = new Date(r.apertura), k = keyDia_(d); if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) ingMes++; if (k === hoy) ingHoy++; if (idx[k] != null) tend[idx[k]].ingresos++; }
    if (r.cierre) { var d2 = new Date(r.cierre), k2 = keyDia_(d2); if (d2.getMonth() === now.getMonth() && d2.getFullYear() === now.getFullYear()) cieMes++; if (k2 === hoy) cieHoy++; if (idx[k2] != null) tend[idx[k2]].cierres++; }
  });
  abiertos.forEach(function (r) { sumaEdad += edadDias_(r.apertura, now); });
  var n = abiertos.length || 1;

  var topTri = function (o, k) { return Object.keys(o).map(function (kk) { return o[kk]; }).sort(function (a, b) { return b.total - a.total; }).slice(0, k || 8); };

  return {
    segmento: segmento || 'Todos',
    esBogota: SEG_BOGOTA_.indexOf(segmento) >= 0,
    porSegmento: porSeg,
    kpis: {
      abiertos: abiertos.length, total: rows.length,
      ingresosMes: ingMes, cierresMes: cieMes, ingresosHoy: ingHoy, cierresHoy: cieHoy,
      antiguedadProm: Math.round(sumaEdad / n * 10) / 10,
      pctCriticos: Math.round(semCount.critical / n * 1000) / 10,
      pctAtencion: Math.round(semCount.warning / n * 1000) / 10,
      clientesAbiertos: Object.keys(clientes).length,
      ubicados: Object.keys(puntos).reduce(function (a, k) { return a + puntos[k].count; }, 0)
    },
    semaforos: semCount, aging: aging, tendencia: tend,
    estados: topTri(estados), topClientes: topTri(clientes), topCriticos: topTri(criticos),
    puntos: Object.keys(puntos).map(function (k) { return puntos[k]; }),
    tabla: abiertos.slice(0, 300).map(function (r) {
      var e = edadDias_(r.apertura, now);
      return { numero: r.numero, cliente: r.cuenta, estado: r.estado, categoria: categoriaDe_(r.categoria, r.tipologia), tipologia: r.tipologia, ciudad: r.ciudad, direccion: r.direccion, apertura: r.apertura, edad: e, sem: semaforo_(e) };
    }),
    abiertosTotal: abiertos.length
  };
}

function acumTri_(o, label, cat) {
  if (!o[label]) o[label] = { label: label, total: 0, Incidente: 0, Evento: 0, Requerimiento: 0, Otros: 0 };
  o[label].total++; o[label][cat]++;
}

// ─── Web app ───────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Monitor Help Desk · ETB')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
