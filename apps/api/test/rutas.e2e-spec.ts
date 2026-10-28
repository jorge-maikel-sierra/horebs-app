import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { Test } from '@nestjs/testing';

/**
 * Red de seguridad de los refactors: arranca AppModule completo (si falta
 * un provider o hay un ciclo, `compile()` falla) y compara la tabla de rutas
 * con `rutas.snapshot.txt`. Mover código entre archivos no puede cambiar una
 * URL; un cambio de contrato se hace a propósito con
 * `ACTUALIZAR_RUTAS=1 npm run test:e2e`.
 *
 * Aislado de producción: antes de importar AppModule se sale del directorio
 * del API (así ConfigModule no lee el `.env` real) y se apunta Supabase a un
 * puerto cerrado.
 */
const SNAPSHOT = join(__dirname, 'rutas.snapshot.txt');

function unir(...partes: unknown[]): string {
  const limpio = partes
    .filter((p): p is string => typeof p === 'string' && p !== '')
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter((p) => p !== '');
  return `/${limpio.join('/')}`;
}

function rutasDe(clase: { prototype: object }): string[] {
  const base: unknown = Reflect.getMetadata(PATH_METADATA, clase);
  return Object.getOwnPropertyNames(clase.prototype).flatMap((nombre) => {
    const handler = Object.getOwnPropertyDescriptor(clase.prototype, nombre)
      ?.value as object | undefined;
    if (typeof handler !== 'function') return [];
    const metodo: unknown = Reflect.getMetadata(METHOD_METADATA, handler);
    if (typeof metodo !== 'number') return [];
    const ruta: unknown = Reflect.getMetadata(PATH_METADATA, handler);
    return [`${RequestMethod[metodo]} ${unir(base, ruta)}`];
  });
}

describe('Tabla de rutas del API', () => {
  let actuales: string[];

  beforeAll(async () => {
    process.chdir(tmpdir());
    process.env.SUPABASE_URL = 'http://127.0.0.1:9';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
    // require y no import: tiene que cargarse DESPUÉS del chdir de arriba.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppModule } =
      require('../src/app.module') as typeof import('../src/app.module');
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const clases = new Set<{ prototype: object }>();
    for (const m of modulo.get(ModulesContainer).values()) {
      for (const c of m.controllers.values()) {
        if (c.metatype) clases.add(c.metatype as { prototype: object });
      }
    }
    actuales = [...clases].flatMap(rutasDe).sort();
    await modulo.close();
  });

  it('coincide con el snapshot (ninguna URL cambió sin querer)', () => {
    if (process.env.ACTUALIZAR_RUTAS) {
      writeFileSync(SNAPSHOT, `${actuales.join('\n')}\n`);
    }
    const esperadas = readFileSync(SNAPSHOT, 'utf8').trim().split('\n');
    expect(actuales).toEqual(esperadas);
  });
});
