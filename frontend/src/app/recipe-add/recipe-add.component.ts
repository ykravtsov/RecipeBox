import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { RecipeService } from '../services/recipe.service';
import { Recipe, Ingredient } from '../models/recipe';
import { ImportRecipeDialogComponent } from '../import-recipe-dialog/import-recipe-dialog.component';

@Component({
  selector: 'app-recipe-add',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule
  ],
  templateUrl: './recipe-add.component.html',
  styleUrl: './recipe-add.component.scss'
})
export class RecipeAddComponent {
  recipe: Recipe = {
    id: 0,
    title: '',
    description: '',
    imageUrl: '',
    userId: '',
    ingredients: [],
    steps: []
  };

  constructor(
    private recipeService: RecipeService,
    private router: Router,
    private dialog: MatDialog
  ) { }

  addRecipe(): void {
    this.recipeService.createRecipe(this.recipe).subscribe({
      next: () => this.router.navigate(['/']),
      error: (error) => console.error('Error creating recipe', error)
    });
  }

  openImportDialog(): void {
    const dialogRef = this.dialog.open(ImportRecipeDialogComponent, {
      width: '600px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.recipe = result;
      }
    });
  }

  addIngredient(): void {
    this.recipe.ingredients.push({
      id: 0,
      name: '',
      quantity: 0,
      unit: ''
    });
  }

  removeIngredient(index: number): void {
    this.recipe.ingredients.splice(index, 1);
  }

  addStep(): void {
    this.recipe.steps.push('');
  }

  removeStep(index: number): void {
    this.recipe.steps.splice(index, 1);
  }
}
