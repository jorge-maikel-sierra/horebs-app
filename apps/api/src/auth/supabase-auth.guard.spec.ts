import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import type { RequestConUsuario } from './request-con-usuario';
import { SupabaseAuthGuard, type UsuarioSupabase } from './supabase-auth.guard';

function crearGuard(getUser: jest.Mock) {
  const supabase = {
    getClient: () => ({ auth: { getUser } }),
  } as unknown as SupabaseService;
  return new SupabaseAuthGuard(supabase);
}

function contextoCon(request: RequestConUsuario<UsuarioSupabase>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SupabaseAuthGuard', () => {
  it('sin token responde 401 sin consultar a Supabase', async () => {
    const getUser = jest.fn();
    const guard = crearGuard(getUser);

    await expect(
      guard.canActivate(contextoCon({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('un token inválido o vencido responde 401', async () => {
    const getUser = jest
      .fn()
      .mockResolvedValue({ data: { user: null }, error: { message: 'jwt' } });
    const guard = crearGuard(getUser);

    await expect(
      guard.canActivate(
        contextoCon({ headers: { authorization: 'Bearer malo' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('un token válido deja el usuario en el request', async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'u-1',
          email: 'ana@correo.co',
          user_metadata: { nombre: 'Ana', apellido: 'Pérez' },
        },
      },
      error: null,
    });
    const request: RequestConUsuario<UsuarioSupabase> = {
      headers: { authorization: 'Bearer bueno' },
    };

    await expect(
      crearGuard(getUser).canActivate(contextoCon(request)),
    ).resolves.toBe(true);

    expect(getUser).toHaveBeenCalledWith('bueno');
    expect(request.usuario).toEqual({
      id: 'u-1',
      email: 'ana@correo.co',
      nombre: 'Ana',
      apellido: 'Pérez',
    });
  });

  it('un nombre que no es texto en el metadata queda vacío', async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'u-2',
          email: null,
          user_metadata: { nombre: 42, apellido: undefined },
        },
      },
      error: null,
    });
    const request: RequestConUsuario<UsuarioSupabase> = {
      headers: { authorization: 'Bearer bueno' },
    };

    await crearGuard(getUser).canActivate(contextoCon(request));

    expect(request.usuario).toEqual({
      id: 'u-2',
      email: '',
      nombre: '',
      apellido: '',
    });
  });
});
