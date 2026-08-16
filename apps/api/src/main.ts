import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { setupApp } from "./app.setup.js";

async function bootstrap(): Promise<void> {
  const app = setupApp(await NestFactory.create(AppModule));

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
