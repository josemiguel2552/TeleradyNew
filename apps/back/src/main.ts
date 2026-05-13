import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoLogger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import basicAuth from 'express-basic-auth';
import type { Express } from 'express';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);
  const env = config.getOrThrow<'development' | 'test' | 'production'>('NODE_ENV');
  const isProd = env === 'production';

  // Behind nginx / a load balancer, so trust the immediate proxy hop
  // for client IP, X-Forwarded-* and protocol detection.
  (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'"],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      strictTransportSecurity: isProd
        ? { maxAge: 63072000, includeSubDomains: true, preload: true }
        : false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
      xPoweredBy: false,
    }),
  );

  app.use(cookieParser());
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  const allowedOrigins = config.getOrThrow<string[]>('CORS_ORIGINS');
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept-Language', 'X-Requested-With'],
    maxAge: 600,
  });

  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      in: 'header',
    })
    .setTitle('Telerady API')
    .setDescription('Telerady — teleradiology platform API (v1)')
    .setVersion('1.0')
    .build();

  if (isProd) {
    const user = config.get<string>('SWAGGER_USER');
    const password = config.get<string>('SWAGGER_PASSWORD');
    if (user && password) {
      app.use(
        ['/api-docs/v1', '/api-docs/v1-json'],
        basicAuth({ users: { [user]: password }, challenge: true }),
      );
      SwaggerModule.setup('api-docs/v1', app, SwaggerModule.createDocument(app, swaggerConfig));
    }
  } else {
    SwaggerModule.setup('api-docs/v1', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  app.get(PinoLogger).log(`Telerady API listening on port ${port} (env=${env})`);
}

bootstrap();
