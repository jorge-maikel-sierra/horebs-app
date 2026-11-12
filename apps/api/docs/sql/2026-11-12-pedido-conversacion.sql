-- Liga el pedido del bot con la conversación de la que salió.
--
-- La API de conversiones de Messenger e Instagram identifica al cliente por
-- su PSID / IGSID, no por teléfono. Cuando el panel marca un pedido
-- `entregado` o `cancelado`, el Purchase u OrderCanceled necesita ese id; sin
-- esta columna no hay forma confiable de encontrarlo.

alter table public.pedidos
  add column if not exists conversacion_id uuid
    references public.conversaciones_bot (id) on delete set null;

create index if not exists pedidos_conversacion_idx
  on public.pedidos (conversacion_id)
  where conversacion_id is not null;
