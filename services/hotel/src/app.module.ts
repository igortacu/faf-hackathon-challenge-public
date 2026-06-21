import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BroadcastModule } from './broadcast/broadcast.module';
import { PrismaModule } from './prisma/prisma.module';
import { SimulationModule } from './simulation/simulation.module';
import { RoomsModule } from './rooms/rooms.module';
import { ReservationModule } from './reservation/reservation.module';
import { HealthController } from './health/health.controller';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';

@Module({
  imports: [
    BroadcastModule,
    PrismaModule,
    SimulationModule,
    RoomsModule,
    ReservationModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
