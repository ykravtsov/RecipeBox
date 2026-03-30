import { Component } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RecipeService } from '../services/recipe.service';
import { Recipe } from '../models/recipe';

@Component({
    standalone: true,
    selector: 'app-import-recipe-dialog',
    imports: [
      MatDialogModule,
      FormsModule,
    ],
    templateUrl: './import-recipe-dialog.component.html',
    styleUrl: './import-recipe-dialog.component.scss'
})
export class ImportRecipeDialogComponent {
  url: string = '';
  isLoading: boolean = false;
  scrapedRecipe: Recipe | null = null;
  selectedImageUrl: string = '';

  constructor(
    private dialogRef: MatDialogRef<ImportRecipeDialogComponent>,
    private recipeService: RecipeService,
    private router: Router
  ) { }

  scrapeRecipe(): void {
    if (!this.url) return;

    this.isLoading = true;
    this.scrapedRecipe = null;
    this.recipeService.scrapeRecipe(this.url).subscribe({
      next: (recipe) => {
        this.scrapedRecipe = recipe;
        this.selectedImageUrl = recipe.imageUrls?.[0] ?? '';
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error scraping recipe', error);
        this.isLoading = false;
      }
    });
  }

  selectImage(imageUrl: string): void {
    this.selectedImageUrl = imageUrl;
  }

  saveRecipe(): void {
    if (!this.scrapedRecipe) return;
    if (this.selectedImageUrl) {
      this.scrapedRecipe.imageUrl = this.selectedImageUrl;
    }
    this.dialogRef.close(this.scrapedRecipe);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
