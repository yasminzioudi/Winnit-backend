import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdSpendController } from './ad-spend.controller';
import { AdSpendService } from './ad-spend.service';
import { AdSpendRepository } from './ad-spend.repository';
import { AdSpend, AdSpendSchema } from './schemas/ad-spend.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AdSpend.name, schema: AdSpendSchema }]),
  ],
  controllers: [AdSpendController],
  providers: [AdSpendService, AdSpendRepository],
  exports: [AdSpendService, AdSpendRepository],
})
export class AdSpendModule {}

