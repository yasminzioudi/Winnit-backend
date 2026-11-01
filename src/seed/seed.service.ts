import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Idempotent seed service for dev/demo workspace.
 * Full implementation in Phase 4 after domain + CRUD modules exist.
 */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly configService: ConfigService) {}

  async seed(): Promise<void> {
    const workspaceId = this.configService.get<string>('devWorkspaceId');
    this.logger.log(`Seeding workspace: ${workspaceId}`);

    // TODO: Phase 4 - implement idempotent seed with PRNG
    this.logger.log('Seed skeleton - full implementation in Phase 4');
  }
}
