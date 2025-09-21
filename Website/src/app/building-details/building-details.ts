import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IndustryBuilding, IndustryDataset, ImportSource, ExportTarget } from '../models/api-models';
import { IndustryParserService } from '../services/industry-parser.service';
import { IndustryCalculatorService } from '../services/industry-calculator.service';

@Component({
  selector: 'app-building-details',
  imports: [CommonModule],
  templateUrl: './building-details.html',
  styleUrl: './building-details.css'
})
export class BuildingDetails implements OnInit {
  building: IndustryBuilding | null = null;
  datasets: IndustryDataset[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private industryParser: IndustryParserService,
    private calculator: IndustryCalculatorService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const buildingName = decodeURIComponent(params['name']);
      this.loadBuilding(buildingName);
    });
  }

  private loadBuilding(name: string): void {
    // Load datasets from localStorage
    const stored = localStorage.getItem('industryDatasets');
    if (stored) {
      this.datasets = JSON.parse(stored);

      // Find the building across all datasets
      for (const dataset of this.datasets) {
        const foundBuilding = dataset.buildings.find(b => b.name === name);
        if (foundBuilding) {
          this.building = foundBuilding;
          break;
        }
      }
    }

    if (!this.building) {
      // Building not found, redirect back to industry manager
      this.router.navigate(['/industry-manager']);
    }
  }

  goBack(): void {
    this.router.navigate(['/industry-manager']);
  }

  // Calculation methods using the calculator service
  getConstructionCostUSSR(): number {
    if (!this.building) return 0;
    return this.calculator.calculateConstructionCost(this.building, 'importUSSR');
  }

  getConstructionCostNATO(): number {
    if (!this.building) return 0;
    return this.calculator.calculateConstructionCost(this.building, 'importNATO');
  }

  getDailyImportCostUSSR(): number {
    if (!this.building) return 0;
    return this.calculator.calculateDailyImportCost(this.building, 'importUSSR');
  }

  getDailyImportCostNATO(): number {
    if (!this.building) return 0;
    return this.calculator.calculateDailyImportCost(this.building, 'importNATO');
  }

  getDailyExportValueUSSR(): number {
    if (!this.building) return 0;
    return this.calculator.calculateDailyExportValue(this.building, 'exportUSSR');
  }

  getDailyExportValueNATO(): number {
    if (!this.building) return 0;
    return this.calculator.calculateDailyExportValue(this.building, 'exportNATO');
  }

  getDailyProfitUSSR(): number {
    if (!this.building) return 0;
    return this.calculator.calculateDailyProfit(this.building, 'importUSSR', 'exportUSSR');
  }

  getDailyProfitNATO(): number {
    if (!this.building) return 0;
    return this.calculator.calculateDailyProfit(this.building, 'importNATO', 'exportNATO');
  }

  getProfitPerWorkerUSSR(): number {
    if (!this.building) return 0;
    return this.calculator.calculateProfitPerWorker(this.building, 'importUSSR', 'exportUSSR');
  }

  getProfitPerWorkerNATO(): number {
    if (!this.building) return 0;
    return this.calculator.calculateProfitPerWorker(this.building, 'importNATO', 'exportNATO');
  }
}