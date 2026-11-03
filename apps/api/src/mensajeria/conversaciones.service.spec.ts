import { SupabaseService } from '../supabase/supabase.service';
import { ConversacionesService } from './conversaciones.service';

describe('ConversacionesService', () => {
  interface LlamadaUpdate {
    tabla: string;
    datos: Record<string, unknown>;
    filtros: [string, unknown][];
  }

  function crear(opciones: { errorUpdate?: boolean } = {}) {
    const updates: LlamadaUpdate[] = [];
    const b = {
      update: (datos: Record<string, unknown>) => {
        const u: LlamadaUpdate = {
          tabla: 'conversaciones_bot',
          datos,
          filtros: [],
        };
        updates.push(u);
        return {
          eq: (campo: string, valor: unknown) => {
            u.filtros.push([campo, valor]);
            return {
              eq: (campo2: string, valor2: unknown) => {
                u.filtros.push([campo2, valor2]);
                return Promise.resolve({
                  error: opciones.errorUpdate
                    ? { code: '500', message: 'error bd' }
                    : null,
                });
              },
            };
          },
        };
      },
      from: (tabla: string) => ({
        ...b,
        tabla,
      }),
    };

    const supabase = {
      getClient: () => b,
    };

    const servicio = new ConversacionesService(
      supabase as unknown as SupabaseService,
    );

    return { servicio, updates };
  }

  describe('guardarTelefono', () => {
    it('actualiza la columna telefono para el canal y usuario especificado', async () => {
      const { servicio, updates } = crear();

      await servicio.guardarTelefono('messenger', 'psid-123', '3157861208');

      expect(updates.length).toBe(1);
      expect(updates[0].datos).toEqual({ telefono: '3157861208' });
      expect(updates[0].filtros).toEqual([
        ['canal', 'messenger'],
        ['identificador_externo', 'psid-123'],
      ]);
    });

    it('propaga error traducido por errorDeBase si la actualización falla', async () => {
      const { servicio } = crear({ errorUpdate: true });

      await expect(
        servicio.guardarTelefono('instagram', 'igsid-456', '3157861208'),
      ).rejects.toThrow();
    });
  });
});
