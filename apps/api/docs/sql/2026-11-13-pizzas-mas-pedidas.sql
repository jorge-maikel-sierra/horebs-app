-- Las pizzas más pedidas de los últimos `dias` días (sin pedidos cancelados),
-- por número de pedidos distintos. El bot de Messenger e Instagram las sugiere
-- cuando el cliente pregunta "¿cuánto cuesta?" sin nombrar un producto, en vez
-- de mandar la lista completa de precios.
create or replace function public.pizzas_mas_pedidas(dias integer, limite integer)
returns table (producto_id uuid, pedidos bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select pr.id as producto_id, count(distinct p.id) as pedidos
  from items_pedido i
  join pedidos p on p.id = i.pedido_id
  join variantes_producto v on v.id = i.variante_id
  join productos pr on pr.id = v.producto_id
  join categorias c on c.id = pr.categoria_id
  where c.nombre = 'Pizza'
    and p.estado <> 'cancelado'
    and p.created_at >= now() - make_interval(days => dias)
  group by pr.id
  order by pedidos desc
  limit limite;
$$;

revoke all on function public.pizzas_mas_pedidas(integer, integer) from public, anon, authenticated;
grant execute on function public.pizzas_mas_pedidas(integer, integer) to service_role;
