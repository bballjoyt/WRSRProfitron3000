import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OcrService } from '../services/ocr.service';
import { OcrResult, ImageType, OcrProvider, IndustryData, PriceData } from '../models/api-models';

@Component({
  selector: 'app-image-upload',
  imports: [CommonModule, FormsModule],
  templateUrl: './image-upload.html',
  styleUrl: './image-upload.css'
})
export class ImageUpload {
  selectedFiles: File[] = [];
  imagePreviews: string[] = [];
  selectedOcrProvider: OcrProvider = OcrProvider.Azure;
  selectedDataType: ImageType = ImageType.Industry;
  isProcessing = false;
  processingProgress = 0;
  totalFiles = 0;
  extractedDataResults: OcrResult[] = [];
  currentlyProcessing: string = '';

  constructor(private ocrService: OcrService) {}

  onFileSelect(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const newFiles = Array.from(target.files);

      // If we already have files, add to them; otherwise replace
      if (this.selectedFiles.length > 0) {
        this.selectedFiles = [...this.selectedFiles, ...newFiles];
      } else {
        this.selectedFiles = newFiles;
      }

      this.createImagePreviews();

      // Clear the input so the same file can be selected again
      target.value = '';
    }
  }

  onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (items) {
      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            pastedFiles.push(blob);
          }
        }
      }
      if (pastedFiles.length > 0) {
        this.selectedFiles = pastedFiles;
        this.createImagePreviews();
      }
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFiles = Array.from(files);
      this.createImagePreviews();
    }
  }

  private createImagePreviews(): void {
    this.imagePreviews = [];
    this.selectedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreviews.push(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    });
  }

  clearImages(): void {
    this.selectedFiles = [];
    this.imagePreviews = [];
    this.extractedDataResults = [];
    this.processingProgress = 0;
    this.totalFiles = 0;
    this.currentlyProcessing = '';
  }

  extractData(): void {
    if (!this.selectedFiles || this.selectedFiles.length === 0) return;

    this.isProcessing = true;
    this.extractedDataResults = [];
    this.processingProgress = 0;
    this.totalFiles = this.selectedFiles.length;

    this.processFilesSequentially(0);
  }

  private processFilesSequentially(index: number): void {
    if (index >= this.selectedFiles.length) {
      // All files processed
      this.isProcessing = false;
      this.currentlyProcessing = '';
      console.log(`Finished processing ${this.totalFiles} files`);
      return;
    }

    const file = this.selectedFiles[index];
    this.currentlyProcessing = file.name;

    this.ocrService.processImage(file, this.selectedDataType, this.selectedOcrProvider)
      .subscribe({
        next: (result) => {
          this.extractedDataResults.push(result);
          this.processingProgress = index + 1;

          if (!result.success) {
            console.error(`Error processing ${file.name}: ${result.errorMessage}`);
          } else {
            // Save data to appropriate manager
            this.saveDataToManager(result, file.name);
          }

          // Process next file
          this.processFilesSequentially(index + 1);
        },
        error: (error) => {
          console.error(`Error processing ${file.name}:`, error);
          this.processingProgress = index + 1;

          // Continue with next file even if one fails
          this.processFilesSequentially(index + 1);
        }
      });
  }

  private saveDataToManager(result: OcrResult, filename: string = 'Unknown Image'): void {

    if (this.selectedDataType === ImageType.Industry && result.industryData) {
      // Save to Industry Manager
      this.saveToIndustryManager(result.industryData, filename);
    } else if (this.selectedDataType === ImageType.Prices && result.priceData) {
      // Save to Prices Manager
      this.saveToPricesManager(result.priceData, filename);
    }
  }

  private saveToIndustryManager(industryData: IndustryData, filename: string): void {
    // Data is automatically saved to the database via the API when the OCR service processes it
    // The OCR service handles saving the industry data to the database
    console.log(`Industry data from ${filename} saved to database via API:`, industryData);
  }

  private saveToPricesManager(priceData: PriceData, filename: string): void {
    // Data is automatically saved to the database via the API when the OCR service processes it
    // The OCR service handles saving the price data to the database
    console.log(`Price data from ${filename} saved to database via API:`, priceData);
  }
}
