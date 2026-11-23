/**
 * Pizzería Horebs — métricas diarias de Google Ads hacia el tablero
 * /admin/google-ads. Se pega en Google Ads > Herramientas > Acciones
 * masivas > Secuencias de comandos (Scripts) y se programa a diario.
 *
 * No cambia nada en la cuenta: solo lee con GAQL y manda los datos por POST
 * firmado a POST /webhooks/google-ads. Ver README.md en esta carpeta.
 */

var CONFIG = {
  URL: 'https://api.pizzeriahorebs.shop/webhooks/google-ads',
  // Pegar aquí el valor de GOOGLE_ADS_WEBHOOK_SECRETO (Railway). Nunca va al repo.
  SECRETO: 'PEGAR_EN_ADS',
  // Días que se vuelven a mandar en cada corrida (Google ajusta conversiones
  // tardías y clics inválidos). Para la primera carga se puede subir a 30.
  DIAS_REPASO: 7,
  VERSION: 1,
  MAX_FILAS: 2000,
  // El API acepta hasta 100 KB por request; se deja margen.
  MAX_BYTES: 80000,
  REINTENTOS: 3,
};

function main() {
  if (CONFIG.SECRETO === 'PEGAR_EN_ADS') {
    throw new Error('Falta pegar el secreto en CONFIG.SECRETO.');
  }
  var cuenta = AdsApp.currentAccount();
  var ctx = {
    cuenta_id: cuenta.getCustomerId(),
    zona_horaria: cuenta.getTimeZone(),
    moneda: cuenta.getCurrencyCode(),
  };
  var rango = calcularRango(ctx.zona_horaria);
  Logger.log('Cuenta ' + ctx.cuenta_id + ', rango ' + rango.desde + ' a ' + rango.hasta);

  enviarReporte(ctx, 'campanas', rango, filasCampanas(rango));
  enviarReporte(ctx, 'palabras', rango, filasPalabras(rango));
  enviarReporte(ctx, 'terminos', rango, filasTerminos(rango));
  enviarReporte(ctx, 'segmentos', rango, filasSegmentos(rango));
  enviarReporte(ctx, 'conversiones', rango, filasConversiones(rango));
  enviarReporte(ctx, 'anuncios', { desde: null, hasta: null }, filasAnuncios());
}

// ---------------------------------------------------------------- fechas

/** Desde hace DIAS_REPASO días hasta ayer (hoy está incompleto). */
function calcularRango(zona) {
  var dia = 24 * 60 * 60 * 1000;
  var ahora = new Date();
  return {
    desde: Utilities.formatDate(new Date(ahora.getTime() - CONFIG.DIAS_REPASO * dia), zona, 'yyyy-MM-dd'),
    hasta: Utilities.formatDate(new Date(ahora.getTime() - dia), zona, 'yyyy-MM-dd'),
  };
}

function entre(rango) {
  return "segments.date BETWEEN '" + rango.desde + "' AND '" + rango.hasta + "'";
}

// ---------------------------------------------------------------- consultas

function consultar(gaql) {
  var filas = [];
  var resultado = AdsApp.search(gaql);
  while (resultado.hasNext()) filas.push(resultado.next());
  return filas;
}

function num(valor) {
  return valor === undefined || valor === null ? 0 : valor;
}

function opc(valor) {
  return valor === undefined ? null : valor;
}

function metricas(m) {
  return {
    gasto: String(num(m.costMicros)),
    impresiones: String(num(m.impressions)),
    clics: String(num(m.clicks)),
    conversiones: num(m.conversions),
  };
}

function unir(base, extra) {
  for (var k in extra) base[k] = extra[k];
  return base;
}

