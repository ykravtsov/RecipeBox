import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
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

    getRecipes(): Observable<Recipe[]> {
        return this.http.get<Recipe[]>(this.apiUrl, { headers: this.getHeaders() });
    }

    getRecipe(id: string): Observable<Recipe> {
        return this.http.get<Recipe>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
    }

    createRecipe(recipe: Recipe): Observable<Recipe> {
        return this.http.post<Recipe>(this.apiUrl, recipe, { headers: this.getHeaders() });
    }

    updateRecipe(id: string, recipe: Recipe): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/${id}`, recipe, { headers: this.getHeaders() });
    }

    deleteRecipe(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
    }

    scrapeRecipe(url: string): Observable<Recipe> {
        return this.http.post<Recipe>('/api/scrape-recipe', { url }, { headers: this.getHeaders() });
    }

    searchRecipes(tags?: string[], ingredients?: string[]): Observable<Recipe[]> {
        const params: any = {};
        if (tags && tags.length > 0) {
            params.tags = tags.join(',');
        }
        if (ingredients && ingredients.length > 0) {
            params.ingredients = ingredients.join(',');
        }
        return this.http.get<Recipe[]>('/api/recipes/search', { headers: this.getHeaders(), params });
    }
}