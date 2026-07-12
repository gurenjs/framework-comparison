import {
  INestApplication,
  UnprocessableEntityException,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';
import session from 'express-session';
import passport from 'passport';

/**
 * Configures everything `NestFactory.create` does not: the global prefix,
 * validation, and the session/Passport middleware. Shared between `main.ts`
 * and the e2e tests so both run the exact same pipeline.
 */
export function setupApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (validationErrors: ValidationError[]) =>
        new UnprocessableEntityException({
          errors: Object.fromEntries(
            validationErrors.map((error) => [
              error.property,
              Object.values(error.constraints ?? {}),
            ]),
          ),
        }),
    }),
  );
  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? 'minilog-dev-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: 'auto', // Secure when the connection is TLS
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
  return app;
}