function filasCampanas(rango) {
  return consultar(
    'SELECT segments.date, campaign.id, campaign.name, campaign.status, ' +
      'campaign.primary_status, campaign.primary_status_reasons, ' +
      'campaign.bidding_strategy_type, campaign.bidding_strategy_system_status, ' +
      'campaign_budget.amount_micros, metrics.cost_micros, metrics.impressions, ' +
      'metrics.clicks, metrics.conversions, metrics.conversions_value, metrics.phone_calls, ' +
      'metrics.search_impression_share, metrics.search_budget_lost_impression_share, ' +
      'metrics.search_rank_lost_impression_share, metrics.search_top_impression_share, ' +
      'metrics.search_absolute_top_impression_share ' +
      "FROM campaign WHERE campaign.status != 'REMOVED' AND " + entre(rango)
  ).map(function (r) {
    var c = r.campaign;
    var m = r.metrics || {};
    return unir(
      {
        fecha: r.segments.date,
        campana_id: String(c.id),
        campana_nombre: c.name,
        estado: opc(c.status),
        estado_principal: opc(c.primaryStatus),
        motivos_estado: c.primaryStatusReasons || [],
        estrategia_puja: opc(c.biddingStrategyType),
        estado_puja: opc(c.biddingStrategySystemStatus),
        presupuesto_diario: String(num(r.campaignBudget && r.campaignBudget.amountMicros)),
      },
      unir(metricas(m), {
        valor_conversiones: num(m.conversionsValue),
        llamadas: String(num(m.phoneCalls)),
        is_busqueda: opc(m.searchImpressionShare),
        is_perdida_presupuesto: opc(m.searchBudgetLostImpressionShare),
        is_perdida_ranking: opc(m.searchRankLostImpressionShare),
        is_superior: opc(m.searchTopImpressionShare),
        is_superior_absoluta: opc(m.searchAbsoluteTopImpressionShare),
      })
    );
  });
}

function filasPalabras(rango) {
  return consultar(
    'SELECT segments.date, campaign.id, ad_group.id, ad_group_criterion.criterion_id, ' +
      'ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ' +
      'ad_group_criterion.status, metrics.historical_quality_score, ' +
      'metrics.historical_search_predicted_ctr, metrics.historical_creative_quality_score, ' +
      'metrics.historical_landing_page_quality_score, metrics.cost_micros, ' +
      'metrics.impressions, metrics.clicks, metrics.conversions ' +
      'FROM keyword_view WHERE ' + entre(rango)
  ).map(function (r) {
    var k = r.adGroupCriterion;
    var m = r.metrics || {};
    return unir(
      {
        fecha: r.segments.date,
        campana_id: String(r.campaign.id),
        grupo_id: String(r.adGroup.id),
        criterio_id: String(k.criterionId),
        texto: k.keyword.text,
        concordancia: opc(k.keyword.matchType),
        estado: opc(k.status),
        qs: m.historicalQualityScore === undefined ? null : String(m.historicalQualityScore),
        qs_ctr: opc(m.historicalSearchPredictedCtr),
        qs_anuncio: opc(m.historicalCreativeQualityScore),
        qs_pagina: opc(m.historicalLandingPageQualityScore),
      },
      metricas(m)
    );
  });
}

/** Suma filas con la misma llave (Google puede repetir combinaciones). */
function agrupar(filas, llave) {
  var mapa = {};
  var orden = [];
  filas.forEach(function (f) {
    var k = llave(f);
    var previa = mapa[k];
    if (!previa) {
      mapa[k] = f;
      orden.push(k);
      return;
    }
    ['gasto', 'impresiones', 'clics'].forEach(function (c) {
      previa[c] = String(Number(previa[c]) + Number(f[c]));
    });
    previa.conversiones = Number(previa.conversiones) + Number(f.conversiones);
  });
  return orden.map(function (k) { return mapa[k]; });
}

