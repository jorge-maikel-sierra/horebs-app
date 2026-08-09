import { setDefaultResultOrder } from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Railway (y otros hosts sin salida IPv6) resuelven dominios como
  // smtp.gmail.com con la dirección IPv6 primero por defecto en Node,
  // lo que cuelga la conexión (ENETUNREACH) hasta expirar el timeout.
  // Esto fuerza que toda resolución DNS del proceso prefiera IPv4.
  setDefaultResultOrder('ipv4first');

  const app = await NestFactory.create(AppModule);

  // CORS: FRONTEND_URL admite una lista separada por comas (dominio propio,
  // subdominio www, la URL de Vercel, etc.).
  const frontendUrls = (process.env.FRONTEND_URL ?? 'http://localhost:3001')
    .split(',')
    .map((url) => url.trim());
  app.enableCors({ origin: frontendUrls, credentials: true });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API corriendo en http://localhost:${port}`);
}
bootstrap();
