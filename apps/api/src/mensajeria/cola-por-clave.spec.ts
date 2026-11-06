import { ColaPorClave } from './cola-por-clave';

const esperar = (ms: number): Promise<void> =>
  new Promise((resolver) => setTimeout(resolver, ms));

describe('ColaPorClave', () => {
  it('procesa de a una las tareas de la misma clave, en orden de llegada', async () => {
    const cola = new ColaPorClave();
    const eventos: string[] = [];

    const a = cola.ejecutar('cliente-1', async () => {
      eventos.push('a:inicio');
      await esperar(30);
      eventos.push('a:fin');
    });
    const b = cola.ejecutar('cliente-1', () => {
      eventos.push('b:inicio');
      return Promise.resolve();
    });
    await Promise.all([a, b]);

    expect(eventos).toEqual(['a:inicio', 'a:fin', 'b:inicio']);
  });

  it('deja correr en paralelo a clientes distintos', async () => {
    const cola = new ColaPorClave();
    const eventos: string[] = [];

    const lento = cola.ejecutar('cliente-1', async () => {
      await esperar(30);
      eventos.push('cliente-1');
    });
    const rapido = cola.ejecutar('cliente-2', () => {
      eventos.push('cliente-2');
      return Promise.resolve();
    });
    await Promise.all([lento, rapido]);

    expect(eventos).toEqual(['cliente-2', 'cliente-1']);
  });

  it('una tarea que falla no frena a la siguiente y el error le llega a quien la pidió', async () => {
    const cola = new ColaPorClave();

    const falla = cola.ejecutar('cliente-1', () =>
      Promise.reject(new Error('boom')),
    );
    const sigue = cola.ejecutar('cliente-1', () => Promise.resolve('ok'));

    await expect(falla).rejects.toThrow('boom');
    await expect(sigue).resolves.toBe('ok');
  });

  it('no deja claves colgadas cuando termina el trabajo', async () => {
    const cola = new ColaPorClave();

    await cola.ejecutar('cliente-1', () => Promise.resolve());
    await cola
      .ejecutar('cliente-2', () => Promise.reject(new Error('x')))
      .catch(() => undefined);
    await esperar(0);

    expect(cola.enCurso).toBe(0);
  });
});
