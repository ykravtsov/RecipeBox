export interface Recipe {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    imageUrls?: string[];
    userId: string;
    ingredients: Ingredient[];
    steps: string[];
    tags?: string[];
    prepTime?: number;
    cookTime?: number;
    createdAt?: string;
}

export interface Ingredient {
    name: string;
    quantity: number;
    unit: string;
}