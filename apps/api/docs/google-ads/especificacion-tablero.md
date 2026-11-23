# Tablero de Google Ads — especificación

Tablero en `/admin/google-ads` para que un marketer senior decida sobre la
campaña de búsqueda de Pizzería Horebs (cuenta 588-389-5578, COP). Sigue la
arquitectura del tablero de Meta (`/admin/anuncios`). Revisado por el agente
auditor (`.claude/agents/auditor-plan-google-ads.md`) el 23 nov 2026.

## 1. Quién lo usa y para qué

| Usuario | Frecuencia | Decisiones |
|---|---|---|
| Dueño / marketer (rol `admin`) | Diaria (2 min) y semanal (20 min) | Escalar, mantener, optimizar o pausar; presupuesto diario; negativas; concordancias; programación; reescribir el RSA |
| Empleado | No lo ve | — |

Cada sección responde una pregunta y termina en una acción. Un número que no
lleva a una decisión no se muestra.

## 2. Fuente de datos

Un **Google Ads Script** dentro de la cuenta corre cada día (~6:00 a.m.) y
manda las métricas por `POST https://api.pizzeriahorebs.shop/webhooks/google-ads`
firmado con HMAC. No necesita developer token. Re-envía los últimos 7 días
porque Google ajusta conversiones tardías y clics inválidos.

Límites que condicionan el diseño:

- El body de Express tiene tope de 100 KB: el script manda lotes de ≤80 KB
  y ≤2 000 filas, cada uno firmado.
- La cuota de impresiones no se puede segmentar por hora.
- Auction insights no está disponible ni en la API ni en Scripts: se revisa
  en la interfaz de Ads.
- `segments.conversion_action*` solo combina con métricas de conversión: va
  en una consulta aparte del costo.
- `segments.date` y `segments.hour` vienen en la zona horaria de la cuenta;
  el lote trae `zona_horaria` y el API lo rechaza si no es `America/Bogota`.

## 3. Métricas

Ninguna métrica se compara contra "promedios de la industria": solo contra el
período anterior y entre elementos de la propia cuenta.

### 3.1 Negocio real (principales)

| Métrica | Fórmula | Fuente | v |
|---|---|---|---|
| ROAS combinado | ventas no canceladas del período ÷ (gasto Google + gasto Meta) | `pedidos`, `google_ads_campana_diario`, `anuncios_meta_diario` | 1 |
| CPA combinado | pedidos no cancelados ÷ gasto Google + Meta | ídem | 1 |
| Cobertura de atribución | % de pedidos con origen conocido | `pedidos.atribucion_web`, `canal`, `origen_*` | 1 |
| CPA / ROAS real atribuido | gasto Google ÷ pedidos (o ventas) atribuidos a Google | `atribucion_web.utm_source = google` | 1 (como "cota inferior" si cobertura < 30%) |
| CAC combinado | gasto Google + Meta ÷ clientes nuevos del período | `clientes.created_at` | 2 |
| Retorno sobre utilidad | utilidad bruta atribuida ÷ gasto (`utilidadDePedido`, `admin/rentabilidad.ts`) | `items_pedido.costo_unitario` | 2 |
| Incremento antes/después | pedidos por día, mismo día de semana, 28 días antes y después del lanzamiento | `pedidos` | 2 ("orientativo": diciembre distorsiona) |

### 3.2 Eficiencia según Google

Gasto, impresiones, clics, CTR (clics ÷ impresiones), CPC (gasto ÷ clics),
conversiones, CVR (conversiones ÷ clics), CPA Ads (gasto ÷ conversiones),
valor de conversión y ROAS Ads. **Separadas por acción**: "Web - Pedido
confirmado (shop)", "Web - Clic WhatsApp (shop)" y llamadas
(`metrics.phone_calls`). Nunca se suman: un clic a WhatsApp no es una venta.

### 3.3 Ritmo del presupuesto

Gasto del mes a la fecha frente a `30,4 × presupuesto diario` (Google puede
gastar hasta 2× el diario en un día y compensa en el mes).

### 3.4 Competitividad

- Cuota de impresiones (IS) ponderada, nunca promediada:
  `elegibles_d = impresiones_d / IS_d`; `IS = Σ impresiones / Σ elegibles`.
  Igual para perdida por presupuesto, perdida por ranking, superior y
  superior absoluta.
- Google reporta "<10%" como 0,0999 y ">90%" como 0,9001: se marcan como
  acotados.
- Lectura: mucha pérdida por presupuesto → falta dinero; mucha por ranking →
  falta calidad o puja.

### 3.5 Estado de la campaña

`campaign.primary_status` y `primary_status_reasons`;
`bidding_strategy_system_status` (en aprendizaje, limitada). Con poco volumen
es lo que más explica los saltos.

### 3.6 Desperdicio

