import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PricingService } from './pricing.service';
import {
  OptimizePriceDto,
  type OptimizePriceResponse,
} from './dto/optimize-price.dto';
import { DevTenantGuard } from '../../tenancy/guards/dev-tenant.guard';

@ApiTags('Pricing')
@ApiHeader({
  name: 'x-workspace-id',
  description: 'Tenant workspace ID',
  required: true,
})
@UseGuards(DevTenantGuard)
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('optimize')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Optimize pricing using demand elasticity and refusal sensitivity models',
  })
  @ApiResponse({
    status: 200,
    description: 'Pricing optimization results with recommended band and curve',
  })
  @ApiResponse({ status: 400, description: 'Invalid pricing parameters' })
  optimize(@Body() dto: OptimizePriceDto): OptimizePriceResponse {
    return this.pricingService.optimize(dto);
  }
}
