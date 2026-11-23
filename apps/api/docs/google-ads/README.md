# Google Ads Script — métricas para el tablero

`horebs-metricas.js` corre dentro de la cuenta de Google Ads (588-389-5578),
lee las métricas con GAQL y las manda firmadas a
`POST https://api.pizzeriahorebs.shop/webhooks/google-ads`. No cambia nada en
la cuenta ni necesita developer token. El tablero está en `/admin/google-ads`
y la especificación en `especificacion-tablero.md`.

## Qué manda

| Reporte | Origen GAQL | Tabla |
|---|---|---|
| campanas | `campaign` por día: gasto, clics, conversiones, llamadas, cuota de impresiones, estado y puja | `google_ads_campana_diario` |
| palabras | `keyword_view` por día con nivel de calidad histórico | `google_ads_palabras_diario` |
| terminos | `search_term_view` por día | `google_ads_terminos_diario` |
| segmentos | `campaign` por fecha+hora y por dispositivo; `geographic_view` por ciudad (presencia o interés) | `google_ads_segmentos_diario` |
| conversiones | `campaign` por acción de conversión (va aparte porque no se combina con el costo) | `google_ads_conversiones_diario` |
| anuncios | `ad_group_ad`: fuerza, aprobación y URL final (foto, sin fecha) | `google_ads_anuncios` |

Cada corrida vuelve a mandar los últimos 7 días hasta ayer y el API reemplaza
esa ventana completa. Cada envío queda en `google_ads_lotes`.

## Instalación (una vez)

1. Railway → servicio del API → variables:
   - `GOOGLE_ADS_WEBHOOK_SECRETO`: 32 bytes aleatorios (`openssl rand -hex 32`).
   - `GOOGLE_ADS_CUENTA_ID`: `5883895578`.
2. Google Ads → Herramientas → Acciones masivas → Secuencias de comandos → `+`.
3. Pegar `horebs-metricas.js`, reemplazar `PEGAR_EN_ADS` por el secreto y
   autorizar el script.
4. Para la primera carga, subir `DIAS_REPASO` a 30, darle **Vista previa** (en
   vista previa los `UrlFetchApp` sí se ejecutan) y revisar el registro: cada
   reporte debe decir `"estado":"guardado"`.
5. Volver `DIAS_REPASO` a 7, guardar y programar **diario a las 6:00 a.m.**

## Rotar el secreto

El secreto queda en texto plano en Google Ads: lo ve cualquiera con acceso a
la cuenta. Si alguien deja de tener acceso (por ejemplo, una agencia):

1. Generar uno nuevo y cambiar `GOOGLE_ADS_WEBHOOK_SECRETO` en Railway.
2. Pegar el nuevo en el script. Hasta entonces el API responde 403 y el
   tablero muestra "datos viejos".

El endpoint solo escribe métricas de la cuenta configurada (rechaza otra
cuenta, otra zona horaria u otra moneda).

## Errores comunes

| Respuesta | Causa |
|---|---|
| 403 Firma inválida | Secreto distinto al de Railway o reloj desfasado más de 5 min |
| 400 La cuenta… no es la del negocio | `GOOGLE_ADS_CUENTA_ID` mal puesto |
| 400 zona horaria | La cuenta no está en America/Bogota |
| 503 | Faltan las variables en Railway |
