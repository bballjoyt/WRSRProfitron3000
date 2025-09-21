import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { PriceItem } from '../models/api-models';
import { GameDataApiService } from '../services/game-data-api.service';

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


@Component({
  selector: 'app-prices-manager',
  imports: [CommonModule, FormsModule, TableModule, InputTextModule, ButtonModule, IconFieldModule, InputIconModule],
  templateUrl: './prices-manager.html',
  styleUrl: './prices-manager.css'
})
export class PricesManager implements OnInit {
  resources: ResourcePrice[] = [];
  editingResource: ResourcePrice | null = null;
  originalResourceName: string = '';

  // Workdays pricing
  workdaysUSSRCost: number = 0;
  workdaysNATOCost: number = 0;

  // Search functionality for PrimeNG table
  globalFilterValue: string = '';

  constructor(private gameDataApi: GameDataApiService) {}

  ngOnInit(): void {
    this.loadData();
    this.loadWorkdaysPricing(); // Load workday pricing from API
  }

  loadData(): void {
    // Load resources from API only
    this.gameDataApi.getAllResources().subscribe({
      next: (apiResources) => {
        // Convert API resources to ResourcePrice format
        this.resources = apiResources.map(resource => ({
          name: resource.name,
          prices: {
            natoSell: resource.natoSell,
            natoBuy: resource.natoBuy,
            ussrSell: resource.ussrSell,
            ussrBuy: resource.ussrBuy
          },
          lastUpdated: resource.lastUpdated
        })).sort((a, b) => a.name.localeCompare(b.name));
      },
      error: (error) => {
        console.error('Error loading resources from API:', error);
        this.resources = [];
      }
    });
  }

  saveData(): void {
    // No longer needed since all data is stored via API
  }

  editResource(resource: ResourcePrice): void {
    this.editingResource = { ...resource };
    this.originalResourceName = resource.name;
  }

  saveResource(): void {
    if (!this.editingResource || !this.originalResourceName) return;

    // Note: Since there's no update endpoint in the API, editing is currently not fully supported
    // This would require adding an update endpoint to the API
    console.warn('Resource editing requires an update endpoint in the API');
    alert('Resource editing is not currently supported. The API needs an update endpoint.');

    this.editingResource = null;
    this.originalResourceName = '';
  }

  cancelEdit(): void {
    this.editingResource = null;
    this.originalResourceName = '';
  }

  deleteResource(resourceName: string): void {
    if (!confirm(`Are you sure you want to delete the resource "${resourceName}"? This action cannot be undone.`)) {
      return;
    }

    // Delete resource via API only
    this.gameDataApi.deleteResource(resourceName).subscribe({
      next: () => {
        console.log(`Resource "${resourceName}" deleted successfully`);
        this.loadData();
      },
      error: (error) => {
        console.error('Error deleting resource via API:', error);
        alert('Failed to delete resource. Please try again.');
      }
    });
  }


  getAverageNatoSell(): number {
    if (this.resources.length === 0) return 0;
    return this.resources.reduce((sum, r) => sum + r.prices.natoSell, 0) / this.resources.length;
  }

  getAverageUssrSell(): number {
    if (this.resources.length === 0) return 0;
    return this.resources.reduce((sum, r) => sum + r.prices.ussrSell, 0) / this.resources.length;
  }

  // Workdays pricing methods - Load workday pricing from API
  loadWorkdaysPricing(): void {
    this.gameDataApi.getWorkday().subscribe({
      next: (workday) => {
        this.workdaysUSSRCost = workday.ussrBuy;
        this.workdaysNATOCost = workday.natoBuy;
      },
      error: (error) => {
        console.error('Error loading workdays pricing:', error);
        this.workdaysUSSRCost = 0;
        this.workdaysNATOCost = 0;
      }
    });
  }

  saveWorkdaysPricing(): void {
    const request = {
      ussrBuy: this.workdaysUSSRCost,
      natoBuy: this.workdaysNATOCost
    };

    this.gameDataApi.updateWorkday(request).subscribe({
      next: (workday) => {
        console.log('Workdays pricing saved successfully');
      },
      error: (error) => {
        console.error('Error saving workdays pricing:', error);
        alert('Failed to save workdays pricing. Please try again.');
      }
    });
  }

  resetWorkdaysPricing(): void {
    this.gameDataApi.resetWorkday().subscribe({
      next: () => {
        this.workdaysUSSRCost = 0;
        this.workdaysNATOCost = 0;
        console.log('Workdays pricing reset successfully');
      },
      error: (error) => {
        console.error('Error resetting workdays pricing:', error);
        alert('Failed to reset workdays pricing. Please try again.');
      }
    });
  }

  clearAllResources(): void {
    if (!confirm('Are you sure you want to delete ALL resource prices? This action cannot be undone.')) {
      return;
    }

    this.gameDataApi.clearAllResources().subscribe({
      next: () => {
        console.log('All resources cleared successfully');
        this.loadData();
      },
      error: (error) => {
        console.error('Error clearing all resources:', error);
        alert('Failed to clear all resources. Please try again.');
      }
    });
  }

  // Search functionality for PrimeNG table
  clear(table: any) {
    table.clear();
    this.globalFilterValue = '';
  }

  onGlobalFilter(table: any, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }
}
