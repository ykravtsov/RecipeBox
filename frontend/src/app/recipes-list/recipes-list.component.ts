import { Component, OnInit } from '@angular/core';

import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RecipeService } from '../services/recipe.service';
import { MealService } from '../services/meal.service';
import { AuthService } from '../services/auth.service';
import { Recipe } from '../models/recipe';
import { ImportRecipeDialogComponent } from '../import-recipe-dialog/import-recipe-dialog.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

@Component({
    standalone: true,
    selector: 'app-recipes-list',
    imports: [RouterLink, FormsModule, MatDialogModule],
    templateUrl: './recipes-list.component.html',
    styleUrl: './recipes-list.component.scss'
})
export class RecipesListComponent implements OnInit {
  recipes: Recipe[] = [];
  searchQuery: string = '';
  searchTerms: string[] = [];

  constructor(
    private recipeService: RecipeService,
    private mealService: MealService,
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog
  ) { }

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
    if (this.searchTerms.length === 0) this.loadRecipes();
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

  openImportDialog(): void {
    const dialogRef = this.dialog.open(ImportRecipeDialogComponent, {
      width: '900px',
      maxWidth: '95vw'
    });
    dialogRef.afterClosed().subscribe((scrapedRecipe: Recipe | undefined) => {
      if (scrapedRecipe) {
        this.router.navigate(['/recipes/add'], { state: { scrapedRecipe } });
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
