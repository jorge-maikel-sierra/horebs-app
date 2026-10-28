import { Test } from '@nestjs/testing';
import {
  Body,
  Controller,
  Get,
  INestApplication,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ContentTypeGuard } from '../src/common/content-type.guard';
import { FechaPipe } from '../src/common/pipes/fecha.pipe';
import { LimitePipe } from '../src/common/pipes/limite.pipe';
import { UuidPipe } from '../src/common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../src/common/pipes/validar-body.pipe';
import { ProblemDetailsFilter } from '../src/common/problem-details.filter';
import { numero, texto } from '../src/common/validacion';

const ESQUEMA = { nombre: texto(), cantidad: numero({ min: 1, entero: true }) };
const UUID = '0b0e6a4e-5d0e-4f6a-8f0e-3b7d1b1f2c3d';

@Controller('prueba')
class PruebaController {
  @Get(':id')
  uno(@Param('id', UuidPipe) id: string) {
    return { id };
  }

  @Get()
  lista(
    @Query('limit', new LimitePipe(10)) limit?: number,
    @Query('desde', new FechaPipe('desde')) desde?: string,
  ) {
    return { limit, desde };
  }

  @Post()
  crear(@Body(new ValidarBodyPipe(ESQUEMA)) body: unknown) {
    return body;
  }
}

describe('Contrato HTTP de validación (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [PruebaController],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.useGlobalGuards(new ContentTypeGuard());
    await app.init();
  });

  afterAll(() => app.close());

  it('un id que no es uuid es 400 problem+json', async () => {
    const res = await request(app.getHttpServer())
      .get('/prueba/abc')
      .expect(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect((res.body as { detail: string }).detail).toBe(
      'El identificador no es válido.',
    );
  });

  it('un uuid válido pasa', () =>
    request(app.getHttpServer()).get(`/prueba/${UUID}`).expect(200));

  it('limit y fecha inválidos son 400; válidos llegan tipados', async () => {
    await request(app.getHttpServer()).get('/prueba?limit=0').expect(400);
    await request(app.getHttpServer()).get('/prueba?limit=11').expect(400);
    await request(app.getHttpServer())
      .get('/prueba?desde=2026-02-31')
      .expect(400);
    const res = await request(app.getHttpServer())
      .get('/prueba?limit=5&desde=2026-10-27')
      .expect(200);
    expect(res.body).toEqual({ limit: 5, desde: '2026-10-27' });
  });

  it('un body inválido es 400 con errores[] por campo', async () => {
    const res = await request(app.getHttpServer())
      .post('/prueba')
      .send({ nombre: '', cantidad: 1.5, extra: true })
      .expect(400);
    const cuerpo = res.body as { errores: { campo: string }[] };
    expect(cuerpo.errores.map((e) => e.campo)).toEqual([
      'nombre',
      'cantidad',
      'extra',
    ]);
  });

  it('un body que no es un objeto es 400', () =>
    request(app.getHttpServer()).post('/prueba').send([1, 2]).expect(400));

  it('un body válido pasa', () =>
    request(app.getHttpServer())
      .post('/prueba')
      .send({ nombre: 'Ana', cantidad: 2 })
      .expect(201));

  it('un POST con texto plano es 415', async () => {
    const res = await request(app.getHttpServer())
      .post('/prueba')
      .set('Content-Type', 'text/plain')
      .send('hola')
      .expect(415);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });
});
