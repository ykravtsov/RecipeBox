export interface Recipe {
    id: number;
    title: string;
    description: string;
    imageUrl: string;
    imageUrls?: string[];
    userId: string;
    ingredients: Ingredient[];
    steps: string[];
}

export interface Ingredient {
    id: number;
    name: string;
    quantity: number;
    unit: string;
}