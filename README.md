# RecipeBox

A modern recipe management application built with ASP.NET Core API, Angular frontend, and deployed on Azure Kubernetes Service.

## Features

- **Recipe Management**: Add, edit, view, and organize your favorite recipes
- **Import Recipes**: Import recipes from URLs using AI-powered parsing
- **User Authentication**: Secure user registration and login
- **Image Upload**: Upload and store recipe images
- **Responsive Design**: Modern Angular frontend with Material Design
- **API-First Architecture**: RESTful API with comprehensive documentation
- **Containerized Deployment**: Docker containers with Kubernetes orchestration
- **Infrastructure as Code**: Azure infrastructure provisioned with CDK for Terraform
- **Policy as Code**: OPA policies for infrastructure validation

## Architecture

RecipeBox follows a microservices architecture with the following components:

- **API** (`api/`): ASP.NET Core Web API with Entity Framework Core and PostgreSQL
- **Frontend** (`frontend/`): Angular application with TypeScript
- **Infrastructure** (`infra/`): CDK for Terraform code for Azure resources
- **Kubernetes** (`k8s/`): Helm charts for deployment
- **E2E Tests** (`e2e/`): Playwright with Cucumber for end-to-end testing
- **Policy** (`policy/`): Open Policy Agent policies for infrastructure validation

## Prerequisites

- .NET 8 SDK
- Node.js 18+
- Angular CLI 17+
- Docker & Docker Compose
- Azure CLI (for infrastructure deployment)
- kubectl (for Kubernetes operations)

## Getting Started

### Local Development

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd RecipeBox
   ```

2. **Start the database**

   ```bash
   docker-compose up -d
   ```

3. **Setup the API**

   ```bash
   cd api
   dotnet restore
   dotnet ef database update
   dotnet run
   ```

4. **Setup the Frontend**

   ```bash
   cd ../frontend
   npm install
   ng serve
   ```

5. **Access the application**
   - Frontend: http://localhost:4200
   - API: http://localhost:5000

### Running Tests

```bash
# API Tests
cd api
dotnet test

# Frontend Tests
cd frontend
ng test

# E2E Tests
cd e2e
npm install
npm run test
```

### Docker Development

```bash
# Build and run all services
docker-compose up --build
```

## Deployment

### Infrastructure Setup

1. **Navigate to infrastructure directory**

   ```bash
   cd infra
   npm install
   ```

2. **Authenticate with Azure**

   ```bash
   az login
   ```

3. **Deploy infrastructure**
   ```bash
   cdktf deploy
   ```

### Kubernetes Deployment

1. **Connect to AKS cluster**

   ```bash
   az aks get-credentials --resource-group rg-recipebox --name recipebox-aks
   ```

2. **Deploy with Helm**
   ```bash
   helm install recipebox ./k8s
   ```

## API Documentation

The API provides RESTful endpoints for:

- User authentication (`/api/auth`)
- Recipe management (`/api/recipes`)

API documentation is available via Swagger at `/swagger` when running locally.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and ensure they pass
5. Submit a pull request

## License

This project is licensed under the MIT License.