function filasTerminos(rango) {
  var filas = consultar(
    'SELECT segments.date, campaign.id, ad_group.id, search_term_view.search_term, ' +
      'search_term_view.status, metrics.cost_micros, metrics.impressions, ' +
      'metrics.clicks, metrics.conversions FROM search_term_view WHERE ' + entre(rango)
  ).map(function (r) {
    return unir(
      {
        fecha: r.segments.date,
        campana_id: String(r.campaign.id),
        grupo_id: String(r.adGroup.id),
        termino: r.searchTermView.searchTerm,
        estado: opc(r.searchTermView.status),
      },
      metricas(r.metrics || {})
    );
  });
  return agrupar(filas, function (f) { return f.fecha + '|' + f.grupo_id + '|' + f.termino; });
}

function segmento(r, dimension, clave) {
  return unir(
    { fecha: r.segments.date, campana_id: String(r.campaign.id), dimension: dimension, clave: String(clave) },
    metricas(r.metrics || {})
  );
}

function filasSegmentos(rango) {
  var base = 'metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions ';
  var horas = consultar(
    'SELECT segments.date, segments.hour, campaign.id, ' + base +
      "FROM campaign WHERE campaign.status != 'REMOVED' AND " + entre(rango)
  ).map(function (r) { return segmento(r, 'hora', r.segments.hour); });
  var dispositivos = consultar(
    'SELECT segments.date, segments.device, campaign.id, ' + base +
      "FROM campaign WHERE campaign.status != 'REMOVED' AND " + entre(rango)
  ).map(function (r) { return segmento(r, 'dispositivo', r.segments.device); });
  return horas.concat(dispositivos, filasGeo(rango, base));
}

/** Ciudades por presencia o por interés, con el nombre de cada ciudad. */
function filasGeo(rango, base) {
  var crudas = consultar(
    'SELECT segments.date, campaign.id, geographic_view.location_type, segments.geo_target_city, ' +
      base + 'FROM geographic_view WHERE ' + entre(rango)
  );
  var nombres = nombresCiudades(crudas.map(function (r) { return r.segments.geoTargetCity; }));
  var filas = crudas.map(function (r) {
    var tipo = r.geographicView.locationType === 'AREA_OF_INTEREST' ? 'ciudad_interes' : 'ciudad_presencia';
    var nombre = nombres[r.segments.geoTargetCity] || 'Sin ciudad';
    return segmento(r, tipo, nombre);
  });
  return agrupar(filas, function (f) {
    return f.fecha + '|' + f.campana_id + '|' + f.dimension + '|' + f.clave;
  });
}

function nombresCiudades(recursos) {
  var unicos = recursos.filter(function (r, i) { return r && recursos.indexOf(r) === i; });
  var nombres = {};
  if (unicos.length === 0) return nombres;
  consultar(
    'SELECT geo_target_constant.resource_name, geo_target_constant.name FROM geo_target_constant ' +
      "WHERE geo_target_constant.resource_name IN ('" + unicos.join("','") + "')"
  ).forEach(function (r) {
    nombres[r.geoTargetConstant.resourceName] = r.geoTargetConstant.name;
  });
  return nombres;
}

/** Va aparte: segments.conversion_action_* no se combina con el costo. */
function filasConversiones(rango) {
  var filas = consultar(
    'SELECT segments.date, campaign.id, segments.conversion_action_name, ' +
      'segments.conversion_action_category, metrics.conversions, metrics.conversions_value ' +
      "FROM campaign WHERE campaign.status != 'REMOVED' AND " + entre(rango)
  ).map(function (r) {
    return {
      fecha: r.segments.date,
      campana_id: String(r.campaign.id),
      accion: r.segments.conversionActionName,
      categoria: opc(r.segments.conversionActionCategory),
      conversiones: num(r.metrics && r.metrics.conversions),
      valor: num(r.metrics && r.metrics.conversionsValue),
    };
  });
  var mapa = {};
  return filas.filter(function (f) {
    var k = f.fecha + '|' + f.campana_id + '|' + f.accion;
    var previa = mapa[k];
    if (!previa) {
      mapa[k] = f;
      return true;
    }
    previa.conversiones += f.conversiones;
    previa.valor += f.valor;
    return false;
  });
}

