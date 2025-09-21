// API Data Contracts matching the GameDataOCR.API

export interface PriceItem {
  resource: string;
  ussrBuy: number;
  ussrSell: number;
  natoBuy: number;
  natoSell: number;
}

export interface PriceData {
  items: PriceItem[];
}

export interface IndustrySection {
  sectionName: string;
  items: string[];
}

export interface IndustryData {
  name: string;
  sections: IndustrySection[];
}

export interface OcrResult {
  success: boolean;
  errorMessage?: string;
  industryData?: IndustryData;
  priceData?: PriceData;
}

export enum ImageType {
  Industry = 'industry',
  Prices = 'prices'
}

export enum OcrProvider {
  Azure = 'azure',
  Google = 'google'
}

// Enhanced Industry Models from Original App
export type ImportSource = 'own' | 'importNATO' | 'importUSSR';
export type ExportTarget = 'own' | 'exportNATO' | 'exportUSSR';

export interface ResourceRequirement {
  name: string;
  quantity: number;
  importSource: ImportSource;
}

export interface ResourceProduction {
  name: string;
  quantity: number;
  value?: number; // Will be calculated based on prices
  exportTarget: ExportTarget;
}

export interface IndustryBuilding {
  name: string;
  maxWorkers?: number; // Maximum number of workers for the building
  constructionCost: {
    materials: ResourceRequirement[];
    totalCost: number; // Will be calculated
  };
  production: {
    maxPerDay: number;
    maxPerBuilding: number;
    outputs: ResourceProduction[];
  };
  consumption: {
    inputs: ResourceRequirement[];
  };
  profitability: {
    dailyCost: number;
    dailyRevenue: number;
    dailyProfit: number;
    yearlyProfit: number;
    monthlyProfit: number;
    profitPerWorkerDay: number;
  };
  metadata: {
    pollution?: {
      level: number; // Pollution level generated
      type?: string; // Type of pollution if specified
    };
    [key: string]: any; // Allow for future metadata expansion
  };
  originalParsedValues?: IndustryBuilding; // Store original parsed values for reset functionality
}

export interface IndustryDataset {
  id: string;
  filename: string;
  extractedText?: string;
  timestamp: string;
  userDefinedName: string; // User-provided name as primary key
  buildings: IndustryBuilding[];
  totalBuildings: number;
}