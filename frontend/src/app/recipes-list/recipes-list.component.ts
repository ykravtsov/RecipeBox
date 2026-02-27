import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { RecipeService } from '../services/recipe.service';
import { MealService } from '../services/meal.service';
import { Recipe } from '../models/recipe';
import { MealComponent } from '../meal/meal.component';

@Component({
  selector: 'app-recipes-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatChipsModule, MatIconModule, FormsModule, MealComponent],
  templateUrl: './recipes-list.component.html',
  styleUrl: './recipes-list.component.scss'
})
export class RecipesListComponent implements OnInit {
  recipes: Recipe[] = [];
  searchQuery: string = '';
  searchTerms: string[] = [];

  constructor(private recipeService: RecipeService, private mealService: MealService) { }

  ngOnInit(): void {
    this.loadRecipes();
  }

  loadRecipes(): void {
    this.recipeService.getRecipes().subscribe({
      next: (data) => this.recipes = data,
      error: (error) => console.error('Error loading recipes', error)
    });
  }

  addSearchTerm(): void {
    if (this.searchQuery.trim() && !this.searchTerms.includes(this.searchQuery.trim())) {
      this.searchTerms.push(this.searchQuery.trim());
      this.searchQuery = '';
    }
  }

  removeSearchTerm(term: string): void {
    this.searchTerms = this.searchTerms.filter(t => t !== term);
  }

  searchRecipes(): void {
    if (this.searchTerms.length > 0) {
      this.recipeService.searchRecipes(this.searchTerms, this.searchTerms).subscribe({
        next: (data) => this.recipes = data,
        error: (error) => console.error('Error searching recipes', error)
      });
    } else {
      this.loadRecipes();
    }
  }

  clearSearch(): void {
    this.searchTerms = [];
    this.searchQuery = '';
    this.loadRecipes();
  }

  addToMeal(recipe: Recipe): void {
    this.mealService.addRecipe(recipe);
  }
}
