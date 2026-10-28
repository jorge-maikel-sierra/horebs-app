import { Test } from '@nestjs/testing';
import {
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  INestApplication,
  Post,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  CacheControlInterceptor,
  CachePublica,
} from '../src/common/cache-control.interceptor';
import { ProblemDetailsFilter } from '../src/common/problem-details.filter';
import {
  Ubicacion,
  UbicacionInterceptor,
} from '../src/common/ubicacion.interceptor';

@Controller('recursos')
class RecursosController {
  @Post()
  @Ubicacion('/recursos/:id')
  crear() {
    return { id: 'r-1' };
  }

  @Delete('uno')
  @HttpCode(204)
  borrar() {}

  @Post('accion')
  @HttpCode(200)
  accion() {
    return { hecho: true };
  }

  @Post('choque')
  choque() {
    throw new ConflictException('Ya existe.');
  }

  @Get('publico')
  @CachePublica(60)
  publico() {
    return [];
  }

  @Get('privado')
  privado() {
    return [];
  }
}

describe('Semántica HTTP: estados y cabeceras (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [RecursosController],
    }).compile();
    app = modulo.createNestApplication();
    const reflector = app.get(Reflector);
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.useGlobalInterceptors(
      new CacheControlInterceptor(reflector),
      new UbicacionInterceptor(reflector),
    );
    await app.init();
  });

  afterAll(() => app.close());

  it('un POST que crea responde 201 con Location', async () => {
    const res = await request(app.getHttpServer())
      .post('/recursos')
      .expect(201);
    expect(res.headers.location).toBe('/recursos/r-1');
  });

  it('un DELETE responde 204 sin body', async () => {
    const res = await request(app.getHttpServer())
      .delete('/recursos/uno')
      .expect(204);
    expect(res.text).toBe('');
  });

  it('un POST de acción que no crea responde 200, no 201', () =>
    request(app.getHttpServer()).post('/recursos/accion').expect(200));

  it('un conflicto de estado responde 409 problem+json', async () => {
    const res = await request(app.getHttpServer())
      .post('/recursos/choque')
      .expect(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('un GET público se cachea y el resto sale con no-store', async () => {
    const publico = await request(app.getHttpServer()).get('/recursos/publico');
    const privado = await request(app.getHttpServer()).get('/recursos/privado');
    expect(publico.headers['cache-control']).toBe('public, max-age=60');
    expect(privado.headers['cache-control']).toBe('no-store');
  });

  it('un error también sale con no-store', async () => {
    const res = await request(app.getHttpServer()).get('/recursos/inexistente');
    expect(res.status).toBe(404);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
