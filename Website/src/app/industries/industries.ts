import { Component, OnInit } from '@angular/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { RatingModule } from 'primeng/rating';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { TableRowCollapseEvent, TableRowExpandEvent } from 'primeng/table';
import { GameDataApiService, ApiIndustry, ApiResource, ApiWorkday } from '../services/game-data-api.service';

type Industry = ApiIndustry;

@Component({
    selector: 'app-industries',
    templateUrl: './industries.html',
    styleUrl: './industries.css',
    standalone: true,
    imports: [TableModule, TagModule, RatingModule, ButtonModule, CommonModule, FormsModule],
    providers: [MessageService]
})
export class Industries implements OnInit{
    industries: Industry[] = [];
    expandedRows = {};
    resources: ApiResource[] = [];
    workdayPricing: ApiWorkday | null = null;
    inputSourceSelections: { [industryName: string]: { [resourceName: string]: 'NATO' | 'USSR' | 'Own' } } = {};
    sourceOptions = [
        { label: 'NATO', value: 'NATO' },
        { label: 'USSR', value: 'USSR' },
        { label: 'Own Production', value: 'Own' }
    ];
    calculationCache: { [industryName: string]: any[] } = {};
    currentWorkers: { [industryName: string]: number } = {};
    workerProductivity: number = 100; // Default 100%
    percentOfWorkers: number = 100; // Default 100% of max workers
    constructionSourceSelections: { [industryName: string]: { [resourceName: string]: 'NATO' | 'USSR' | 'Own' } } = {};

    constructor(private messageService: MessageService, private gameDataService: GameDataApiService) {}

    ngOnInit() {
        this.loadIndustries();
        this.loadResources();
        this.loadWorkdayPricing();
    }

    // Add calculated properties to industry objects for sorting
    private enhanceIndustriesForSorting() {
        this.industries = this.industries.map(industry => ({
            ...industry,
            currentWorkers: this.getCurrentWorkers(industry.name),
            efficiency: this.getEfficiency(industry.name),
            ussrDailyCost: this.calculateDailyCost(industry, 'USSR'),
            ussrDailyProfit: this.calculateDailyProfit(industry, 'USSR'),
            ussrProfitPerWorker: this.calculateProfitPerWorker(industry, 'USSR'),
            natoDailyCost: this.calculateDailyCost(industry, 'NATO'),
            natoDailyProfit: this.calculateDailyProfit(industry, 'NATO'),
            natoProfitPerWorker: this.calculateProfitPerWorker(industry, 'NATO')
        }));
    }

