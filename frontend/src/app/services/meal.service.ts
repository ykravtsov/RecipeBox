import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Recipe } from '../models/recipe';

export interface Meal {
    recipes: Recipe[];
    totalPrepTime: number;
    totalCookTime: number;
    aggregatedIngredients: { name: string; quantity: number; unit: string }[];
}

@Injectable({
    providedIn: 'root'
})
export class MealService {
    private currentMealSubject = new BehaviorSubject<Meal>({
        recipes: [],
        totalPrepTime: 0,
        totalCookTime: 0,
        aggregatedIngredients: []
    });

    currentMeal$ = this.currentMealSubject.asObservable();

    constructor() { }

    addRecipe(recipe: Recipe): void {
        const currentMeal = this.currentMealSubject.value;
        if (!currentMeal.recipes.find(r => r.id === recipe.id)) {
            const newRecipes = [...currentMeal.recipes, recipe];
            const newMeal = this.aggregateMeal(newRecipes);
            this.currentMealSubject.next(newMeal);
        }
    }

    removeRecipe(recipeId: string): void {
        const currentMeal = this.currentMealSubject.value;
        const newRecipes = currentMeal.recipes.filter(r => r.id !== recipeId);
        const newMeal = this.aggregateMeal(newRecipes);
        this.currentMealSubject.next(newMeal);
    }

    clearMeal(): void {
        this.currentMealSubject.next({
            recipes: [],
            totalPrepTime: 0,
            totalCookTime: 0,
            aggregatedIngredients: []
        });
    }

    private aggregateMeal(recipes: Recipe[]): Meal {
        const totalPrepTime = recipes.reduce((sum, r) => sum + (r.prepTime || 0), 0);
        const totalCookTime = recipes.reduce((sum, r) => sum + (r.cookTime || 0), 0);

        const ingredientMap = new Map<string, { quantity: number; unit: string }>();

        recipes.forEach(recipe => {
            recipe.ingredients.forEach(ing => {
                const key = `${ing.name.toLowerCase()}-${ing.unit.toLowerCase()}`;
                if (ingredientMap.has(key)) {
                    const existing = ingredientMap.get(key)!;
                    ingredientMap.set(key, {
                        quantity: existing.quantity + ing.quantity,
                        unit: ing.unit
                    });
                } else {
                    ingredientMap.set(key, {
                        quantity: ing.quantity,
                        unit: ing.unit
                    });
                }
            });
        });

        const aggregatedIngredients = Array.from(ingredientMap.entries()).map(([key, value]) => {
            const name = key.split('-')[0];
            return {
                name: name.charAt(0).toUpperCase() + name.slice(1),
                quantity: value.quantity,
                unit: value.unit
            };
        });

        return {
            recipes,
            totalPrepTime,
            totalCookTime,
            aggregatedIngredients
        };
    }
}