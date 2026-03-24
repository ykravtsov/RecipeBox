import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { RecipeService } from '../services/recipe.service';
import { Recipe } from '../models/recipe';

@Component({
    standalone: true,
    selector: 'app-recipe-detail',
    imports: [FormsModule, RouterLink],
    templateUrl: './recipe-detail.component.html',
    styleUrl: './recipe-detail.component.scss'
})
export class RecipeDetailComponent implements OnInit {
  recipe: Recipe = {
    id: '',
    title: '',
    description: '',
    imageUrl: '',
    userId: '',
    ingredients: [],
    steps: []
  };
  isEditMode = false;
  checkedIngredients: Set<number> = new Set();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recipeService: RecipeService
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    const edit = this.route.snapshot.url.some(segment => segment.path === 'edit');
    this.isEditMode = edit;

    if (id) {
      this.recipeService.getRecipe(id).subscribe({
        next: (data) => this.recipe = data,
        error: (error) => console.error('Error loading recipe', error)
      });
    }
  }

  toggleIngredient(index: number): void {
    if (this.checkedIngredients.has(index)) {
      this.checkedIngredients.delete(index);
    } else {
      this.checkedIngredients.add(index);
    }
  }

  isChecked(index: number): boolean {
    return this.checkedIngredients.has(index);
  }

  stepNumber(i: number): string {
    return String(i + 1).padStart(2, '0');
  }

  saveRecipe(): void {
    if (this.recipe.id) {
      this.recipeService.updateRecipe(this.recipe.id, this.recipe).subscribe({
        next: () => this.router.navigate(['/recipes']),
        error: (error) => console.error('Error updating recipe', error)
      });
    }
  }

  deleteRecipe(): void {
    if (this.recipe.id && confirm('Are you sure you want to delete this recipe?')) {
      this.recipeService.deleteRecipe(this.recipe.id).subscribe({
        next: () => this.router.navigate(['/recipes']),
        error: (error) => console.error('Error deleting recipe', error)
      });
    }
  }
}
