import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { HealthController } from "./health.controller";
import { EvaluationsController } from "./evaluations.controller";
import { QuotesController } from "./quotes.controller";
import { EvaluatorService } from "./evaluator.service";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard } from "./auth.guard";
import { RolesGuard } from "./roles.guard";
import { CatalogController } from "./catalog/catalog.controller";
import { CatalogService } from "./catalog/catalog.service";
import { BuildsController } from "./builds/builds.controller";
import { BuildsService } from "./builds/builds.service";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret)
  throw new Error("JWT_SECRET debe estar definido en el entorno.");

@Module({
  imports: [
    HttpModule,
    JwtModule.register({ secret: jwtSecret, signOptions: { expiresIn: "7d" } }),
  ],
  controllers: [
    HealthController,
    EvaluationsController,
    QuotesController,
    AuthController,
    CatalogController,
    BuildsController,
  ],
  providers: [
    EvaluatorService,
    PrismaService,
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    CatalogService,
    BuildsService,
  ],
})
export class AppModule {}
