import { ClientesController } from './clientes.controller';
import type { ClientesDirectorioService } from './clientes-directorio.service';
import type { ClientesService } from './clientes.service';
import type { PuntosService } from './puntos.service';

function armar() {
  const clientes = {
    listar: jest.fn().mockResolvedValue(['todos']),
    buscar: jest.fn().mockResolvedValue(['buscados']),
  };
  const directorio = { consultar: jest.fn().mockResolvedValue('directorio') };
  const controller = new ClientesController(
    clientes as unknown as ClientesService,
    directorio as unknown as ClientesDirectorioService,
    {} as PuntosService,
  );
  return { controller, clientes, directorio };
}

describe('ClientesController.listarOBuscar', () => {
  it('con vista=directorio devuelve el directorio con toda la consulta', async () => {
    const { controller, directorio, clientes } = armar();
    const consulta = {
      vista: 'directorio',
      segmento: 'frecuentes',
      pagina: '2',
    };
    await expect(controller.listarOBuscar(consulta)).resolves.toBe(
      'directorio',
    );
    expect(directorio.consultar).toHaveBeenCalledWith(consulta);
    expect(clientes.listar).not.toHaveBeenCalled();
  });

  it('con q busca por texto', async () => {
    const { controller, clientes } = armar();
    await controller.listarOBuscar({ q: 'ana' });
    expect(clientes.buscar).toHaveBeenCalledWith('ana');
  });

  it('sin q ni vista lista todos', async () => {
    const { controller, clientes } = armar();
    await controller.listarOBuscar({ q: '  ' });
    expect(clientes.listar).toHaveBeenCalled();
  });
});
