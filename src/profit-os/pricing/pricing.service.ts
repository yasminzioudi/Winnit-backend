import { Injectable } from '@nestjs/common';
import {
  calculateBreakEvenPrice,
  calculatePriceForTargetMargin,
  calculateElasticOptimum,
  recommendPriceBand,
  generatePriceCurve,
} from '../domain/pricing';
import type {
  OptimizePriceDto,
  OptimizePriceResponse,
} from './dto/optimize-price.dto';

@Injectable()
export class PricingService {
  optimize(dto: OptimizePriceDto): OptimizePriceResponse {
    const {
      basePriceMillimes,
      cogsMillimes,
      logisticsMillimes,
      baseVolume = 100,
      elasticity = -1.5,
      baseRefusalRate = 0.2,
      refusalSensitivity = 0.002,
      targetMarginPercent,
    } = dto;

    const unitCostMillimes = cogsMillimes + logisticsMillimes;

    const breakEvenPriceMillimes = calculateBreakEvenPrice(
      cogsMillimes,
      logisticsMillimes,
    );

    let targetMarginPriceMillimes: number | undefined;
    if (targetMarginPercent !== undefined && targetMarginPercent > 0) {
      targetMarginPriceMillimes = calculatePriceForTargetMargin(
        cogsMillimes,
        logisticsMillimes,
        targetMarginPercent,
      );
    }

    const elasticOptimumMillimes = calculateElasticOptimum({
      unitCostMillimes,
      baseRefusalRate,
      refusalSensitivity,
      elasticity,
    });

    const recommendedBand = recommendPriceBand(
      basePriceMillimes,
      elasticity,
      unitCostMillimes,
      baseRefusalRate,
      refusalSensitivity,
    );

    const curve = generatePriceCurve(
      cogsMillimes,
      logisticsMillimes,
      basePriceMillimes,
      baseVolume,
      elasticity,
      20,
      baseRefusalRate,
      refusalSensitivity,
    );

    return {
      basePriceMillimes,
      unitCostMillimes,
      recommendedBand,
      elasticOptimumMillimes,
      breakEvenPriceMillimes,
      targetMarginPriceMillimes,
      curve,
      disclaimer: 'modèle basé sur vos hypothèses',
    };
  }
}

