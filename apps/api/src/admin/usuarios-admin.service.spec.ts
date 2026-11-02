import { NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { UsuariosAdminService } from './usuarios-admin.service';

interface Escritura {
  metodo: string;
  datos: unknown;
}

const POR_PAGINA = 200;

const usuario = (n: number, email: string) => ({ id: `u-${n}`, email });

/** Una página de usuarios de Auth por llamada, en orden. */
function crearServicio(paginas: { id: string; email: string }[][]) {
  const escrituras: Escritura[] = [];
  const consultadas: number[] = [];
  let resultadoPerfil: unknown = { id: 'u-1', rol: 'admin' };
  const from = () => {
    const b = {
      select: () => b,
      order: () => b,
      returns: () => Promise.resolve({ data: [{ id: 'u-1' }], error: null }),
      upsert: (datos: unknown) => {
        escrituras.push({ metodo: 'upsert', datos });
        return b;
      },
      delete: () => {
        escrituras.push({ metodo: 'delete', datos: null });
        return b;
      },
      eq: () => Promise.resolve({ error: null }),
      single: () => Promise.resolve({ data: resultadoPerfil, error: null }),
    };
    return b;
  };
  const listUsers = ({ page }: { page: number }) => {
    consultadas.push(page);
    return Promise.resolve({
      data: { users: paginas[page - 1] ?? [] },
      error: null,
    });
  };
  const servicio = new UsuariosAdminService({
    getClient: () => ({ from, auth: { admin: { listUsers } } }),
  } as unknown as SupabaseService);
  return {
    servicio,
    escrituras,
    consultadas,
    perfil: (p: unknown) => {
      resultadoPerfil = p;
    },
  };
}

describe('UsuariosAdminService', () => {
  it('lista el personal con acceso al panel', async () => {
    const { servicio } = crearServicio([]);

    await expect(servicio.listarUsuarios()).resolves.toEqual([{ id: 'u-1' }]);
  });

  it('asignar rol a un correo sin cuenta es 404 y no escribe', async () => {
    const { servicio, escrituras } = crearServicio([
      [usuario(1, 'otra@correo.co')],
    ]);

    await expect(
      servicio.asignarRol({ email: 'nadie@correo.co', rol: 'empleado' }),
    ).rejects.toThrow(NotFoundException);
    expect(escrituras).toEqual([]);
  });

  it('busca el correo sin importar mayúsculas ni espacios', async () => {
    const { servicio, escrituras } = crearServicio([
      [usuario(1, 'Ana@Correo.co')],
    ]);

    await servicio.asignarRol({ email: '  ana@correo.CO ', rol: 'empleado' });

    expect(escrituras[0]).toEqual({
      metodo: 'upsert',
      datos: { id: 'u-1', email: 'Ana@Correo.co', rol: 'empleado' },
    });
  });

  it('solo toca la cédula si la llamada la trae', async () => {
    const sin = crearServicio([[usuario(1, 'ana@correo.co')]]);
    const con = crearServicio([[usuario(1, 'ana@correo.co')]]);
    const vacia = crearServicio([[usuario(1, 'ana@correo.co')]]);

    await sin.servicio.asignarRol({ email: 'ana@correo.co', rol: 'admin' });
    await con.servicio.asignarRol({
      email: 'ana@correo.co',
      rol: 'admin',
      cedula: ' 123 ',
    });
    await vacia.servicio.asignarRol({
      email: 'ana@correo.co',
      rol: 'admin',
      cedula: '  ',
    });

    expect(sin.escrituras[0].datos).not.toHaveProperty('cedula');
    expect(con.escrituras[0].datos).toHaveProperty('cedula', '123');
    expect(vacia.escrituras[0].datos).toHaveProperty('cedula', null);
  });

  it('sigue buscando en la página siguiente si la primera vino llena', async () => {
    const llena = Array.from({ length: POR_PAGINA }, (_, i) =>
      usuario(i, `u${i}@correo.co`),
    );
    const { servicio, consultadas } = crearServicio([
      llena,
      [usuario(999, 'ana@correo.co')],
    ]);

    await servicio.asignarRol({ email: 'ana@correo.co', rol: 'empleado' });

    expect(consultadas).toEqual([1, 2]);
  });

  it('quitar el rol borra el perfil', async () => {
    const { servicio, escrituras } = crearServicio([]);

    await servicio.quitarRol('u-1');

    expect(escrituras).toEqual([{ metodo: 'delete', datos: null }]);
  });
});
