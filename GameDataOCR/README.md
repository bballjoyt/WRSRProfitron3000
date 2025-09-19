# Game Data OCR API

A high-accuracy C# Web API for extracting structured data from game screenshots using Azure Computer Vision OCR.

## Features

- **High-Accuracy OCR**: Uses Azure Computer Vision API for superior text recognition
- **Industry Data Processing**: Extracts building names, sections (red headers), and items (black text) from industry screenshots
- **Price Data Processing**: Extracts NATO/USSR buy/sell prices for resources
- **Color-Based Text Detection**: Distinguishes between red section headers and black content text
- **Auto-Detection**: Automatically determines image type based on dimensions
- **Structured Output**: Returns clean, structured JSON data ready for web applications
- **Position-Based Parsing**: Uses text coordinates for accurate section grouping

## API Endpoints

### POST `/api/ocr/process-industry`
Process industry building screenshots to extract:
- Building name
- Sections with red headers
- Items in each section

### POST `/api/ocr/process-prices`
Process price data screenshots to extract:
- Resource names
- NATO buy/sell prices
- USSR buy/sell prices

### POST `/api/ocr/auto-detect`
Automatically detect image type and process accordingly

## Setup

### 1. Create Azure Computer Vision Resource
1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new "Computer Vision" resource
3. Choose pricing tier (F0 free tier available)
4. Note the endpoint URL and API key

### 2. Configure Application
1. Update `appsettings.json` with your Azure credentials:
```json
{
  "AzureVision": {
    "Endpoint": "https://your-resource-name.cognitiveservices.azure.com/",
    "ApiKey": "your-32-character-api-key"
  }
}
```

### 3. Run Application
```bash
dotnet restore
dotnet run
```

## Usage

Upload PNG/JPG images via the API endpoints. The API will:
1. Process the image with Azure Computer Vision OCR
2. Analyze text colors and positions to identify structure
3. Parse content based on game data patterns
4. Return structured JSON data

## Response Format

### Industry Data
```json
{
  "success": true,
  "industryData": {
    "name": "Explosives factory",
    "sections": [
      {
        "sectionName": "Resources needed to build:",
        "items": ["2712 Workdays", "246t of Concrete", "62t of Gravel", "60t of Steel", "44t of Bricks"]
      },
      {
        "sectionName": "Maximum number of workers:",
        "items": ["75"]
      }
    ]
  }
}
```

### Price Data
```json
{
  "success": true,
  "priceData": {
    "items": [
      {
        "resource": "Aluminum ingots",
        "natoBuy": 15.22,
        "natoSell": 13.52,
        "ussrBuy": 16.13,
        "ussrSell": 14.32
      }
    ]
  }
}
```

## Advantages Over Tesseract

- **Much Higher Accuracy**: Azure Computer Vision handles game UI text much better
- **No Manual Corrections**: Reliable text extraction without line-by-line fixes
- **Better Color Detection**: More accurate identification of red headers vs black text
- **Position Awareness**: Uses coordinate data for proper section grouping
- **Cloud Reliability**: Microsoft's trained models vs local Tesseract setup

## Requirements

- .NET 8.0
- Azure Computer Vision API subscription
- ImageSharp for image processing