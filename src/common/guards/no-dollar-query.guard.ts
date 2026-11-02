import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

export function validateNoDollarOrDotKeys(obj: unknown, prefix = ''): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      throw new BadRequestException(
        `Query parameter key cannot start with '$' or contain '.': ${prefix}${key}`,
      );
    }
    if (typeof value === 'object' && value !== null) {
      validateNoDollarOrDotKeys(value, `${prefix}${key}.`);
    }
  }
}

@Injectable()
export class NoDollarQueryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request && request.query) {
      validateNoDollarOrDotKeys(request.query);
    }
    return true;
  }
}