function filasAnuncios() {
  return consultar(
    'SELECT campaign.id, ad_group.id, ad_group_ad.ad.id, ad_group_ad.ad.type, ' +
      'ad_group_ad.status, ad_group_ad.ad_strength, ad_group_ad.policy_summary.approval_status, ' +
      'ad_group_ad.ad.final_urls FROM ad_group_ad ' +
      "WHERE ad_group_ad.status != 'REMOVED' AND campaign.status != 'REMOVED'"
  ).map(function (r) {
    var a = r.adGroupAd;
    return {
      grupo_id: String(r.adGroup.id),
      anuncio_id: String(a.ad.id),
      campana_id: String(r.campaign.id),
      tipo: opc(a.ad.type),
      estado: opc(a.status),
      fuerza: opc(a.adStrength),
      aprobacion: opc(a.policySummary && a.policySummary.approvalStatus),
      urls_finales: a.ad.finalUrls || [],
    };
  });
}

// ---------------------------------------------------------------- envío

/** Parte las filas para que cada request quede bajo MAX_FILAS y MAX_BYTES. */
function partir(filas) {
  var partes = [];
  var actual = [];
  var bytes = 0;
  filas.forEach(function (f) {
    var largo = aAscii(JSON.stringify(f)).length + 1;
    if (actual.length > 0 && (actual.length >= CONFIG.MAX_FILAS || bytes + largo > CONFIG.MAX_BYTES - 1000)) {
      partes.push(actual);
      actual = [];
      bytes = 0;
    }
    actual.push(f);
    bytes += largo;
  });
  partes.push(actual);
  return partes;
}

function enviarReporte(ctx, reporte, rango, filas) {
  var partes = partir(filas);
  var loteId = Utilities.getUuid();
  partes.forEach(function (parte, i) {
    var cuerpo = {
      version: CONFIG.VERSION,
      cuenta_id: ctx.cuenta_id,
      zona_horaria: ctx.zona_horaria,
      moneda: ctx.moneda,
      lote_id: loteId,
      reporte: reporte,
      parte: i + 1,
      total_partes: partes.length,
      desde: rango.desde,
      hasta: rango.hasta,
      filas: parte,
    };
    var respuesta = enviar(aAscii(JSON.stringify(cuerpo)));
    Logger.log(reporte + ' parte ' + (i + 1) + '/' + partes.length + ': ' + respuesta);
  });
}

/** Escapa todo lo que no es ASCII: así los bytes firmados son los enviados. */
function aAscii(texto) {
  return texto.replace(/[\u007f-￿]/g, function (c) {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  });
}

function firmar(cuerpo) {
  var t = String(Math.floor(Date.now() / 1000));
  var bytes = Utilities.computeHmacSha256Signature(t + '.' + cuerpo, CONFIG.SECRETO);
  var hex = bytes
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); })
    .join('');
  return 't=' + t + ',v1=' + hex;
}

function enviar(cuerpo) {
  for (var intento = 1; intento <= CONFIG.REINTENTOS; intento++) {
    var respuesta = UrlFetchApp.fetch(CONFIG.URL, {
      method: 'post',
      contentType: 'application/json',
      payload: cuerpo,
      headers: { 'x-horebs-firma': firmar(cuerpo) },
      muteHttpExceptions: true,
    });
    var codigo = respuesta.getResponseCode();
    var texto = respuesta.getContentText();
    if (codigo === 200) return texto;
    var reintentable = codigo === 429 || codigo >= 500;
    Logger.log('Intento ' + intento + ' respondió ' + codigo + ': ' + texto);
    if (!reintentable) throw new Error('El API rechazó el lote (' + codigo + '): ' + texto);
    Utilities.sleep(2000 * intento);
  }
  throw new Error('El API no respondió después de ' + CONFIG.REINTENTOS + ' intentos.');
}