- Términos de búsqueda con gasto y 0 conversiones, ordenados por gasto.
- Candidatas a negativa: 0 conversiones, clics ≥ mínimo y estado distinto de
  `EXCLUDED`. Botón para copiar la lista en formato de negativas de Ads.
- Marca vs. genérico: el término contiene "horebs". Los KPIs se muestran con
  y sin marca (la marca infla CTR y CVR).
- % del gasto sin término visible (Google oculta términos de bajo volumen).

### 3.7 Calidad

- v1: QS histórico por palabra (`metrics.historical_quality_score`), fuerza
  del RSA (`ad_strength`), aprobación y políticas, URL final.
- v2: QS ponderado por impresiones y sus 3 componentes (CTR esperado,
  relevancia del anuncio, experiencia en la página de destino). La foto
  actual (`quality_info`) se guarda con `capturado_en`.

### 3.8 Geografía, hora y dispositivo

- v1: % del gasto fuera de Riohacha y por "interés" en vez de "presencia"
  (`geographic_view.location_type`).
- v2: mapa 7×24 con `segments.date + segments.hour` (día de semana calculado
  en el API), franja 16–23 resaltada, hora de agotamiento del presupuesto;
  CPC/CVR/CPA por dispositivo.

### 3.9 Advertencias siempre visibles (ⓘ del encabezado)

- **Retraso de conversiones:** los últimos 7 días pueden subir.
- **Conversiones modeladas:** pueden ser fraccionarias.
- **Subconteo por WhatsApp y bot:** la mayoría de los pedidos se cierra por
  chat; el CPA de Ads sobreestima el costo real.
- **Volumen bajo:** con $10.000/día salen unos 200–600 clics y 10–40
  conversiones al mes. Sin muestra mínima no hay veredicto: constantes
  `MIN_IMPRESIONES_CTR = 200`, `MIN_CLICS_CVR = 30`,
  `MIN_CONVERSIONES_CPA = 5`; debajo se muestra "Muestra insuficiente".

## 4. Atribución de pedidos a Google

| Paso | Qué hace | Estado |
|---|---|---|
| Sufijo de URL final en Ads | `utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}`; `atribucion_web` ya guarda `utm_*` | Configuración de la cuenta |
| gclid / gbraid / wbraid | `lib/atribucion.ts` los guarda; `pedidos/atribucion-web.ts` los admite | v2 (código) |
| Caja (POS) | Columna `origen_campana_plataforma` (`meta` / `google`) para no mezclar ids con Meta | v2 |
| Código en WhatsApp | `(ref G-XXXX)` en el texto prellenado. `wa.me` no lleva `ref`, y el botón web abre +57 315 786 1208 (humano, no el bot) | Bloqueado por la pregunta 1 |
| Conversiones offline | El script sube los pedidos del bot con gclid | v2 |

## 5. Diseño

**Ruta y navegación:** `/admin/google-ads`, ítem "Google Ads" en `NAV_ADMIN`
después de "Ventas por anuncio"; `RequireRol roles={['admin']}`.

**Orden de la página:**

1. **Encabezado:** título, estado de sincronización (verde al día; ámbar
   > 36 h; rojo > 72 h; gris sin datos) con fecha del último lote, selector
   de período.
2. **KPIs (6 tarjetas):** Gasto (con ritmo del mes), Conversiones Ads por
   acción, CPA Ads, ROAS combinado, IS de búsqueda, Cobertura de atribución.
   Cada una con valor, delta vs. período anterior (▲/▼ + texto, color según
   `sentido`: si el CPA sube, es rojo) y `Sparkline`.
3. **Tendencia:** gasto diario en columnas (`GraficoColumnas`) y conversiones.
4. **Alertas:** qué pasó, el dato, la acción sugerida y la muestra.
5. **Palabras clave:** palabra, concordancia, estado, gasto, clics, CTR, CPC,
   conversiones, CPA, QS. Tarjetas en móvil.
6. **Términos / desperdicio:** los 50 de más gasto + fila "resto", marca vs.
   genérico, candidatas a negativa con copiar.
7. **Geo y calidad:** `BarraParticipacion` para zona; RSA con fuerza y
   aprobación.

**Filtros:** 7, 14, **28 (defecto, múltiplo de 7)**, 90 días y
personalizado; `hasta` = ayer; comparar con el período anterior activado.

**Formato y estados:** COP sin decimales, porcentajes con 1 decimal,
`tabular-nums`. Estados: carga (`SkeletonInforme`), error con reintentar,
"el script aún no ha enviado datos", período sin gasto, datos viejos.

**Accesibilidad y tema:** contraste AA, el color nunca es la única señal,
foco visible, `prefers-reduced-motion`, modo oscuro con las reglas de
CLAUDE.md §9, clases de marca (`brand-orange` para gasto, azul para
conversiones). Sin librería de gráficos: se reusan los componentes de
`components/informes/`.

## 6. Rendimiento

