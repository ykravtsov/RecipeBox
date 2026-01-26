import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RecipeService } from '../services/recipe.service';
import { Recipe } from '../models/recipe';

@Component({
  selector: 'app-import-recipe-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatCardModule,
    FormsModule
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
    this.recipeService.scrapeRecipe(this.url).subscribe({
      next: (recipe) => {
        this.scrapedRecipe = recipe;
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

    // Set imageUrl if an image was selected
    if (this.selectedImageUrl) {
      this.scrapedRecipe.imageUrl = this.selectedImageUrl;
    }

    // Close dialog and return the scraped recipe data for editing
    this.dialogRef.close(this.scrapedRecipe);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
