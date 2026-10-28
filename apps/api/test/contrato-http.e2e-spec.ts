import { tmpdir } from 'node:os';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

/**
 * Contrato HTTP de la app real: AppModule completo con la misma configuración
 * que `main.ts` (`configurarApp`). Las rutas protegidas se prueban sin sesión
 * a propósito: lo que se verifica es cómo responde el API de punta a punta
 * (errores, cabeceras, CORS), no la lógica de cada módulo.
 *
 * Aislado de producción: igual que `rutas.e2e-spec.ts`, sale del directorio
 * del API (así ConfigModule no lee el `.env` real) y apunta Supabase a un
 * puerto cerrado.
 */
const ORIGEN = 'http://localhost:3001';
const TIEMPO_DE_ARRANQUE_MS = 30_000;

describe('Contrato HTTP del API (app real)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.chdir(tmpdir());
    process.env.SUPABASE_URL = 'http://127.0.0.1:9';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
    // require y no import: tiene que cargarse DESPUÉS del chdir de arriba.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { AppModule } =
      require('../src/app.module') as typeof import('../src/app.module');
    const { configurarApp } =
      require('../src/configurar-app') as typeof import('../src/configurar-app');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication({ rawBody: true });
    configurarApp(app);
    await app.init();
    // Con la caché de ts-jest fría, compilar AppModule pasa de los 5 s de Jest.
  }, TIEMPO_DE_ARRANQUE_MS);

  afterAll(() => app.close());

  it('una ruta que no existe es 404 en problem+json y sin caché', async () => {
    const res = await request(app.getHttpServer())
      .get('/no-existe')
      .expect(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({
      status: 404,
      instance: '/no-existe',
    });
    expect(res.body).not.toHaveProperty('message');
  });

  it('una ruta protegida sin sesión es 401 en problem+json', async () => {
    const res = await request(app.getHttpServer())
      .get('/turnos/actual')
      .expect(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('un POST que no es JSON es 415 antes de llegar a la sesión', async () => {
    const res = await request(app.getHttpServer())
      .post('/turnos')
      .set('Content-Type', 'text/plain')
      .send('hola')
      .expect(415);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('un POST con JSON pasa el filtro de tipo y cae en la sesión (401)', () =>
    request(app.getHttpServer())
      .post('/turnos')
      .send({ monto_inicial: 0 })
      .expect(401));

  it('CORS deja leer Location, Deprecation, Link y Retry-After al front', async () => {
    const res = await request(app.getHttpServer())
      .get('/no-existe')
      .set('Origin', ORIGEN);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGEN);
    expect(res.headers['access-control-expose-headers']).toBe(
      'Location,Deprecation,Link,Retry-After',
    );
  });

  it('las rutas con verbo que se quitaron ya no existen', async () => {
    await request(app.getHttpServer())
      .post('/turnos/abrir')
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .post('/blog/posts/algo/likes')
      .send({})
      .expect(404);
  });
});
