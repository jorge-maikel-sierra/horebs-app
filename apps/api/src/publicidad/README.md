# Métricas de Meta Ads en Informes

Cron horario (`@Cron('0 * * * *')`, ver `meta-ads-snapshot.service.ts`) que
consulta la Marketing API de Meta (cuenta completa + campañas activas) y
guarda un snapshot en `meta_ads_snapshots` / `meta_ads_campanas_snapshot`.
La página `/admin/informes` lee el último snapshot guardado — nunca llama
a Meta en vivo al cargar la página, así el panel no depende de la
disponibilidad de Graph API ni se hace lento por el rate limit de Meta.
El botón "Actualizar ahora" del panel sí dispara un refresco en vivo bajo
demanda (`POST /publicidad/meta-ads/refrescar`).

## Variables de entorno (Railway → Service → Variables)

| Variable | De dónde sale |
|---|---|
| `META_AD_ACCOUNT_ID` | Ads Manager → selector de cuenta arriba a la izquierda, el número junto al nombre de la cuenta (sin el prefijo `act_`) |
| `META_ADS_ACCESS_TOKEN` | Token del Usuario del sistema con permiso `ads_read` sobre esta cuenta publicitaria |

Se mantienen separadas de `WHATSAPP_ACCESS_TOKEN`/`MESSENGER_PAGE_ACCESS_TOKEN`
aunque puedan salir del mismo Usuario del sistema — permisos y rotación
más limpios por separado.

`.env.example` está bloqueado por los permisos de este proyecto para este
asistente — agregar ahí manualmente:
```
META_AD_ACCOUNT_ID=
META_ADS_ACCESS_TOKEN=
```

## Cómo obtener el token (mismo Business Manager ya usado para WhatsApp)

1. **Reusar o crear el Usuario del sistema**: Configuración empresarial →
   Usuarios del sistema. Se puede reusar el que ya existe para WhatsApp,
   o crear uno nuevo dedicado a anuncios (con rol Empleado alcanza, solo
   necesita lectura).
2. **Asignar la cuenta publicitaria a ese Usuario del sistema**:
   Configuración empresarial → Cuentas → Cuentas publicitarias →
   seleccionar la cuenta → Asignar usuarios del sistema → elegir el
   usuario → marcar acceso.
3. **Generar el token**: Usuarios del sistema → seleccionar el usuario →
   Generar token → elegir la app (la misma "Pizzeria Horeb's" del bot) →
   marcar el permiso `ads_read` → **sin fecha de expiración**.
4. **`META_AD_ACCOUNT_ID`**: Ads Manager → selector de cuenta arriba a la
   izquierda → el número que aparece junto al nombre de la cuenta (10-12
   dígitos). No lleva el prefijo `act_` — el código lo agrega solo.

## Qué mide

- **Cuenta completa** (todas las campañas activas combinadas): gasto de
  hoy, presupuesto diario total, CPC, CPM, CTR, compras atribuidas y ROAS
  según Meta, más una serie de gasto de los últimos 7 días.
- **Por campaña**: mismo desglose, uno por campaña activa.
- **Gasto vs Ventas de hoy**: compara el gasto de Meta con el total real
  de ventas de hoy (mismo cálculo que usa `/informes`, vía
  `InformesService.generar`) — son dos números con fuentes distintas
  (Meta se autoatribuye compras y puede sobrecontar; nuestras ventas
  reales vienen de los pedidos registrados), mostrados uno al lado del
  otro, nunca combinados en un solo "ROAS".

## Qué NO hace este módulo

- No refresca en vivo al cargar `/admin/informes` — siempre lee el último
  snapshot guardado.
- No pausa ni modifica campañas, presupuestos ni pujas — es de solo
  lectura (`ads_read`), a propósito.

## Gotcha pendiente de confirmar con credenciales reales

Meta normalmente devuelve `daily_budget`/`lifetime_budget` en la unidad
menor de la moneda (centavos), **excepto en monedas sin decimales como
COP**, donde el número crudo ya viene en pesos. El código de este módulo
asume que NO hace falta dividir por 100 (cuenta en COP). El primer
snapshot real loguea el presupuesto crudo de cada campaña junto a la
moneda — comparalo visualmente contra Ads Manager antes de confiar del
todo en la tarjeta de presupuesto.
