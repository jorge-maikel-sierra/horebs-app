-- De dónde llegó una venta registrada en caja. Sirve para ventas por canal y
-- para decirle a Meta cómo se cerró la compra (en el local, por llamada o por
-- chat). Null en las ventas anteriores y en los pedidos que no vienen de caja.
alter table pedidos
  add column if not exists origen_venta text
  check (origen_venta in ('mostrador', 'whatsapp', 'llamada', 'messenger', 'instagram'));