    loadIndustries() {
        this.gameDataService.getAllIndustries()
            .subscribe({
                next: (data) => {
                    this.industries = data;
                    console.log('Loaded industries:', this.industries);
                    this.checkAndEnhanceData();
                },
                error: (error) => {
                    console.error('Error loading industries:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'Failed to load industries from database',
                        life: 5000
                    });
                }
            });
    }

    loadResources() {
        this.gameDataService.getAllResources()
            .subscribe({
                next: (data) => {
                    this.resources = data;
                    console.log('Loaded resources:', this.resources);
                    this.checkAndEnhanceData();
                },
                error: (error) => {
                    console.error('Error loading resources:', error);
                }
            });
    }

    loadWorkdayPricing() { // Load workday pricing from API
        this.gameDataService.getWorkday()
            .subscribe({
                next: (data) => {
                    this.workdayPricing = data;
                    console.log('Loaded workday pricing:', this.workdayPricing);
                    this.checkAndEnhanceData();
                },
                error: (error) => {
                    console.error('Error loading workday pricing:', error);
                    // Fallback to default pricing
                    this.workdayPricing = {
                        name: 'Workday',
                        natoBuy: 0,
                        ussrBuy: 0,
                        natoSell: 0,
                        ussrSell: 0,
                        lastUpdated: new Date().toISOString()
                    };
                }
            });
    }

    private checkAndEnhanceData() {
        // Only enhance data when both industries and resources are loaded
        if (this.industries && this.industries.length > 0 && this.resources && this.resources.length > 0) {
            this.enhanceIndustriesForSorting();
        }
    }

    expandAll() {
        this.expandedRows = this.industries.reduce((acc: any, industry) => (acc[industry.name] = true) && acc, {});
    }

    collapseAll() {
        this.expandedRows = {};
    }

    onRowExpand(event: TableRowExpandEvent) {
        // Row expansion - no notification needed
    }

    onRowCollapse(event: TableRowCollapseEvent) {
        // Row collapse - no notification needed
    }

    calculateDailyCost(industry: Industry, currency: 'USSR' | 'NATO'): number {
        // Use currency-specific pricing for main table display
        return this.calculateDailyCostForCurrency(industry, currency);
    }

    calculateDailyProfit(industry: Industry, currency: 'USSR' | 'NATO'): number {
        // Use currency-specific pricing for main table display
        return this.calculateDailyProfitForCurrency(industry, currency);
    }

    private parseResourceFromText(text: string): { name: string; quantity: number } | null {
        // Parse patterns like "1.2t of Clothes", "2.4t of Fabric", "3.6 MWh", "1.60 m3/day"
        const patterns = [
            /(\d+\.?\d*)\s*t\s+of\s+(.+)/i,  // "1.2t of Clothes"
            /(\d+\.?\d*)\s*MWh/i,            // "3.6 MWh" -> Power
            /(\d+\.?\d*)\s*m3/i,             // "1.60 m3" -> Water
            /(\d+\.?\d*)\s*(.+)/i            // Generic fallback
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const quantity = parseFloat(match[1]);
                let name = match[2] || match[0];

                // Handle special cases
                if (text.includes('MWh')) {
                    name = 'Power';
                } else if (text.includes('m3')) {
                    name = 'Water';
                } else if (match[2]) {
                    name = match[2].trim();
                }

                return { name, quantity };
            }
        }

        return null;
    }

    // Helper method to find resources by name
    private findResourceByName(resourceName: string): ApiResource | undefined {
        // Handle workday resources specially
        if (resourceName.toLowerCase().includes('workday')) {
            if (this.workdayPricing) {
                // Convert workday pricing to a resource-like object
                return {
                    name: this.workdayPricing.name,
                    natoBuy: this.workdayPricing.natoBuy,
                    ussrBuy: this.workdayPricing.ussrBuy,
                    natoSell: this.workdayPricing.natoSell,
                    ussrSell: this.workdayPricing.ussrSell,
                    lastUpdated: this.workdayPricing.lastUpdated
                } as ApiResource;
            }
            return undefined;
        }

        return this.resources.find(r =>
            r.name.toLowerCase().includes(resourceName.toLowerCase()) ||
            resourceName.toLowerCase().includes(r.name.toLowerCase())
        );
    }

    // Helper method to find industry sections
    private findConsumptionSection(industry: Industry) {
        return industry.sections.find(s =>
            s.sectionName.toLowerCase().includes('consumption') &&
            s.sectionName.toLowerCase().includes('maximum')
        );
    }

    private findProductionSection(industry: Industry) {
        return industry.sections.find(s =>
            s.sectionName.toLowerCase().includes('maximum production')
        );
    }

    private findConstructionSection(industry: Industry) {
        return industry.sections.find(s =>
            s.sectionName.toLowerCase().includes('resources needed to build') ||
            s.sectionName.toLowerCase().includes('construction') ||
            s.sectionName.toLowerCase().includes('build')
        );
    }

    // Helper method to parse resources from a section
    private parseResourcesFromSection(section: any): { name: string; quantity: number; resource?: ApiResource }[] {
        if (!section) return [];

        const items: { name: string; quantity: number; resource?: ApiResource }[] = [];

        for (const item of section.items) {
            const parsed = this.parseResourceFromText(item);
            if (parsed) {
                const resource = this.findResourceByName(parsed.name);
                items.push({
                    name: parsed.name,
                    quantity: parsed.quantity,
                    resource: resource
                });
            }
        }

        return items;
    }

    // Helper method for cache management
    private clearCacheForIndustry(industryName: string, clearSourceDependent = true) {
        delete this.calculationCache[industryName];
        if (clearSourceDependent) {
            delete this.calculationCache[`construction_${industryName}`];
        }
        // Time profit and ROI now use currency-specific calculations, so no need to clear them
    }

    private clearAllCaches() {
        this.calculationCache = {};
    }

    // Helper method for input validation
    private validateAndClampValue(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }


    getCalculationBreakdown(industry: Industry) {
        // Check cache first
        if (this.calculationCache[industry.name]) {
            return this.calculationCache[industry.name];
        }

        const breakdown: any[] = [];

        // Add cost breakdown (input resources)
        const consumptionSection = this.findConsumptionSection(industry);
        const costItems = this.parseResourcesFromSection(consumptionSection);
        let costUssrTotal = 0;
        let costNatoTotal = 0;

        const efficiency = this.getEfficiency(industry.name);

        costItems.forEach(item => {
            const inputSource = this.getInputSource(industry.name, item.name);
            const resource = item.resource;
            const adjustedQuantity = item.quantity * efficiency;
            let ussrCost = 0;
            let natoCost = 0;

            if (resource) {
                const costs = this.getInputCost(resource, inputSource, adjustedQuantity);
                ussrCost = costs.ussrTotal;
                natoCost = costs.natoTotal;
            }

            breakdown.push({
                type: 'COST (Input)',
                name: item.name,
                quantity: adjustedQuantity,
                ussrPrice: resource?.ussrBuy || 0,
                ussrTotal: ussrCost,
                natoPrice: resource?.natoBuy || 0,
                natoTotal: natoCost,
                backgroundColor: '#ffebee',  // Light red
                inputSource: inputSource,
                industryName: industry.name,
                resourceName: item.name
            });
            costUssrTotal += ussrCost;
            costNatoTotal += natoCost;
        });

        // Add cost total row
        if (costItems.length > 0) {
            breakdown.push({
                type: 'COST TOTAL',
                name: 'Total Daily Cost',
                quantity: '-',
                ussrPrice: '-',
                ussrTotal: costUssrTotal,
                natoPrice: '-',
                natoTotal: costNatoTotal,
                backgroundColor: '#ffcdd2'  // Darker red
            });
        }

        // Add product breakdown (output resources)
        const productionSection = this.findProductionSection(industry);
        const productItems = this.parseResourcesFromSection(productionSection);
        let revenueUssrTotal = 0;
        let revenueNatoTotal = 0;

        if (productItems.length > 0) {
            const firstProduct = productItems[0]; // Only show the first (main) product
            const adjustedQuantity = firstProduct.quantity * efficiency;
            const resource = firstProduct.resource;
            const adjustedUssrTotal = resource ? adjustedQuantity * resource.ussrSell : 0;
            const adjustedNatoTotal = resource ? adjustedQuantity * resource.natoSell : 0;

            breakdown.push({
                type: 'REVENUE',
                name: firstProduct.name,
                quantity: adjustedQuantity,
                ussrPrice: resource?.ussrSell || 0,
                ussrTotal: adjustedUssrTotal,
                natoPrice: resource?.natoSell || 0,
                natoTotal: adjustedNatoTotal,
                backgroundColor: '#e3f2fd'  // Light blue
            });
            revenueUssrTotal = adjustedUssrTotal;
            revenueNatoTotal = adjustedNatoTotal;
        }

        // Add final profit summary (using source-aware calculations for expansion breakdown)
        const ussrProfitWithSources = this.calculateDailyProfitWithSources(industry, 'USSR');
        const natoProfitWithSources = this.calculateDailyProfitWithSources(industry, 'NATO');

        breakdown.push({
            type: 'FINAL PROFIT',
            name: 'Daily Profit (with selected sources)',
            quantity: '-',
            ussrPrice: '-',
            ussrTotal: ussrProfitWithSources,
            natoPrice: '-',
            natoTotal: natoProfitWithSources,
            backgroundColor: '#e8f5e8'  // Light green
        });

        // Cache the result
        this.calculationCache[industry.name] = breakdown;
        return breakdown;
    }

    getMaxWorkers(industry: Industry): number {
        const workersSection = industry.sections.find(s =>
            s.sectionName.toLowerCase().includes('maximum number of workers') ||
            s.sectionName.toLowerCase().includes('max') && s.sectionName.toLowerCase().includes('workers')
        );

        if (!workersSection || !workersSection.items || workersSection.items.length === 0) {
            return 0;
        }

        // Parse the first item to extract the number - this is the TRUE max workers
        const workersText = workersSection.items[0];
        const match = workersText.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }


    getCurrentWorkers(industryName: string): number {
        if (!this.currentWorkers[industryName]) {
            // Default to percent of max workers
            const industry = this.industries.find(i => i.name === industryName);
            if (industry) {
                const maxWorkers = this.getMaxWorkers(industry);
                this.currentWorkers[industryName] = Math.round(maxWorkers * (this.percentOfWorkers / 100));
            } else {
                this.currentWorkers[industryName] = 1;
            }
        }
        return this.currentWorkers[industryName];
    }

    setCurrentWorkers(industryName: string, workers: number) {
        const industry = this.industries.find(i => i.name === industryName);
        if (!industry) return;

        const maxWorkers = this.getMaxWorkers(industry);

        // Validate and clamp the value
        workers = this.validateAndClampValue(workers, 1, maxWorkers);

        this.currentWorkers[industryName] = workers;

        // Clear caches to force recalculation (construction doesn't change with worker count)
        this.clearCacheForIndustry(industryName, false);

        // Update sortable values
        this.enhanceIndustriesForSorting();
    }

    onWorkerBlur(industryName: string, event: any) {
        const value = parseInt(event.target.value);
        if (!isNaN(value)) {
            this.setCurrentWorkers(industryName, value);
        }
    }

    getEfficiency(industryName: string): number {
        const industry = this.industries.find(i => i.name === industryName);
        if (!industry) return 0;

        const maxWorkers = this.getMaxWorkers(industry);
        const currentWorkers = this.getCurrentWorkers(industryName);

        if (maxWorkers === 0) return 0;

        // Calculate base efficiency from worker ratio
        const baseEfficiency = currentWorkers / maxWorkers;

        // Apply productivity multiplier (convert percentage to decimal)
        const productivityMultiplier = this.workerProductivity / 100;
        const totalEfficiency = baseEfficiency * productivityMultiplier;


        // Cap efficiency at 100% (1.0)
        return Math.min(totalEfficiency, 1.0);
    }

    onProductivityChange() {
        // Validate and clamp productivity value
        this.workerProductivity = this.validateAndClampValue(this.workerProductivity, 30, 125);

        // Clear all calculation caches to force recalculation
        this.clearAllCaches();

        // Update sortable values
        this.enhanceIndustriesForSorting();
    }

    onPercentOfWorkersChange() {
        // Validate and clamp percent of workers value
        this.percentOfWorkers = this.validateAndClampValue(this.percentOfWorkers, 0, 100);

        // Clear all calculation caches to force recalculation
        this.clearAllCaches();

        // Update current workers to percent of max workers for all industries
        this.industries.forEach(industry => {
            const maxWorkers = this.getMaxWorkers(industry);
            this.currentWorkers[industry.name] = Math.round(maxWorkers * (this.percentOfWorkers / 100));
        });

        // Update sortable values
        this.enhanceIndustriesForSorting();
    }

    getInputSource(industryName: string, resourceName: string): 'NATO' | 'USSR' | 'Own' {
        if (!this.inputSourceSelections[industryName]) {
            this.inputSourceSelections[industryName] = {};
        }
        if (!this.inputSourceSelections[industryName][resourceName]) {
            this.inputSourceSelections[industryName][resourceName] = 'USSR'; // Default to USSR
        }
        return this.inputSourceSelections[industryName][resourceName];
    }

    setInputSource(industryName: string, resourceName: string, source: 'NATO' | 'USSR' | 'Own') {
        if (!this.inputSourceSelections[industryName]) {
            this.inputSourceSelections[industryName] = {};
        }
        this.inputSourceSelections[industryName][resourceName] = source;

        // Clear source-dependent caches to force recalculation
        this.clearCacheForIndustry(industryName);

        // Time profit and ROI now use currency-specific calculations, so they don't change with source selections
        // Main table values don't change with source selections anymore (they use currency-specific pricing)
        // Only the expansion breakdown is affected by source changes
    }

    getInputCost(resource: ApiResource, source: 'NATO' | 'USSR' | 'Own', quantity: number): { natoTotal: number, ussrTotal: number } {
        if (source === 'Own') {
            return { natoTotal: 0, ussrTotal: 0 };
        } else if (source === 'NATO') {
            return { natoTotal: quantity * resource.natoBuy, ussrTotal: 0 };
        } else { // USSR
            return { natoTotal: 0, ussrTotal: quantity * resource.ussrBuy };
        }
    }

    calculateProfitPerWorker(industry: Industry, currency: 'USSR' | 'NATO'): number {
        const dailyProfit = this.calculateDailyProfitForCurrency(industry, currency);
        const currentWorkers = this.getCurrentWorkers(industry.name);
        return currentWorkers > 0 ? dailyProfit / currentWorkers : 0;
    }

    // Calculate profit using only the specified currency's prices, ignoring source selections
    private calculateDailyProfitForCurrency(industry: Industry, currency: 'USSR' | 'NATO'): number {
        if (!this.resources || this.resources.length === 0) {
            return 0;
        }

        const revenue = this.calculateDailyRevenueForCurrency(industry, currency);
        const cost = this.calculateDailyCostForCurrency(industry, currency);
        return revenue - cost;
    }

    private calculateDailyRevenueForCurrency(industry: Industry, currency: 'USSR' | 'NATO'): number {
        const productionSection = industry.sections.find(s =>
            s.sectionName.toLowerCase().includes('maximum production')
        );

        if (!productionSection) {
            return 0;
        }

        let totalRevenue = 0;

        for (const item of productionSection.items) {
            const parsed = this.parseResourceFromText(item);
            if (parsed) {
                const resource = this.resources.find(r =>
                    r.name.toLowerCase().includes(parsed.name.toLowerCase()) ||
                    parsed.name.toLowerCase().includes(r.name.toLowerCase())
                );

                if (resource) {
                    const efficiency = this.getEfficiency(industry.name);
                    const adjustedQuantity = parsed.quantity * efficiency;
                    const price = currency === 'USSR' ? resource.ussrSell : resource.natoSell;
                    totalRevenue += adjustedQuantity * price;
                }
            }
        }

        return totalRevenue;
    }

    private calculateDailyCostForCurrency(industry: Industry, currency: 'USSR' | 'NATO'): number {
        const consumptionSection = industry.sections.find(s =>
            s.sectionName.toLowerCase().includes('consumption') &&
            s.sectionName.toLowerCase().includes('maximum')
        );

        if (!consumptionSection) {
            return 0;
        }

        let totalCost = 0;

        for (const item of consumptionSection.items) {
            const parsed = this.parseResourceFromText(item);
            if (parsed) {
                const resource = this.resources.find(r =>
                    r.name.toLowerCase().includes(parsed.name.toLowerCase()) ||
                    parsed.name.toLowerCase().includes(r.name.toLowerCase())
                );

                if (resource) {
                    const efficiency = this.getEfficiency(industry.name);
                    const adjustedQuantity = parsed.quantity * efficiency;
                    const price = currency === 'USSR' ? resource.ussrBuy : resource.natoBuy;
                    totalCost += adjustedQuantity * price;
                }
            }
        }

        return totalCost;
    }

    // Methods for expansion breakdown that respect source selections
    private calculateDailyCostWithSources(industry: Industry, currency: 'USSR' | 'NATO'): number {
        if (!this.resources || this.resources.length === 0) {
            return 0;
        }

        const consumptionSection = industry.sections.find(s =>
            s.sectionName.toLowerCase().includes('consumption') &&
            s.sectionName.toLowerCase().includes('maximum')
        );

        if (!consumptionSection) {
            return 0;
        }

        let totalCost = 0;

        for (const item of consumptionSection.items) {
            const parsed = this.parseResourceFromText(item);
            if (parsed) {
                const resource = this.resources.find(r =>
                    r.name.toLowerCase().includes(parsed.name.toLowerCase()) ||
                    parsed.name.toLowerCase().includes(r.name.toLowerCase())
                );

                if (resource) {
                    const inputSource = this.getInputSource(industry.name, parsed.name);
                    const efficiency = this.getEfficiency(industry.name);
                    const adjustedQuantity = parsed.quantity * efficiency;
                    const costs = this.getInputCost(resource, inputSource, adjustedQuantity);

                    if (currency === 'USSR') {
                        totalCost += costs.ussrTotal;
                    } else {
                        totalCost += costs.natoTotal;
                    }
                }
            }
        }

        return totalCost;
    }

    private calculateDailyProfitWithSources(industry: Industry, currency: 'USSR' | 'NATO'): number {
        const revenue = this.calculateDailyRevenueForCurrency(industry, currency); // Revenue is always currency-specific
        const cost = this.calculateDailyCostWithSources(industry, currency);
        return revenue - cost;
    }

    getConstructionBreakdown(industry: Industry) {
        // Check cache first
        const cacheKey = `construction_${industry.name}`;
        if (this.calculationCache[cacheKey]) {
            return this.calculationCache[cacheKey];
        }

        const breakdown: any[] = [];

        const constructionSection = industry.sections.find(s =>
            s.sectionName.toLowerCase().includes('resources needed to build') ||
            s.sectionName.toLowerCase().includes('construction') ||
            s.sectionName.toLowerCase().includes('build')
        );

        if (!constructionSection) {
            return breakdown;
        }

        let totalUssrCost = 0;
        let totalNatoCost = 0;

        for (const item of constructionSection.items) {
            const parsed = this.parseResourceFromText(item);
            if (parsed) {
                const resource = this.resources.find(r =>
                    r.name.toLowerCase().includes(parsed.name.toLowerCase()) ||
                    parsed.name.toLowerCase().includes(r.name.toLowerCase())
                );

                const inputSource = this.getConstructionSource(industry.name, parsed.name);
                let ussrCost = 0;
                let natoCost = 0;

                if (resource) {
                    const costs = this.getInputCost(resource, inputSource, parsed.quantity);
                    ussrCost = costs.ussrTotal;
                    natoCost = costs.natoTotal;
                }

                breakdown.push({
                    type: 'CONSTRUCTION',
                    name: parsed.name,
                    quantity: parsed.quantity,
                    ussrPrice: resource?.ussrBuy || 0,
                    ussrTotal: ussrCost,
                    natoPrice: resource?.natoBuy || 0,
                    natoTotal: natoCost,
                    backgroundColor: '#fff3e0',  // Light orange
                    inputSource: inputSource,
                    resourceName: parsed.name
                });

                totalUssrCost += ussrCost;
                totalNatoCost += natoCost;
            }
        }

        // Add total row
        if (breakdown.length > 0) {
            breakdown.push({
                type: 'TOTAL',
                name: 'Total Construction Cost',
                quantity: '-',
                ussrPrice: '-',
                ussrTotal: totalUssrCost,
                natoPrice: '-',
                natoTotal: totalNatoCost,
                backgroundColor: '#ff9800',  // Orange
                inputSource: '-',
                resourceName: '-'
            });
        }

        // Cache the result
        this.calculationCache[cacheKey] = breakdown;
        return breakdown;
    }

    getConstructionSource(industryName: string, resourceName: string): 'NATO' | 'USSR' | 'Own' {
        if (!this.constructionSourceSelections[industryName]) {
            this.constructionSourceSelections[industryName] = {};
        }
        if (!this.constructionSourceSelections[industryName][resourceName]) {
            this.constructionSourceSelections[industryName][resourceName] = 'USSR'; // Default to USSR
        }
        return this.constructionSourceSelections[industryName][resourceName];
    }

    setConstructionSource(industryName: string, resourceName: string, source: 'NATO' | 'USSR' | 'Own') {
        if (!this.constructionSourceSelections[industryName]) {
            this.constructionSourceSelections[industryName] = {};
        }
        this.constructionSourceSelections[industryName][resourceName] = source;

        // Clear only construction cache to force recalculation
        delete this.calculationCache[`construction_${industryName}`];

        // Note: Construction source changes don't affect daily operations, profit per worker, time profit, or ROI
        // (ROI now uses currency-specific construction costs)
    }

    getTimeProfitSummary(industry: Industry) {
        // Check cache first
        const cacheKey = `timeProfit_${industry.name}`;
        if (this.calculationCache[cacheKey]) {
            return this.calculationCache[cacheKey];
        }

        // Use currency-specific calculations (ignore user source selections)
        const ussrDailyProfit = this.calculateDailyProfitForCurrency(industry, 'USSR');
        const natoDailyProfit = this.calculateDailyProfitForCurrency(industry, 'NATO');

        // Calculate worker profit (currency-specific)
        const currentWorkers = this.getCurrentWorkers(industry.name);
        const ussrDailyWorkerProfit = currentWorkers > 0 ? ussrDailyProfit / currentWorkers : 0;
        const natoDailyWorkerProfit = currentWorkers > 0 ? natoDailyProfit / currentWorkers : 0;

        const result = [
            {
                period: 'Daily Profit',
                ussrProfit: ussrDailyProfit,
                natoProfit: natoDailyProfit,
                ussrWorkerProfit: ussrDailyWorkerProfit,
                natoWorkerProfit: natoDailyWorkerProfit
            },
            {
                period: 'Monthly Profit (30 days)',
                ussrProfit: ussrDailyProfit * 30,
                natoProfit: natoDailyProfit * 30,
                ussrWorkerProfit: ussrDailyWorkerProfit * 30,
                natoWorkerProfit: natoDailyWorkerProfit * 30
            },
            {
                period: 'Yearly Profit (365 days)',
                ussrProfit: ussrDailyProfit * 365,
                natoProfit: natoDailyProfit * 365,
                ussrWorkerProfit: ussrDailyWorkerProfit * 365,
                natoWorkerProfit: natoDailyWorkerProfit * 365
            }
        ];

        // Cache the result
        this.calculationCache[cacheKey] = result;
        return result;
    }

    private getConstructionCostForCurrency(industry: Industry, currency: 'USSR' | 'NATO'): number {
        const constructionSection = industry.sections.find(s =>
            s.sectionName.toLowerCase().includes('resources needed to build') ||
            s.sectionName.toLowerCase().includes('construction') ||
            s.sectionName.toLowerCase().includes('build')
        );

        if (!constructionSection) {
            return 0;
        }

        let totalCost = 0;

        for (const item of constructionSection.items) {
            const parsed = this.parseResourceFromText(item);
            if (parsed) {
                const resource = this.resources.find(r =>
                    r.name.toLowerCase().includes(parsed.name.toLowerCase()) ||
                    parsed.name.toLowerCase().includes(r.name.toLowerCase())
                );

                if (resource) {
                    const price = currency === 'USSR' ? resource.ussrBuy : resource.natoBuy;
                    totalCost += parsed.quantity * price;
                }
            }
        }

        return totalCost;
    }

    getROISummary(industry: Industry) {
        // Check cache first
        const cacheKey = `roi_${industry.name}`;
        if (this.calculationCache[cacheKey]) {
            return this.calculationCache[cacheKey];
        }

        // Get construction costs using currency-specific pricing (ignore user source selections)
        const ussrConstructionCost = this.getConstructionCostForCurrency(industry, 'USSR');
        const natoConstructionCost = this.getConstructionCostForCurrency(industry, 'NATO');

        // Get daily profits (currency-specific, ignore user source selections)
        const ussrDailyProfit = this.calculateDailyProfitForCurrency(industry, 'USSR');
        const natoDailyProfit = this.calculateDailyProfitForCurrency(industry, 'NATO');

        // Calculate payback periods (in days)
        const ussrPaybackDays = ussrDailyProfit > 0 ? ussrConstructionCost / ussrDailyProfit : -1;
        const natoPaybackDays = natoDailyProfit > 0 ? natoConstructionCost / natoDailyProfit : -1;

        const result = [
            {
                metric: 'Construction Cost',
                ussrValue: ussrConstructionCost,
                natoValue: natoConstructionCost,
                unit: 'currency'
            },
            {
                metric: 'Daily Profit',
                ussrValue: ussrDailyProfit,
                natoValue: natoDailyProfit,
                unit: 'currency'
            },
            {
                metric: 'Payback Period',
                ussrValue: ussrPaybackDays,
                natoValue: natoPaybackDays,
                unit: 'days'
            },
            {
                metric: 'ROI (Annual %)',
                ussrValue: ussrDailyProfit > 0 ? ((ussrDailyProfit * 365) / ussrConstructionCost) * 100 : 0,
                natoValue: natoDailyProfit > 0 ? ((natoDailyProfit * 365) / natoConstructionCost) * 100 : 0,
                unit: 'percentage'
            }
        ];

        // Cache the result
        this.calculationCache[cacheKey] = result;
        return result;
    }
}