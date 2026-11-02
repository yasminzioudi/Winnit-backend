import { Injectable } from '@nestjs/common';
import {
  calculateBreakEvenPrice,
  calculatePriceForTargetMargin,
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

    const cpaMillimes = dto.cpaMillimes ?? 0;
    const unitCostMillimes = cogsMillimes + logisticsMillimes + cpaMillimes;

    const breakEvenPriceMillimes = calculateBreakEvenPrice(
      cogsMillimes,
      logisticsMillimes + cpaMillimes,
    );

    let targetMarginPriceMillimes: number | undefined;
    if (targetMarginPercent !== undefined && targetMarginPercent > 0) {
      targetMarginPriceMillimes = calculatePriceForTargetMargin(
        cogsMillimes,
        logisticsMillimes + cpaMillimes,
        targetMarginPercent,
      );
    }

    const curve = generatePriceCurve(
      cogsMillimes,
      logisticsMillimes,
      basePriceMillimes,
      baseVolume,
      elasticity,
      20,
      baseRefusalRate,
      refusalSensitivity,
      cpaMillimes,
    );

    // The optimum is the argmax of the profit curve (curve peak agrees with optimum)
    let bestPoint = curve[0];
    for (const point of curve) {
      if (point.profitMillimes > bestPoint.profitMillimes) {
        bestPoint = point;
      }
    }
    const elasticOptimumMillimes = bestPoint.priceMillimes;

    const recommendedBand = {
      minMillimes: Math.round(basePriceMillimes * 0.8),
      maxMillimes: elasticOptimumMillimes,
      label: 'modèle basé sur vos hypothèses',
    };

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

