import { Component, Inject, Optional } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { RecipeService } from '../services/recipe.service';
import { Recipe } from '../models/recipe';

export interface ImportRecipeDialogData {
  initialMode?: 'url' | 'photo';
}

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
  mode: 'url' | 'photo' = 'url';
  url: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';
  scrapedRecipe: Recipe | null = null;
  selectedImageUrl: string = '';
  useCamera = false;

  constructor(
    private dialogRef: MatDialogRef<ImportRecipeDialogComponent>,
    private recipeService: RecipeService,
    @Optional() @Inject(MAT_DIALOG_DATA) data: ImportRecipeDialogData | null,
  ) {
    this.mode = data?.initialMode === 'photo' ? 'photo' : 'url';
    this.useCamera = ImportRecipeDialogComponent.prefersCamera();
  }

  static prefersCamera(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    const narrow = window.matchMedia('(max-width: 767px)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    return (narrow && coarse) || mobileUa;
  }

  scrapeRecipe(): void {
    if (!this.url) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.scrapedRecipe = null;
    this.recipeService.scrapeRecipe(this.url).subscribe({
      next: (recipe) => {
        this.scrapedRecipe = recipe;
        this.selectedImageUrl = recipe.imageUrls?.[0] ?? '';
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Could not import a recipe from that link.';
        this.isLoading = false;
      }
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.scrapedRecipe = null;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      this.recipeService.importRecipePhoto(base64, file.type || 'image/jpeg').subscribe({
        next: (recipe) => {
          this.scrapedRecipe = recipe;
          this.selectedImageUrl = recipe.imageUrls?.[0] ?? recipe.imageUrl ?? '';
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = 'Could not read a recipe from that photo. Try a clearer picture of the page.';
          this.isLoading = false;
        }
      });
    };
    reader.onerror = () => {
      this.errorMessage = 'Could not read that image file.';
      this.isLoading = false;
    };
    reader.readAsDataURL(file);
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
