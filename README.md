# RecipeBox

A modern recipe management and meal planning application built with Rust backend, Angular frontend, and deployed on Azure Kubernetes Service.

## Features

- **Recipe Management**: Add, edit, view, and organize your favorite recipes
- **Import Recipes**: Import recipes from URLs using AI-powered parsing
- **Meal Planning**: Plan and organize meals with your recipes
- **User Authentication**: Secure user registration and login
- **Image Upload**: Upload and store recipe images
- **Recipe Search**: Search and filter through your recipe collection
- **Responsive Design**: Modern Angular frontend with Material Design and static site generation
- **API-First Architecture**: RESTful API built with Rust and Axum
- **Containerized Deployment**: Docker containers with Kubernetes orchestration
- **Infrastructure as Code**: Azure infrastructure provisioned with CDK for Terraform
- **Policy as Code**: OPA policies for infrastructure validation
- **End-to-End Testing**: Cucumber-based E2E tests

## Architecture

RecipeBox follows a modern web application architecture with the following components:

- **Backend** (`rust-backend/`): Rust Web API with Axum framework and SeaORM for PostgreSQL
- **Frontend** (`frontend/`): Angular 17 application with TypeScript and Scully for static site generation
- **Infrastructure** (`infra/`): CDK for Terraform code for Azure resources
- **Kubernetes** (`k8s/`): Helm charts for deployment
- **E2E Tests** (`e2e/`): Cucumber with Playwright for end-to-end testing
- **Policy** (`policy/`): Open Policy Agent policies for infrastructure validation

## Prerequisites

- Rust (latest stable)
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
   docker-compose up -d postgres
   ```

3. **Setup the Backend**

   ```bash
   cd rust-backend
   cargo build
   cargo run
   ```

4. **Setup the Frontend** (in a new terminal)

   ```bash
   cd frontend
   npm install
   ng serve
   ```

5. **Access the application**
   - Frontend: http://localhost:4200
   - Backend API: http://localhost:3000

### Running Tests

```bash
# Backend Tests
cd rust-backend
cargo test

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

Or run services individually:

```bash
# Start only the database
docker-compose up postgres

# Start backend and database
docker-compose up rust-backend

# Start frontend (after backend is running)
docker-compose up frontend
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

## API Endpoints

The backend API provides RESTful endpoints for:

- User authentication (`/auth/register`, `/auth/login`)
- Recipe management (`/recipes`, `/recipes/:id`, `/recipes/search`)
- Recipe import (`/scrape-recipe`)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and ensure they pass
5. Submit a pull request

## License

This project is licensed under the MIT License.
