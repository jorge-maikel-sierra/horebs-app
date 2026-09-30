// Autor único del blog — negocio de una sola persona, no hay múltiples
// redactores. Nombre y foto vienen del perfil real de Google con el que
// inició sesión el dueño del negocio (auth.users.raw_user_meta_data en
// Supabase), no son datos inventados para rellenar la tarjeta.
export const AUTOR = {
  nombre: 'Jorge Sierra',
  fotoUrl:
    'https://lh3.googleusercontent.com/a/ACg8ocJvHx8gk5ZyEcj1n798pDzrKz62MIrEbsV_YCevHxM6OmO65tb3=s96-c',
} as const;
