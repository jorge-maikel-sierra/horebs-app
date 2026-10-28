import { validarObjeto } from '../common/validacion';
import {
  ESQUEMA_CREAR_EMPLEADO,
  ESQUEMA_EDITAR_EMPLEADO,
  ESQUEMA_REGISTRAR_ADELANTO,
} from './esquemas';

const UUID = '0b0e6a4e-5d0e-4f6a-8f0e-3b7d1b1f2c3d';

const campos = (esquema: Parameters<typeof validarObjeto>[0], cuerpo: object) =>
  validarObjeto(esquema, cuerpo).map((e) => e.campo);

describe('esquemas de nómina', () => {
  it('crear: acepta lo que manda el formulario del panel', () => {
    expect(
      campos(ESQUEMA_CREAR_EMPLEADO, {
        nombre: 'Ana',
        usuario_id: UUID,
        monto_semanal: 300000,
        dias_esperados_semana: 6,
      }),
    ).toEqual([]);
  });

  it('crear: exige nombre y monto, y los días van de 1 a 7', () => {
    expect(
      campos(ESQUEMA_CREAR_EMPLEADO, { dias_esperados_semana: 8 }),
    ).toEqual(['nombre', 'monto_semanal', 'dias_esperados_semana']);
  });

  it('crear: un campo que no existe es error (activo no se crea)', () => {
    expect(
      campos(ESQUEMA_CREAR_EMPLEADO, {
        nombre: 'Ana',
        monto_semanal: 1,
        activo: false,
      }),
    ).toEqual(['activo']);
  });

  it('editar: todo es opcional, activar o desactivar basta', () => {
    expect(campos(ESQUEMA_EDITAR_EMPLEADO, { activo: false })).toEqual([]);
    expect(campos(ESQUEMA_EDITAR_EMPLEADO, {})).toEqual([]);
  });

  it('editar: usuario_id null desvincula al usuario', () => {
    expect(campos(ESQUEMA_EDITAR_EMPLEADO, { usuario_id: null })).toEqual([]);
  });

  it('editar: rechaza tipos equivocados', () => {
    expect(
      campos(ESQUEMA_EDITAR_EMPLEADO, { activo: 'si', monto_semanal: 0 }),
    ).toEqual(['monto_semanal', 'activo']);
  });

  it('adelanto: acepta el body del panel y rechaza fecha o monto inválidos', () => {
    const ok = { empleado_id: UUID, monto: 50000, fecha: '2026-10-28' };
    expect(campos(ESQUEMA_REGISTRAR_ADELANTO, ok)).toEqual([]);
    expect(
      campos(ESQUEMA_REGISTRAR_ADELANTO, { ...ok, monto: 0, fecha: '28/10' }),
    ).toEqual(['monto', 'fecha']);
  });
});