- Un solo `GET /admin/google-ads?desde&hasta` devuelve período actual y
  anterior calculados en el servidor.
- Tablas diarias ya agregadas; PK que empieza por `fecha` e índice
  `(campana_id, fecha)`.
- Payload < 60 KB (50 términos, ~15 palabras, ≤ 90 puntos de serie).
- Rango máximo 180 días (400 si se pasa o si `desde > hasta`).
- `no-store`; consultas a Supabase en paralelo con `Promise.all`; fechas
  Bogotá con `inicioDiaBogota` / `finDiaBogota`.

## 7. Alertas

Funciones puras en `google-ads-alertas.ts` con spec; umbrales como
constantes con nombre.

| Código | Regla | Muestra mínima | Severidad | v |
|---|---|---|---|---|
| `SINCRONIZACION_VIEJA` | último lote hace > 36 h | — | alta | 1 |
| `SIN_SERVIR` | `primary_status` no elegible, o 0 impresiones ayer con campaña activa | — | crítica | 1 |
| `ANUNCIO_RECHAZADO` | `approval_status` DISAPPROVED o APPROVED_LIMITED | — | crítica | 1 |
| `GASTO_SIN_CONVERSION` | palabra o término con ≥ 20 clics y 0 conversiones | 20 clics | media | 1 |
| `PRESUPUESTO_LIMITA` | IS perdida por presupuesto > 20% (7 días) | 7 días | media | 1 |
| `FUERA_ZONA` | > 5% del gasto fuera de Riohacha o por interés | 7 días | baja | 1 |
| `CPA_ALTO` | CPA 3 días > 2× base 28 días | ≥ 5 conv. en la base | alta | 2 |
| `CTR_CAE` | CTR 7 días < 70% del de 28 días | 500 impresiones | media | 2 |
| `QS_BAJO` | QS ≤ 4 | 100 impresiones | media | 2 |
| `FUERZA_ANUNCIO` | `ad_strength` POOR o AVERAGE | — | baja | 2 |
| `FUERA_HORARIO` | > 10% del gasto fuera de 16–23 h | 7 días | baja | 2 |

## 8. Contrato del webhook

- `POST /webhooks/google-ads`. Excepción al contrato REST, como Meta y Bold.
- Header `x-horebs-firma: t=<unix>,v1=<hex>` con
  `v1 = HMAC-SHA256(GOOGLE_ADS_WEBHOOK_SECRETO, "<t>.<rawBody>")`;
  `timingSafeEqual` con chequeo de longitud. 403 si no calza, si
  `|ahora − t| > 300 s` o si el secreto no está configurado.
- `ContentTypeGuard` exime `/webhooks/*`: el controller exige
  `application/json` por su cuenta.
- Body:
  `{ version, cuenta_id, zona_horaria, moneda, lote_id, reporte, parte, total_partes, desde, hasta, filas[] }`
  con `reporte ∈ campanas | palabras | terminos | segmentos | conversiones | anuncios | estado_campanas`.
  Se rechaza si `cuenta_id ≠ GOOGLE_ADS_CUENTA_ID`, zona ≠ `America/Bogota`,
  moneda ≠ COP o versión desconocida. Filas validadas una por una en el
  service.
- **Reemplazo por ventana:** con `parte = 1` se borra
  `(reporte, desde..hasta)` y luego se insertan las partes. Así no quedan
  filas viejas de términos que dejaron de aparecer. `lote_id` único en
  `google_ads_lotes` (idempotente). `filas: []` responde 200 sin escribir.
- Responde síncrono `200 { lote_id, reporte, filas }` para que el script
  pueda reintentar si falla. Throttler global activo.
- Normalización: los int64 llegan como string y en camelCase
  (`row.metrics.costMicros`); micros → pesos en un solo lugar.

**Script:** `apps/api/docs/google-ads/horebs-metricas.js` + README. Usa
`AdsApp.search`, escapa no-ASCII antes de firmar, convierte la firma a hex
con `(b & 0xff)` y relleno de 2 dígitos, `muteHttpExceptions` y 1–2
reintentos. El secreto queda en texto plano en Ads: es exclusivo de esta
integración, el endpoint solo escribe métricas y el README explica cómo
rotarlo.

## 9. Preguntas abiertas para el dueño

1. ¿El WhatsApp 315 786 1208 lo atiende el bot o una persona?
2. ¿Cuál conversión es la principal para la puja y qué estrategia usa hoy?
3. ¿La zona horaria de la cuenta es America/Bogota?
4. ¿La programación es 4–11 p.m. o desde las 11 a.m. (reservas del bot)?
5. ¿Las llamadas usan número de desvío de Google?
6. ¿Qué margen bruto real tiene un pedido? ¿En qué ventana se midieron los
   2,25 pedidos por cliente?
7. ¿Las búsquedas de marca van en una campaña aparte?
8. ¿Se aceptan los umbrales iniciales de las alertas?
