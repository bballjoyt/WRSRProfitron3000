# WRSRProfitron3000

A comprehensive OCR system for game data extraction using Azure Vision API and Google Vision API. The system consists of a .NET 8 Web API backend and an Angular 20 frontend for processing industry and price data from game screenshots.

## 🏗️ Architecture

- **Backend**: .NET 8 Web API with Entity Framework Core and SQLite
- **Frontend**: Angular 20 with TypeScript
- **OCR Providers**: Azure Vision API and Google Vision API
- **Database**: SQLite for data storage
- **Authentication**: Environment-based API key management

## 📋 Prerequisites

### Required Software
- **.NET 8 SDK** - [Download here](https://dotnet.microsoft.com/download/dotnet/8.0)
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** - [Download here](https://git-scm.com/)

### API Keys Required
- **Azure Vision API Key** and **Endpoint** - [Get from Azure Portal](https://portal.azure.com/)
- **Google Vision API Key** - [Get from Google Cloud Console](https://console.cloud.google.com/)

### Verify Prerequisites
```bash
# Check .NET version
dotnet --version

# Check Node.js version
node --version

# Check npm version
npm --version

# Check Git version
git --version
```

## 🚀 Setup Instructions

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd WRSRProfitron3000
```

### 2. Environment Configuration

#### Create Environment File
```bash
# Copy the example file
cp .env.example .env
```

#### Configure `.env` File
Edit the `.env` file with your actual API keys:

```env
# Database connection
CONNECTION_STRINGS__DEFAULTCONNECTION=Data Source=gamedata.db

# Azure Vision API Configuration
AZURE_VISION_ENDPOINT=https://your-azure-endpoint.cognitiveservices.azure.com/
AZURE_VISION_API_KEY=your-azure-vision-api-key-here

# Google Vision API Configuration
GOOGLE_VISION_API_KEY=your-google-vision-api-key-here

# Application Settings
ENVIRONMENT=development
```

**⚠️ Important**: Never commit the `.env` file to version control. It's already in `.gitignore`.

### 3. Backend Setup (.NET API)

#### Navigate to API Directory
```bash
cd GameDataOCR/GameDataOCR.API
```

#### Restore Dependencies
```bash
dotnet restore
```

#### Build the Project
```bash
dotnet build
```

#### Initialize Database
The database will be automatically created when you first run the application using Entity Framework's `EnsureCreated()` method.

### 4. Frontend Setup (Angular)

#### Navigate to Website Directory
```bash
cd ../../Website
```

#### Install Dependencies
```bash
npm install
```

#### Verify Build
```bash
npm run build
```

## 🎯 Running the Application

### Start the Backend API
```bash
# From the GameDataOCR/GameDataOCR.API directory
dotnet run
```
The API will start on: `http://localhost:55234`

### Start the Frontend
```bash
# From the Website directory (in a new terminal)
npm start
```
The Angular app will start on: `http://localhost:4200`

### Verify Everything is Working
1. Open `http://localhost:4200` in your browser
2. You should see the OCR upload interface
3. Try uploading an image and selecting Azure or Google provider
4. Check the API at `http://localhost:55234/swagger` for API documentation

## 📁 Project Structure

```
WRSRProfitron3000/
├── GameDataOCR/
│   └── GameDataOCR.API/           # .NET 8 Web API
│       ├── Controllers/           # API endpoints
│       ├── Services/             # OCR service implementations
│       ├── Data/                 # Entity Framework context
│       ├── Models/               # Data models
│       └── Program.cs            # Application entry point
├── Website/                      # Angular 20 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/       # Angular components
│   │   │   ├── services/         # HTTP services
│   │   │   └── models/           # TypeScript interfaces
│   │   └── styles.css            # Global styles
│   ├── package.json              # npm dependencies
│   └── angular.json              # Angular configuration
├── .env.example                  # Environment template
├── .gitignore                    # Git ignore rules
└── README.md                     # This file
```

## 🔧 Development Commands

### Backend (.NET API)
```bash
# Run in development mode
dotnet run

# Run with hot reload
dotnet watch run

# Build for production
dotnet build --configuration Release

# Run tests (if available)
dotnet test
```

### Frontend (Angular)
```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Lint code
ng lint
```

## 🌐 API Endpoints

### OCR Processing
- `POST /api/ocr/azure/process-industry` - Process industry data with Azure
- `POST /api/ocr/azure/process-prices` - Process price data with Azure
- `POST /api/ocr/google/process-industry` - Process industry data with Google
- `POST /api/ocr/google/process-prices` - Process price data with Google

### API Documentation
- `GET /swagger` - Interactive API documentation (development only)

## 🐛 Troubleshooting

### Common Issues

#### "SQLite Error: no such table"
- Stop the API if running
- Delete `gamedata.db` file
- Restart the API (database will be recreated)

#### "Azure Vision endpoint and API key must be configured"
- Verify your `.env` file has the correct Azure credentials
- Ensure the `.env` file is in the root directory
- Restart the API after changing environment variables

#### CORS Errors
- Ensure the API is running on port 55234
- Check that CORS is configured in `Program.cs`
- Verify the frontend is making requests to the correct API URL

#### npm install fails
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

### Getting Help
- Check the console logs in both API and frontend
- Use browser developer tools for frontend debugging
- Check `http://localhost:55234/swagger` for API testing
- Ensure all environment variables are properly set

## 🔐 Security Notes

- API keys are stored in environment variables, not in code
- The `.env` file is excluded from version control
- CORS is configured for development (adjust for production)
- Database uses SQLite for simplicity (consider upgrading for production)

## 📝 License

[Add your license information here]

## 🤝 Contributing

[Add contribution guidelines here]