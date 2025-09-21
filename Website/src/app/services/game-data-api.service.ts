import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IndustryData, PriceData } from '../models/api-models';

export interface ApiResource {
  name: string;
  natoSell: number;
  natoBuy: number;
  ussrSell: number;
  ussrBuy: number;
  lastUpdated: string;
}

export interface ApiIndustrySection {
  id: number;
  sectionName: string;
  items: string[];
  industryName: string;
}

export interface ApiIndustry {
  name: string;
  lastUpdated: string;
  sections: ApiIndustrySection[];
}

export interface ApiWorkday {
  name: string;
  natoBuy: number;
  ussrBuy: number;
  natoSell: number;
  ussrSell: number;
  lastUpdated: string;
}

export interface UpdateWorkdayRequest {
  natoBuy: number;
  ussrBuy: number;
}

@Injectable({
  providedIn: 'root'
})
export class GameDataApiService {
  private baseUrl = 'https://localhost:55233/api/GameData';

  constructor(private http: HttpClient) {}

  getAllIndustries(): Observable<ApiIndustry[]> {
    return this.http.get<ApiIndustry[]>(`${this.baseUrl}/industries`);
  }

  getIndustry(name: string): Observable<ApiIndustry> {
    return this.http.get<ApiIndustry>(`${this.baseUrl}/industries/${name}`);
  }

  getAllResources(): Observable<ApiResource[]> {
    return this.http.get<ApiResource[]>(`${this.baseUrl}/resources`);
  }

  getResource(name: string): Observable<ApiResource> {
    return this.http.get<ApiResource>(`${this.baseUrl}/resources/${name}`);
  }

  searchResources(searchTerm: string): Observable<ApiResource[]> {
    return this.http.get<ApiResource[]>(`${this.baseUrl}/resources/search/${searchTerm}`);
  }

  deleteIndustry(name: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/industries/${name}`);
  }

  deleteResource(name: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/resources/${name}`);
  }

  clearAllIndustries(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/industries`);
  }

  clearAllResources(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/resources`);
  }

  clearAllData(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/all`);
  }

  // Workday endpoints
  getWorkday(): Observable<ApiWorkday> {
    return this.http.get<ApiWorkday>(`${this.baseUrl}/workdays`);
  }

  updateWorkday(request: UpdateWorkdayRequest): Observable<ApiWorkday> {
    return this.http.put<ApiWorkday>(`${this.baseUrl}/workdays`, request);
  }

  getWorkdayBuyPrice(currency: 'NATO' | 'USSR'): Observable<{resource: string, currency: string, buyPrice: number}> {
    return this.http.get<{resource: string, currency: string, buyPrice: number}>(`${this.baseUrl}/workdays/buy/${currency}`);
  }

  resetWorkday(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/workdays`);
  }

  // Convert API industry data to the format expected by the frontend
  convertApiIndustryToIndustryData(apiIndustry: ApiIndustry): IndustryData {
    return {
      name: apiIndustry.name,
      sections: apiIndustry.sections.map(section => ({
        sectionName: section.sectionName,
        items: section.items
      }))
    };
  }

  // Convert API resources to price data format
  convertApiResourcesToPriceData(resources: ApiResource[]): PriceData {
    return {
      items: resources.map(resource => ({
        resource: resource.name,
        ussrBuy: resource.ussrBuy,
        ussrSell: resource.ussrSell,
        natoBuy: resource.natoBuy,
        natoSell: resource.natoSell
      }))
    };
  }
}