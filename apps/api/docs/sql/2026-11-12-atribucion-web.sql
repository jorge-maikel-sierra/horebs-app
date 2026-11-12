-- Atribución de los pedidos del sitio web para la API de conversiones (web).
--
-- Guarda lo que Meta necesita para ligar la venta al clic del anuncio cuando
-- el Purchase sale desde el servidor (al marcar el pedido `entregado`):
-- cookies _fbp / _fbc, UTM, URL del checkout, IP y navegador del cliente.
-- Solo lo llena el checkout web; el bot y el POS lo dejan en null.

alter table public.pedidos
  add column if not exists atribucion_web jsonb;
