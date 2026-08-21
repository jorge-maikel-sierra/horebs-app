import { setDefaultResultOrder } from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Railway (y otros hosts sin salida IPv6) resuelven dominios como
  // smtp.gmail.com con la dirección IPv6 primero por defecto en Node,
  // lo que cuelga la conexión (ENETUNREACH) hasta expirar el timeout.
  // Esto fuerza que toda resolución DNS del proceso prefiera IPv4.
  setDefaultResultOrder('ipv4first');

  // rawBody: true — Meta firma cada webhook (WhatsApp/Messenger/Instagram)
  // con HMAC sobre el body crudo exacto. Sin esto, Express solo deja el
  // JSON ya parseado y la verificación de firma no calza nunca.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // CORS: FRONTEND_URL admite una lista separada por comas (dominio propio,
  // subdominio www, la URL de Vercel, etc.).
  const frontendUrls = (process.env.FRONTEND_URL ?? 'http://localhost:3001')
    .split(',')
    .map((url) => url.trim());
  app.enableCors({ origin: frontendUrls, credentials: true });

  // Railway manda SIGTERM en cada redeploy — sin esto, Nest mata el
  // proceso al toque y corta requests en curso a mitad de camino.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`API corriendo en http://localhost:${port}`);
}
bootstrap();
