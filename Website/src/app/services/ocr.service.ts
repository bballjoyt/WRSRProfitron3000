import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OcrResult, ImageType, OcrProvider } from '../models/api-models';

@Injectable({
  providedIn: 'root'
})
export class OcrService {
  private readonly apiBaseUrl = 'http://localhost:55234';

  constructor(private http: HttpClient) {}

  processImage(file: File, imageType: ImageType, provider: OcrProvider): Observable<OcrResult> {
    const formData = new FormData();
    formData.append('file', file);

    // Build the endpoint based on provider and image type
    let endpoint: string;
    if (provider === OcrProvider.Azure) {
      endpoint = imageType === ImageType.Industry
        ? '/api/ocr/azure/process-industry'
        : '/api/ocr/azure/process-prices';
    } else {
      endpoint = imageType === ImageType.Industry
        ? '/api/ocr/google/process-industry'
        : '/api/ocr/google/process-prices';
    }

    return this.http.post<OcrResult>(`${this.apiBaseUrl}${endpoint}`, formData);
  }
}