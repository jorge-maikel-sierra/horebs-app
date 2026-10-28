import { armarCambiosEmpleado } from './empleado-cambios';

describe('armarCambiosEmpleado', () => {
  it('solo incluye los campos que vinieron', () => {
    expect(armarCambiosEmpleado({ activo: false })).toEqual({ activo: false });
    expect(armarCambiosEmpleado({})).toEqual({});
  });

  it('recorta el texto y deja null el que queda vacío', () => {
    expect(
      armarCambiosEmpleado({
        nombre: ' Ana ',
        apellido: '  ',
        cargo: ' Cocina ',
      }),
    ).toEqual({ nombre: 'Ana', apellido: null, cargo: 'Cocina' });
  });

  it('usuario_id null desvincula al usuario', () => {
    expect(armarCambiosEmpleado({ usuario_id: null })).toEqual({
      usuario_id: null,
    });
  });

  it('pasa tal cual el monto, los días y el estado', () => {
    expect(
      armarCambiosEmpleado({
        monto_semanal: 300000,
        dias_esperados_semana: 6,
        activo: true,
      }),
    ).toEqual({
      monto_semanal: 300000,
      dias_esperados_semana: 6,
      activo: true,
    });
  });
});
