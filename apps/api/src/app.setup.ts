import { INestApplication, ValidationPipe } from "@nestjs/common";

export function setupApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix("api");

  /** Wiring shared by the running server and the e2e tests, so the two cannot drift apart. */
  app.useGlobalPipes(
    new ValidationPipe({
      // Drop anything the DTO does not declare, and reject payloads that carry it.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  return app;
}
