import { ServiceUnavailableException } from '@nestjs/common';
import {
  ErrorGraphPermanente,
  errorDeGraph,
  esErrorPermanente,
} from './graph-errores';

describe('errores de Graph', () => {
  it('un 4xx es permanente y no se reintenta', () => {
    expect(esErrorPermanente(400)).toBe(true);
    expect(errorDeGraph(400, 'ventana cerrada')).toBeInstanceOf(
      ErrorGraphPermanente,
    );
  });

  it('el 429 y los 5xx sí se reintentan', () => {
    expect(esErrorPermanente(429)).toBe(false);
    expect(esErrorPermanente(503)).toBe(false);
    expect(errorDeGraph(503, 'caído')).not.toBeInstanceOf(ErrorGraphPermanente);
  });

  it('sigue siendo ServiceUnavailableException para quien ya lo atrapa así', () => {
    expect(errorDeGraph(400, 'x')).toBeInstanceOf(ServiceUnavailableException);
  });
});
