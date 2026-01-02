import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Recipe } from '../models/recipe';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class RecipeService {
    private apiUrl = 'http://localhost:8080/api/recipes'; // Adjust port if needed

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

    getRecipe(id: number): Observable<Recipe> {
        return this.http.get<Recipe>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
    }

    createRecipe(recipe: Recipe): Observable<Recipe> {
        return this.http.post<Recipe>(this.apiUrl, recipe, { headers: this.getHeaders() });
    }

    updateRecipe(id: number, recipe: Recipe): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/${id}`, recipe, { headers: this.getHeaders() });
    }

    deleteRecipe(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
    }

    scrapeRecipe(url: string): Observable<Recipe> {
        return this.http.post<Recipe>(`${this.apiUrl}/scrape-recipe`, { url }, { headers: this.getHeaders() });
    }
}