import { Injectable } from '@angular/core';
import { IndustryBuilding, ResourceRequirement, ResourceProduction, ImportSource, ExportTarget } from '../models/api-models';
import { GameDataApiService } from './game-data-api.service';

interface ResourcePrice {
  name: string;
  prices: {
    natoSell: number;
    natoBuy: number;
    ussrSell: number;
    ussrBuy: number;
  };
  lastUpdated: string;
}

@Injectable({
  providedIn: 'root'
})
export class IndustryCalculatorService {
  private resourcePricesCache: Map<string, ResourcePrice> = new Map();
  private pricesCacheLoaded = false;

  constructor(private gameDataApi: GameDataApiService) {
    this.loadPricesFromApi();
  }

  private loadPricesFromApi(): void {
    try {
      this.gameDataApi.getAllResources().subscribe({
        next: (resources) => {
          this.resourcePricesCache.clear();
          resources.forEach(resource => {
            const resourcePrice: ResourcePrice = {
              name: resource.name,
              prices: {
                natoSell: resource.natoSell,
                natoBuy: resource.natoBuy,
                ussrSell: resource.ussrSell,
                ussrBuy: resource.ussrBuy
              },
              lastUpdated: resource.lastUpdated
            };
            this.resourcePricesCache.set(resource.name, resourcePrice);
          });
          this.pricesCacheLoaded = true;
        },
        error: (error) => {
          console.error('Error loading prices from API:', error);
          this.pricesCacheLoaded = false;
        }
      });
    } catch (error) {
      console.error('Error loading prices from API:', error);
      this.pricesCacheLoaded = false;
    }
  }

