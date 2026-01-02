# RecipeBox

A full-stack recipe management application built with ASP.NET Core API and Angular frontend.

## Features

- User authentication with JWT
- Recipe CRUD operations
- Recipe scraping from URLs
- File storage for recipe images
- PostgreSQL database

## Prerequisites

- Docker and Docker Compose

## Setup

1. Clone the repository
2. Run `docker-compose up` to start all services
3. The API will be available at `http://localhost:8080`
4. The frontend will be available at `http://localhost:4200`

The application will automatically seed a test user and sample recipes on first run.

## Test User

For testing purposes, a test user is automatically created:

- **Email:** test@example.com
- **Password:** Test123!

## API Endpoints

### Authentication

#### Login

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!"}'
```

Response includes a JWT token. Use this token in the Authorization header for authenticated requests.

### Recipes

#### Get All Recipes

```bash
curl -X GET http://localhost:8080/api/recipes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Get Recipe by ID

```bash
curl -X GET http://localhost:8080/api/recipes/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Create Recipe

```bash
curl -X POST http://localhost:8080/api/recipes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Recipe",
    "description": "Description",
    "ingredients": [
      {"name": "Ingredient 1", "quantity": 1, "unit": "cup"}
    ],
    "steps": ["Step 1", "Step 2"]
  }'
```

#### Update Recipe

```bash
curl -X PUT http://localhost:8080/api/recipes/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "title": "Updated Recipe",
    "description": "Updated description",
    "ingredients": [
      {"name": "Ingredient 1", "quantity": 1, "unit": "cup"}
    ],
    "steps": ["Step 1", "Step 2"]
  }'
```

#### Delete Recipe

```bash
curl -X DELETE http://localhost:8080/api/recipes/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Scrape Recipe (Anonymous)

```bash
curl -X POST http://localhost:8080/api/recipes/scrape-recipe \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/recipe"}'
```

## Development

For development with hot reload:

```bash
docker-compose up api  # API with HMR
docker-compose up frontend  # Frontend with HMR
```

The API will watch for file changes and automatically recompile.
