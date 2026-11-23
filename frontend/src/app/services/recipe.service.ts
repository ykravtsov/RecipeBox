import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Recipe } from '../models/recipe';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class RecipeService {
    private apiUrl = '/api/recipes';

    constructor(private http: HttpClient, private authService: AuthService) { }

    private getHeaders(): HttpHeaders {
        const token = this.authService.getToken();
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        });
    }

    private mapRecipe(res: any): Recipe {
        const ingredients = (res.ingredients ?? []).map((ing: any) => ({
            name: ing.name,
            quantity: Number(ing.quantity) || 0,
            unit: ing.unit ?? '',
        }));
        return {
            ...res,
            ingredients,
            imageUrl: res.image_url ?? res.imageUrl,
            userId: res.user_id ?? res.userId,
            prepTime: res.prep_time ?? res.prepTime,
            cookTime: res.cook_time ?? res.cookTime,
            createdAt: res.created_at ?? res.createdAt,
        } as Recipe;
    }

    getRecipes(): Observable<Recipe[]> {
        return this.http.get<any[]>(this.apiUrl, { headers: this.getHeaders() }).pipe(
            map(list => list.map(r => this.mapRecipe(r)))
        );
    }

    getRecipe(id: string): Observable<Recipe> {
        return this.http.get<any>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
            map(r => this.mapRecipe(r))
        );
    }

    createRecipe(recipe: Recipe): Observable<Recipe> {
        const payload = { ...recipe, image_url: recipe.imageUrl, prep_time: recipe.prepTime, cook_time: recipe.cookTime };
        return this.http.post<any>(this.apiUrl, payload, { headers: this.getHeaders() }).pipe(
            map(r => this.mapRecipe(r))
        );
    }

    updateRecipe(id: string, recipe: Recipe): Observable<void> {
        const payload = { ...recipe, image_url: recipe.imageUrl, prep_time: recipe.prepTime, cook_time: recipe.cookTime };
        return this.http.put<void>(`${this.apiUrl}/${id}`, payload, { headers: this.getHeaders() });
    }

    deleteRecipe(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
    }

    scrapeRecipe(url: string): Observable<Recipe> {
        return this.http.post<any>('/api/scrape-recipe', { url }, { headers: this.getHeaders() }).pipe(
            map(res => this.mapScrapedRecipe(res))
        );
    }

    importRecipePhoto(imageBase64: string, mimeType: string): Observable<Recipe> {
        return this.http.post<any>('/api/import-recipe-photo', {
            image_base64: imageBase64,
            mime_type: mimeType,
        }, { headers: this.getHeaders() }).pipe(
            map(res => this.mapScrapedRecipe(res))
        );
    }

    private mapScrapedRecipe(res: any): Recipe {
        const ingredients = (res.ingredients ?? []).map((ing: any) => ({
            name: ing.name,
            quantity: Number(ing.quantity) || 0,
            unit: ing.unit ?? '',
        }));
        return {
            ...res,
            ingredients,
            imageUrls: res.image_urls ?? res.imageUrls ?? [],
            imageUrl: res.image_url ?? res.imageUrl ?? res.image_urls?.[0] ?? res.imageUrls?.[0],
            prepTime: res.prep_time ?? res.prepTime,
            cookTime: res.cook_time ?? res.cookTime,
            tags: res.tags ?? [],
        } as Recipe;
    }

    searchRecipes(tags?: string[], ingredients?: string[]): Observable<Recipe[]> {
        const params: any = {};
        if (tags && tags.length > 0) {
            params.tags = tags.join(',');
        }
        if (ingredients && ingredients.length > 0) {
            params.ingredients = ingredients.join(',');
        }
        return this.http.get<any[]>('/api/recipes/search', { headers: this.getHeaders(), params }).pipe(
            map(list => list.map(r => this.mapRecipe(r)))
        );
    }
}