  /**
   * Get resource price from API cache with localStorage fallback
   */
  getResourcePrice(resourceName: string): ResourcePrice | null {
    try {
      // First try API cache
      if (this.pricesCacheLoaded && this.resourcePricesCache.size > 0) {
        // Try exact match first
        const exactMatch = this.resourcePricesCache.get(resourceName);
        if (exactMatch) return exactMatch;

        // Try case-insensitive partial match
        const lowerSearchName = resourceName.toLowerCase();
        for (const [name, price] of this.resourcePricesCache.entries()) {
          if (name.toLowerCase().includes(lowerSearchName) ||
              lowerSearchName.includes(name.toLowerCase())) {
            return price;
          }
        }
      }

      // Fallback to localStorage if API cache is not available
      const stored = localStorage.getItem('pricesDatasets');
      if (!stored) return null;

      const datasets = JSON.parse(stored);
      const resourceMap = new Map<string, ResourcePrice>();

      // Combine all resources from all datasets, using most recent
      datasets.forEach((dataset: any) => {
        dataset.resources?.forEach((resource: ResourcePrice) => {
          if (!resourceMap.has(resource.name) ||
              new Date(resource.lastUpdated) > new Date(resourceMap.get(resource.name)!.lastUpdated)) {
            resourceMap.set(resource.name, resource);
          }
        });
      });

      // Try exact match first
      const exactMatch = resourceMap.get(resourceName);
      if (exactMatch) return exactMatch;

      // Try case-insensitive partial match
      const lowerSearchName = resourceName.toLowerCase();
      for (const [name, price] of resourceMap.entries()) {
        if (name.toLowerCase().includes(lowerSearchName) ||
            lowerSearchName.includes(name.toLowerCase())) {
          return price;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting resource price:', error);
      return null;
    }
  }

  /**
   * Get workdays pricing from API with localStorage fallback
   */
  getWorkdaysPricing(): { ussrCost: number; natoCost: number } {
    try {
      // Try to get from API first - this will be called synchronously
      // For async operations, components should call the API directly
      const stored = localStorage.getItem('workdaysPricing');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error getting workdays pricing:', error);
    }
    return { ussrCost: 0, natoCost: 0 };
  }

  /**
   * Get workdays pricing from API (async version)
   */
  async getWorkdaysPricingFromApi(): Promise<{ ussrCost: number; natoCost: number }> {
    try {
      const workday = await this.gameDataApi.getWorkday().toPromise();
      return {
        ussrCost: workday?.ussrBuy || 0,
        natoCost: workday?.natoBuy || 0
      };
    } catch (error) {
      console.error('Error getting workdays pricing from API:', error);
      return this.getWorkdaysPricing(); // Fallback to localStorage
    }
  }

  /**
   * Calculate construction cost for a building with specific import strategy
   */
  calculateConstructionCost(building: IndustryBuilding, importSource: ImportSource): number {
    let totalCost = 0;
    const workdaysPricing = this.getWorkdaysPricing();

    for (const material of building.constructionCost.materials) {
      if (material.name.toLowerCase().includes('workdays')) {
        // Handle workdays separately
        let workdayCost = 0;
        switch (importSource) {
          case 'importNATO':
            workdayCost = workdaysPricing.natoCost;
            break;
          case 'importUSSR':
            workdayCost = workdaysPricing.ussrCost;
            break;
          case 'own':
            workdayCost = (workdaysPricing.natoCost + workdaysPricing.ussrCost) / 2;
            break;
        }
        totalCost += material.quantity * workdayCost;
      } else {
        const price = this.getResourcePrice(material.name);
        if (price) {
          let unitCost = 0;
          switch (importSource) {
            case 'importNATO':
              unitCost = price.prices.natoBuy;
              break;
            case 'importUSSR':
              unitCost = price.prices.ussrBuy;
              break;
            case 'own':
              unitCost = (price.prices.natoSell + price.prices.ussrSell) / 2;
              break;
          }
          totalCost += material.quantity * unitCost;
        }
      }
    }

    return totalCost;
  }

  /**
   * Calculate daily import cost based on consumption inputs
   */
  calculateDailyImportCost(building: IndustryBuilding, importSource: ImportSource): number {
    let total = 0;

    for (const input of building.consumption.inputs) {
      const price = this.getResourcePrice(input.name);
      if (price) {
        let unitCost = 0;
        switch (importSource) {
          case 'importNATO':
            unitCost = price.prices.natoBuy;
            break;
          case 'importUSSR':
            unitCost = price.prices.ussrBuy;
            break;
          case 'own':
            unitCost = (price.prices.natoSell + price.prices.ussrSell) / 2;
            break;
        }
        total += input.quantity * unitCost;
      }
    }

    return total;
  }

  /**
   * Calculate daily export value based on production outputs
   */
  calculateDailyExportValue(building: IndustryBuilding, exportTarget: ExportTarget): number {
    let total = 0;

    for (const output of building.production.outputs) {
      const price = this.getResourcePrice(output.name);
      if (price) {
        let unitValue = 0;
        switch (exportTarget) {
          case 'exportNATO':
            unitValue = price.prices.natoSell;
            break;
          case 'exportUSSR':
            unitValue = price.prices.ussrSell;
            break;
          case 'own':
            unitValue = (price.prices.natoSell + price.prices.ussrSell) / 2;
            break;
        }
        total += output.quantity * unitValue;
      }
    }

    return total;
  }

  /**
   * Calculate daily profit
   */
  calculateDailyProfit(building: IndustryBuilding, importSource: ImportSource, exportTarget: ExportTarget): number {
    const revenue = this.calculateDailyExportValue(building, exportTarget);
    const cost = this.calculateDailyImportCost(building, importSource);
    return revenue - cost;
  }

  /**
   * Calculate profit per worker per day
   */
  calculateProfitPerWorker(building: IndustryBuilding, importSource: ImportSource, exportTarget: ExportTarget): number {
    const dailyProfit = this.calculateDailyProfit(building, importSource, exportTarget);
    const workers = building.maxWorkers || 1;
    return dailyProfit / workers;
  }

  /**
   * Update building's profitability data for specific currency strategy
   */
  updateBuildingProfitability(building: IndustryBuilding, importSource: ImportSource, exportTarget: ExportTarget): void {
    const dailyCost = this.calculateDailyImportCost(building, importSource);
    const dailyRevenue = this.calculateDailyExportValue(building, exportTarget);
    const dailyProfit = dailyRevenue - dailyCost;

    building.profitability = {
      dailyCost: dailyCost,
      dailyRevenue: dailyRevenue,
      dailyProfit: dailyProfit,
      monthlyProfit: dailyProfit * 30,
      yearlyProfit: dailyProfit * 365,
      profitPerWorkerDay: this.calculateProfitPerWorker(building, importSource, exportTarget)
    };
  }

  /**
   * Get comparative analysis for USSR vs NATO strategies
   */
  getComparativeAnalysis(building: IndustryBuilding): {
    ussr: {
      dailyCost: number;
      dailyRevenue: number;
      dailyProfit: number;
      profitPerWorker: number;
    };
    nato: {
      dailyCost: number;
      dailyRevenue: number;
      dailyProfit: number;
      profitPerWorker: number;
    };
    own: {
      dailyCost: number;
      dailyRevenue: number;
      dailyProfit: number;
      profitPerWorker: number;
    };
  } {
    return {
      ussr: {
        dailyCost: this.calculateDailyImportCost(building, 'importUSSR'),
        dailyRevenue: this.calculateDailyExportValue(building, 'exportUSSR'),
        dailyProfit: this.calculateDailyProfit(building, 'importUSSR', 'exportUSSR'),
        profitPerWorker: this.calculateProfitPerWorker(building, 'importUSSR', 'exportUSSR')
      },
      nato: {
        dailyCost: this.calculateDailyImportCost(building, 'importNATO'),
        dailyRevenue: this.calculateDailyExportValue(building, 'exportNATO'),
        dailyProfit: this.calculateDailyProfit(building, 'importNATO', 'exportNATO'),
        profitPerWorker: this.calculateProfitPerWorker(building, 'importNATO', 'exportNATO')
      },
      own: {
        dailyCost: this.calculateDailyImportCost(building, 'own'),
        dailyRevenue: this.calculateDailyExportValue(building, 'own'),
        dailyProfit: this.calculateDailyProfit(building, 'own', 'own'),
        profitPerWorker: this.calculateProfitPerWorker(building, 'own', 'own')
      }
    };
  }

  /**
   * Get construction cost comparison
   */
  getConstructionCostComparison(building: IndustryBuilding): {
    ussr: number;
    nato: number;
    own: number;
  } {
    return {
      ussr: this.calculateConstructionCost(building, 'importUSSR'),
      nato: this.calculateConstructionCost(building, 'importNATO'),
      own: this.calculateConstructionCost(building, 'own')
    };
  }

  /**
   * Calculate worker efficiency metrics
   */
  calculateWorkerEfficiency(building: IndustryBuilding): {
    maxWorkers: number;
    productionPerWorker: number;
    revenuePerWorker: number;
    efficiencyRating: 'Low' | 'Medium' | 'High' | 'Excellent';
  } {
    const maxWorkers = building.maxWorkers || 1;
    const totalProduction = building.production.maxPerDay;
    const productionPerWorker = totalProduction / maxWorkers;

    const analysis = this.getComparativeAnalysis(building);
    const avgRevenue = (analysis.ussr.dailyRevenue + analysis.nato.dailyRevenue) / 2;
    const revenuePerWorker = avgRevenue / maxWorkers;

    let efficiencyRating: 'Low' | 'Medium' | 'High' | 'Excellent' = 'Low';
    if (revenuePerWorker > 1000) efficiencyRating = 'Excellent';
    else if (revenuePerWorker > 500) efficiencyRating = 'High';
    else if (revenuePerWorker > 200) efficiencyRating = 'Medium';

    return {
      maxWorkers,
      productionPerWorker,
      revenuePerWorker,
      efficiencyRating
    };
  }

  /**
   * Get building summary for table display
   */
  getBuildingSummary(building: IndustryBuilding): {
    name: string;
    maxWorkers: number;
    constructionCostUSSR: number;
    constructionCostNATO: number;
    constructionCostOwn: number;
    dailyCostUSSR: number;
    dailyCostNATO: number;
    dailyCostOwn: number;
    dailyRevenueUSSR: number;
    dailyRevenueNATO: number;
    dailyRevenueOwn: number;
    dailyProfitUSSR: number;
    dailyProfitNATO: number;
    dailyProfitOwn: number;
    profitPerWorkerUSSR: number;
    profitPerWorkerNATO: number;
    profitPerWorkerOwn: number;
  } {
    const analysis = this.getComparativeAnalysis(building);
    const constructionCosts = this.getConstructionCostComparison(building);

    return {
      name: building.name,
      maxWorkers: building.maxWorkers || 0,
      constructionCostUSSR: constructionCosts.ussr,
      constructionCostNATO: constructionCosts.nato,
      constructionCostOwn: constructionCosts.own,
      dailyCostUSSR: analysis.ussr.dailyCost,
      dailyCostNATO: analysis.nato.dailyCost,
      dailyCostOwn: analysis.own.dailyCost,
      dailyRevenueUSSR: analysis.ussr.dailyRevenue,
      dailyRevenueNATO: analysis.nato.dailyRevenue,
      dailyRevenueOwn: analysis.own.dailyRevenue,
      dailyProfitUSSR: analysis.ussr.dailyProfit,
      dailyProfitNATO: analysis.nato.dailyProfit,
      dailyProfitOwn: analysis.own.dailyProfit,
      profitPerWorkerUSSR: analysis.ussr.profitPerWorker,
      profitPerWorkerNATO: analysis.nato.profitPerWorker,
      profitPerWorkerOwn: analysis.own.profitPerWorker
    };
  }
}