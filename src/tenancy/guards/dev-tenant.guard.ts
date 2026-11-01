import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Dev-only tenant guard: reads x-workspace-id header and injects into request.
 * INTEGRATION POINT: Replace with JWT-based auth that extracts tenant from claims.
 * Hard-fails when NODE_ENV=production.
 */
@Injectable()
export class DevTenantGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const nodeEnv = this.configService.get<string>('nodeEnv');

    // Refuse to run in production
    if (nodeEnv === 'production') {
      throw new ForbiddenException(
        'DevTenantGuard cannot run in production. Implement JWT-based auth.',
      );
    }

    const request = context.switchToHttp().getRequest();
    const workspaceId = request.headers['x-workspace-id'];

    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new UnauthorizedException(
        'Missing x-workspace-id header (dev mode only)',
      );
    }

    // Inject into request for @CurrentWorkspace() decorator
    request.workspaceId = workspaceId;

    return true;
  }
}
