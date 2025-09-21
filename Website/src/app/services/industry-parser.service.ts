import { Injectable } from '@angular/core';
import { IndustryData, IndustrySection, IndustryBuilding, ResourceRequirement, ResourceProduction, ImportSource, ExportTarget } from '../models/api-models';

@Injectable({
  providedIn: 'root'
})
export class IndustryParserService {

  // Resource name mapping for OCR variations to standardized names
  private resourceNameMap: { [key: string]: string } = {
    'mechanical comp.': 'mechanical components',
    'Mechanical comp.': 'mechanical components',
    'mechanical comp': 'mechanical components',
    'Mechanical comp': 'mechanical components',
    'Mechanical Comp': 'mechanical components',
    'mechanic comp.': 'mechanical components',
    'Mechanic comp.': 'mechanical components',
    'mechanical components': 'mechanical components',
    'Mechanical Components': 'mechanical components',
    'nuclear fuel': 'nuclear fuel',
    'Nuclear fuel': 'nuclear fuel',
    'Nuclear Fuel': 'nuclear fuel',
    'fabric': 'fabric',
    'Fabric': 'fabric',
    'clothing': 'clothing',
    'Clothing': 'clothing',
    'shoes': 'shoes',
    'Shoes': 'shoes',
    'alcohol': 'alcohol',
    'Alcohol': 'alcohol',
    'electronics': 'electronics',
    'Electronics': 'electronics',
    'steel': 'steel',
    'Steel': 'steel',
    'concrete': 'concrete',
    'Concrete': 'concrete',
    'bricks': 'bricks',
    'Bricks': 'bricks',
    'gravel': 'gravel',
    'Gravel': 'gravel',
    'boards': 'boards',
    'Boards': 'boards',
    'coal': 'coal',
    'Coal': 'coal',
    'oil': 'oil',
    'Oil': 'oil',
    'iron': 'iron',
    'Iron': 'iron',
    'bauxite': 'bauxite',
    'Bauxite': 'bauxite',
    'uranium': 'uranium',
    'Uranium': 'uranium',
    'gold': 'gold',
    'Gold': 'gold',
    'food': 'food',
    'Food': 'food',
    'meat': 'meat',
    'Meat': 'meat',
    'crops': 'crops',
    'Crops': 'crops'
  };

  /**
   * Convert simple IndustryData from new API to complex IndustryBuilding format
   */
  convertToIndustryBuilding(industryData: IndustryData): IndustryBuilding {
    console.log('🏭 Converting industry data to building format:', industryData);

    // Initialize building structure
    const building: IndustryBuilding = {
      name: industryData.name || 'Unknown Building',
      maxWorkers: 0,
      constructionCost: {
        materials: [],
        totalCost: 0
      },
      production: {
        maxPerDay: 0,
        maxPerBuilding: 0,
        outputs: []
      },
      consumption: {
        inputs: []
      },
      profitability: {
        dailyCost: 0,
        dailyRevenue: 0,
        dailyProfit: 0,
        yearlyProfit: 0,
        monthlyProfit: 0,
        profitPerWorkerDay: 0
      },
      metadata: {}
    };

    // Process each section to extract structured data
    industryData.sections.forEach(section => {
      this.processSection(section, building);
    });

    // Finalize calculations
    this.finalizeBuilding(building);

    console.log('✅ Converted building:', building);
    return building;
  }

  private processSection(section: IndustrySection, building: IndustryBuilding): void {
    const sectionType = this.detectSectionType(section.sectionName);
    console.log(`🔍 Processing section: "${section.sectionName}" as type: ${sectionType}`);

    switch (sectionType) {
      case 'construction':
        section.items.forEach(item => this.parseConstructionMaterial(item, building));
        break;
      case 'workers':
        section.items.forEach(item => this.parseWorkerInfo(item, building));
        break;
      case 'production':
        section.items.forEach(item => this.parseProductionOutput(item, building));
        break;
      case 'consumption':
        section.items.forEach(item => this.parseConsumptionInput(item, building));
        break;
      case 'metadata':
        section.items.forEach(item => this.parseMetadata(item, building));
        break;
      default:
        // Try to parse as general data
        section.items.forEach(item => this.parseGeneralData(item, building));
        break;
    }
  }

