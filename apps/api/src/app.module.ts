import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { JobsModule } from "./jobs/jobs.module.js";

@Module({
  imports: [JobsModule],
  controllers: [AppController],
})
export class AppModule {}
