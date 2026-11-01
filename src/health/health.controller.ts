import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    // Check MongoDB connection
    const mongoReady = this.connection.readyState === 1;

    if (!mongoReady) {
      return {
        status: 'error',
        mongo: 'disconnected',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'ok',
      mongo: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