  private detectSectionType(sectionName: string): string {
    const lowerName = sectionName.toLowerCase();

    if (lowerName.includes('resources needed to build') || lowerName.includes('construction cost')) {
      return 'construction';
    } else if (lowerName.includes('maximum production per workday') || lowerName.includes('production per workday')) {
      return 'production';
    } else if (lowerName.includes('consumption at maximum production')) {
      return 'consumption';
    } else if (lowerName.includes('maximum number of workers') || lowerName.includes('max number of workers')) {
      return 'workers';
    } else if (lowerName.includes('building lifespan') || lowerName.includes('machines lifespan') ||
               lowerName.includes('environment pollution') || lowerName.includes('max. power consumption') ||
               lowerName.includes('max. wattage') || lowerName.includes('required water quality') ||
               lowerName.includes('garbage') || lowerName.includes('stations for vehicle')) {
      return 'metadata';
    }
    return 'general';
  }

  private parseConstructionMaterial(item: string, building: IndustryBuilding): void {
    console.log(`🔨 Parsing construction material: "${item}"`);

    const patterns = [
      // Standard format: "17t of Gravel"
      /(\d+(?:,\d+)*(?:\.\d+)?)\s*([a-zA-Z]+)\s+of\s+([a-zA-Z\s&]+)/,
      // Simplified format: "17t Gravel"
      /(\d+(?:,\d+)*(?:\.\d+)?)\s*([a-zA-Z]*)\s+([a-zA-Z\s&]+)$/,
      // Direct quantity: "Concrete: 22"
      /([a-zA-Z\s&]+):\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*([a-zA-Z]*)/,
      // Just number followed by material name
      /(\d+(?:,\d+)*(?:\.\d+)?)\s+([a-zA-Z\s&]{3,})/,
      // Workdays special case
      /(\d+(?:,\d+)*(?:\.\d+)?)\s+(Workdays?)/i
    ];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = item.match(pattern);

      if (match) {
        let quantity: number;
        let materialName: string;

        if (pattern === patterns[2]) { // "Material: Quantity" format
          materialName = match[1].trim();
          quantity = this.parseNumber(match[2]);
        } else if (pattern === patterns[4]) { // Workdays pattern
          quantity = this.parseNumber(match[1]);
          materialName = match[2].trim();
        } else if (pattern === patterns[3]) { // Simple number + material pattern
          quantity = this.parseNumber(match[1]);
          materialName = match[2].trim();
        } else {
          quantity = this.parseNumber(match[1]);
          materialName = match[3] ? match[3].trim() : match[2].trim();
        }

        console.log(`  🔍 Extracted: "${materialName}" (${quantity})`);

        if (this.isConstructionMaterial(materialName) || materialName.length >= 3) {
          const material: ResourceRequirement = {
            name: this.normalizeResourceName(materialName),
            quantity: quantity,
            importSource: 'own'
          };
          building.constructionCost.materials.push(material);
          console.log(`  ✅ Added construction material:`, material);
          break;
        }
      }
    }
  }

  private parseProductionOutput(item: string, building: IndustryBuilding): void {
    console.log(`🏭 Parsing production output: "${item}"`);

    const patterns = [
      // Standard format: "6.0t of Alcohol"
      /(\d+(?:,\d+)*(?:\.\d+)?)\s*([a-zA-Z]+)\s+of\s+([a-zA-Z\s&]+)/,
      // Simplified: "6.0t Alcohol"
      /(\d+(?:,\d+)*(?:\.\d+)?)\s*([a-zA-Z]*)\s+([a-zA-Z\s&]+)$/,
      // Alternative format: "Alcohol: 6.0t"
      /([a-zA-Z\s&]+):\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*([a-zA-Z]*)/,
      // Units format: "6.0 Vehicles", "100 People"
      /(\d+(?:,\d+)*(?:\.\d+)?)\s+(Vehicles|People|Units|Passengers|Students|Patients)/i,
      // Simple number + resource: "6.0 Alcohol"
      /(\d+(?:,\d+)*(?:\.\d+)?)\s+([a-zA-Z\s&]{3,})/
    ];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = item.match(pattern);

      if (match) {
        let quantity: number;
        let resourceName: string;

        if (pattern === patterns[2]) { // "Resource: Quantity" format
          resourceName = match[1].trim();
          quantity = this.parseNumber(match[2]);
        } else if (pattern === patterns[3]) { // Special units format
          quantity = this.parseNumber(match[1]);
          resourceName = match[2];
        } else if (pattern === patterns[4]) { // Simple number + resource
          quantity = this.parseNumber(match[1]);
          resourceName = match[2].trim();
        } else {
          quantity = this.parseNumber(match[1]);
          resourceName = match[3] ? match[3].trim() : match[2].trim();
        }

        console.log(`  🔍 Extracted production: "${resourceName}" (${quantity})`);

        const output: ResourceProduction = {
          name: this.normalizeResourceName(resourceName),
          quantity: quantity,
          exportTarget: 'own'
        };

        building.production.outputs.push(output);
        building.production.maxPerDay += quantity;

        console.log(`  ✅ Added production output:`, output);
        break;
      }
    }
  }

  private parseConsumptionInput(item: string, building: IndustryBuilding): void {
    console.log(`⚡ Parsing consumption input: "${item}"`);

    const patterns = [
      // Standard format: "30t of Crops"
      /(\d+(?:,\d+)*(?:\.\d+)?)\s*([a-zA-Z]+)\s+of\s+([a-zA-Z\s&]+)/,
      // Simplified: "30t Crops"
      /(\d+(?:,\d+)*(?:\.\d+)?)\s*([a-zA-Z]*)\s+([a-zA-Z\s&]+)$/,
      // Power format: "10 MWh of Power" or "10 MWh"
      /(\d+(?:,\d+)*(?:\.\d+)?)\s+(MWh)(?:\s+of\s+Power)?/i,
      // Alternative format: "Crops: 30t"
      /([a-zA-Z\s&]+):\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*([a-zA-Z]*)/,
      // Water consumption: "2.00 m³/day"
      /(\d+(?:,\d+)*(?:\.\d+)?)\s+m³\/day/i,
      // Simple number + resource: "30 Crops"
      /(\d+(?:,\d+)*(?:\.\d+)?)\s+([a-zA-Z\s&]{3,})/
    ];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = item.match(pattern);

      if (match) {
        let quantity: number;
        let resourceName: string;

        if (pattern === patterns[2]) { // Power format
          quantity = this.parseNumber(match[1]);
          resourceName = 'Power';
        } else if (pattern === patterns[3]) { // "Resource: Quantity" format
          resourceName = match[1].trim();
          quantity = this.parseNumber(match[2]);
        } else if (pattern === patterns[4]) { // Water consumption
          quantity = this.parseNumber(match[1]);
          resourceName = 'Water';
        } else if (pattern === patterns[5]) { // Simple number + resource
          quantity = this.parseNumber(match[1]);
          resourceName = match[2].trim();
        } else {
          quantity = this.parseNumber(match[1]);
          resourceName = match[3] ? match[3].trim() : match[2].trim();
        }

        console.log(`  🔍 Extracted consumption: "${resourceName}" (${quantity})`);

        if (resourceName && resourceName.length >= 3) {
          const input: ResourceRequirement = {
            name: this.normalizeResourceName(resourceName),
            quantity: quantity,
            importSource: 'own'
          };
          building.consumption.inputs.push(input);
          console.log(`  ✅ Added consumption input:`, input);
        }
        break;
      }
    }
  }

  private parseWorkerInfo(item: string, building: IndustryBuilding): void {
    console.log(`👥 Parsing worker info: "${item}"`);

    const patterns = [
      /(\d+)\s*workers?/i,
      /^(\d+)$/  // Just a number on its own
    ];

    for (const pattern of patterns) {
      const match = item.match(pattern);
      if (match) {
        building.maxWorkers = this.parseNumber(match[1]);
        console.log(`  ✅ Set max workers: ${building.maxWorkers}`);
        break;
      }
    }
  }

  private parseMetadata(item: string, building: IndustryBuilding): void {
    const lowerItem = item.toLowerCase();

    // Power consumption
    if (lowerItem.includes('power consumption')) {
      const powerMatch = item.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s+MWh/i);
      if (powerMatch) {
        building.metadata['maxPowerConsumption'] = this.parseNumber(powerMatch[1]);
      }
    }

    // Pollution
    if (lowerItem.includes('pollution')) {
      const pollutionMatch = item.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s+tons?\/year/i);
      if (pollutionMatch) {
        building.metadata.pollution = {
          level: this.parseNumber(pollutionMatch[1]),
          type: 'tons/year'
        };
      }
    }

    // Building lifespan
    if (lowerItem.includes('building lifespan')) {
      const lifespanMatch = item.match(/(\d+(?:\.\d+)?)\s+years/i);
      if (lifespanMatch) {
        building.metadata['buildingLifespan'] = this.parseNumber(lifespanMatch[1]);
      }
    }

    // Machine lifespan
    if (lowerItem.includes('machine lifespan')) {
      const machineLifespanMatch = item.match(/([\d\.-]+)\s+years/i);
      if (machineLifespanMatch) {
        building.metadata['machineLifespan'] = machineLifespanMatch[1];
      }
    }

    // Workdays (construction time)
    const workdaysMatch = item.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s+Workdays/i);
    if (workdaysMatch) {
      building.metadata['workdays'] = this.parseNumber(workdaysMatch[1]);
    }

    // Water quality
    const waterQualityMatch = item.match(/Required water quality:\s*(\d+(?:\.\d+)?)%/i);
    if (waterQualityMatch) {
      building.metadata['requiredWaterQuality'] = this.parseNumber(waterQualityMatch[1]);
    }
  }

  private parseGeneralData(item: string, building: IndustryBuilding): void {
    const lowerItem = item.toLowerCase();

    // Try to categorize and parse as different types
    if (this.looksLikeConstructionMaterial(item)) {
      this.parseConstructionMaterial(item, building);
    } else if (this.looksLikeProductionOutput(item)) {
      this.parseProductionOutput(item, building);
    } else if (this.looksLikeConsumptionInput(item)) {
      this.parseConsumptionInput(item, building);
    } else if (lowerItem.includes('workers')) {
      this.parseWorkerInfo(item, building);
    } else if (lowerItem.includes('lifespan') || lowerItem.includes('pollution') ||
               lowerItem.includes('power') || lowerItem.includes('workdays')) {
      this.parseMetadata(item, building);
    }
  }

  private looksLikeConstructionMaterial(item: string): boolean {
    const constructionIndicators = ['gravel', 'steel', 'concrete', 'boards', 'bricks', 'asphalt', 'workdays'];
    const lowerItem = item.toLowerCase();
    return constructionIndicators.some(indicator => lowerItem.includes(indicator));
  }

  private looksLikeProductionOutput(item: string): boolean {
    const productionIndicators = ['alcohol', 'meat', 'bread', 'clothes', 'electronics', 'medicine', 'fuel'];
    const lowerItem = item.toLowerCase();
    return productionIndicators.some(indicator => lowerItem.includes(indicator));
  }

  private looksLikeConsumptionInput(item: string): boolean {
    const consumptionIndicators = ['crops', 'power', 'mwh', 'water quality', 'm³'];
    const lowerItem = item.toLowerCase();
    return consumptionIndicators.some(indicator => lowerItem.includes(indicator));
  }

  private isConstructionMaterial(name: string): boolean {
    const constructionMaterials = [
      'gravel', 'steel', 'boards', 'concrete', 'asphalt', 'bricks', 'water',
      'mechanical components', 'electronics', 'fabric', 'prefabs', 'glass',
      'iron', 'coal', 'uranium', 'bauxite', 'oil', 'planks', 'cement', 'workdays'
    ];
    return constructionMaterials.some(material =>
      name.toLowerCase().includes(material) || material.includes(name.toLowerCase())
    );
  }

  private normalizeResourceName(name: string): string {
    const cleanName = name.trim().toLowerCase().replace(/[^\w\s]/g, '');
    const mapped = this.resourceNameMap[cleanName];
    return mapped || name.trim();
  }

  private parseNumber(str: string): number {
    return parseFloat(str.replace(/,/g, ''));
  }

  private finalizeBuilding(building: IndustryBuilding): void {
    // Calculate construction cost total
    building.constructionCost.totalCost = building.constructionCost.materials.reduce(
      (total, material) => total + (material.quantity * this.getEstimatedMaterialCost(material.name)), 0
    );

    // Set max per building same as max per day if not set
    if (building.production.maxPerBuilding === 0) {
      building.production.maxPerBuilding = building.production.maxPerDay;
    }

    // Add missing default metadata
    if (!building.metadata.pollution) {
      building.metadata.pollution = { level: 0, type: 'none' };
    }
  }

  private getEstimatedMaterialCost(materialName: string): number {
    // Rough cost estimates for common materials
    const materialCosts: { [key: string]: number } = {
      'gravel': 50,
      'steel': 200,
      'boards': 100,
      'concrete': 75,
      'asphalt': 80,
      'bricks': 150,
      'water': 10,
      'mechanical components': 500,
      'electronics': 800,
      'fabric': 300,
      'workdays': 120 // Cost per workday
    };

    const normalizedName = materialName.toLowerCase();
    for (const [material, cost] of Object.entries(materialCosts)) {
      if (normalizedName.includes(material)) {
        return cost;
      }
    }
    return 100; // Default cost
  }
}