import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScenariosController } from './scenarios.controller';
import { ScenariosService } from './scenarios.service';
import { ScenariosRepository } from './scenarios.repository';
import { Scenario, ScenarioSchema } from './schemas/scenario.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Scenario.name, schema: ScenarioSchema },
    ]),
  ],
  controllers: [ScenariosController],
  providers: [ScenariosService, ScenariosRepository],
  exports: [ScenariosService, ScenariosRepository],
})
export class ScenariosModule {}
