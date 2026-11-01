import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { usuarioDelRequest } from './request-con-usuario';
import type { UsuarioAutenticado } from './roles.guard';
import type { UsuarioSupabase } from './supabase-auth.guard';

export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado =>
    usuarioDelRequest<UsuarioAutenticado>(ctx),
);

export const UsuarioSupabaseActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioSupabase =>
    usuarioDelRequest<UsuarioSupabase>(ctx),
);
