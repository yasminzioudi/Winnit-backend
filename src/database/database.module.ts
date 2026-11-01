import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const isTest = configService.get('nodeEnv') === 'test';
        const uri = isTest
          ? configService.get<string>('mongodb.testUri')
          : configService.get<string>('mongodb.uri');

        return {
          uri,
          // Mongoose 9 defaults are good; explicit config for clarity
          autoIndex: !isTest, // Only in dev
          serverSelectionTimeoutMS: 5000,
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
