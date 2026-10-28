import {
  ExecutionContext,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ContentTypeGuard } from './content-type.guard';

function contexto(req: { method: string; path: string; is: () => unknown }) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('ContentTypeGuard', () => {
  const guard = new ContentTypeGuard();

  it('un GET siempre pasa', () => {
    expect(
      guard.canActivate(
        contexto({ method: 'GET', path: '/x', is: () => false }),
      ),
    ).toBe(true);
  });
  it('un POST con JSON, o sin body, pasa', () => {
    for (const es of ['json', null]) {
      expect(
        guard.canActivate(
          contexto({ method: 'POST', path: '/x', is: () => es }),
        ),
      ).toBe(true);
    }
  });
  it('un POST con otro tipo de contenido es 415', () => {
    expect(() =>
      guard.canActivate(
        contexto({ method: 'POST', path: '/x', is: () => false }),
      ),
    ).toThrow(UnsupportedMediaTypeException);
  });
  it('los webhooks de Meta quedan exentos', () => {
    expect(
      guard.canActivate(
        contexto({
          method: 'POST',
          path: '/webhooks/whatsapp',
          is: () => false,
        }),
      ),
    ).toBe(true);
  });
});
