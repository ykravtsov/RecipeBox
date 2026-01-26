# RecipeBox Frontend

The Angular frontend for the RecipeBox recipe management application.

## Features

- **Recipe Management**: View, add, edit, and delete recipes
- **Recipe Import**: Import recipes from URLs with AI-powered parsing
- **User Authentication**: Login and registration forms
- **Responsive Design**: Mobile-first design with Angular Material
- **Image Upload**: Upload and display recipe images
- **Recipe Search**: Search and filter recipes

## Technology Stack

- **Angular 17**: Modern web framework
- **TypeScript**: Type-safe JavaScript
- **Angular Material**: UI component library
- **RxJS**: Reactive programming
- **Angular CLI**: Development tooling

## Development

### Prerequisites

- Node.js 18+
- Angular CLI 17+

### Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start development server**
   ```bash
   ng serve
   ```
   Navigate to `http://localhost:4200/`. The app will automatically reload if you change any source files.

### Build

```bash
# Development build
ng build

# Production build
ng build --configuration production
```

The build artifacts will be stored in the `dist/` directory.

### Testing

```bash
# Unit tests
ng test

# End-to-end tests (requires API to be running)
ng e2e
```

### Code Scaffolding

Run `ng generate component component-name` to generate a new component. You can also use:

- `ng generate directive|pipe|service|class|guard|interface|enum|module`

## Project Structure

```
src/
├── app/
│   ├── auth/                 # Authentication components
│   ├── recipes-list/         # Recipe listing component
│   ├── recipe-detail/        # Recipe detail view
│   ├── recipe-add/           # Add new recipe form
│   ├── import-recipe-dialog/ # Recipe import dialog
│   ├── services/             # Angular services
│   └── models/               # TypeScript interfaces
├── assets/                   # Static assets
└── styles.scss               # Global styles
```

## API Integration

The frontend communicates with the RecipeBox API for:

- User authentication
- Recipe CRUD operations
- Image upload handling

Make sure the API is running on the configured endpoint (default: `http://localhost:5000`).

## Contributing

1. Follow Angular style guide
2. Write unit tests for new components
3. Use TypeScript interfaces for data models
4. Keep components modular and reusable

## Further Help

- [Angular CLI Documentation](https://angular.io/cli)
- [Angular Material Documentation](https://material.angular.io/)
- [RecipeBox API Documentation](../api/README.md)
