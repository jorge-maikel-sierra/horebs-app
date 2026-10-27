-- Checkout del bot de WhatsApp, avisos de estado y recompra
--
-- 1) El bot crea pedidos propios (canal 'whatsapp'), igual que el sitio web:
--    precios desde la base, stock y puntos. El equipo los avanza desde
--    /admin/pedidos y cada cambio le llega al cliente por WhatsApp.
-- 2) Estado nuevo 'en_camino' (solo domicilio) entre en_preparacion y
--    entregado.
-- 3) recompra_enviada_en: la invitación a repetir el pedido se manda una sola
--    vez, ~23h después del último mensaje del cliente (antes de que se cierre
--    la ventana gratis de 24h de WhatsApp).
-- 4) conversaciones_bot.checkout: paso del checkout con botones
--    ({ paso, modalidad, direccion, nombre, apellido }).

alter table public.pedidos drop constraint pedidos_canal_check,
  add constraint pedidos_canal_check
    check (canal = any (array['web', 'pos', 'whatsapp']));

alter table public.pedidos drop constraint pedidos_estado_check,
  add constraint pedidos_estado_check
    check (estado = any (array[
      'pendiente', 'confirmado', 'en_preparacion', 'en_camino', 'entregado',
      'cancelado'
    ]));

alter table public.pedidos
  add column if not exists recompra_enviada_en timestamptz;

alter table public.conversaciones_bot
  add column if not exists checkout jsonb;
