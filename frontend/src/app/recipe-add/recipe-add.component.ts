import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { RecipeService } from '../services/recipe.service';
import { Recipe } from '../models/recipe';
import { ImportRecipeDialogComponent } from '../import-recipe-dialog/import-recipe-dialog.component';

@Component({
    standalone: true,
    selector: 'app-recipe-add',
    imports: [
      ReactiveFormsModule,
      FormsModule,
      RouterLink,
      MatDialogModule,
    ],
    templateUrl: './recipe-add.component.html',
    styleUrl: './recipe-add.component.scss'
})
export class RecipeAddComponent implements OnInit {
  recipeForm!: FormGroup;
  tags: string[] = [];

  constructor(
    private fb: FormBuilder,
    private recipeService: RecipeService,
    private router: Router,
    private dialog: MatDialog,
  ) { }

  ngOnInit(): void {
    this.initForm();
    // If navigated here with a scraped recipe from the Import dialog on the recipes list page
    const state = window.history.state as { scrapedRecipe?: Recipe } | undefined;
    if (state?.scrapedRecipe) {
      this.populateFormWithScrapedRecipe(state.scrapedRecipe);
    }
  }

  private initForm(): void {
    this.recipeForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      imageUrl: [''],
      prepTime: [null],
      cookTime: [null],
      ingredients: this.fb.array([], [Validators.required, Validators.minLength(1), this.atLeastOneValidIngredient]),
      steps: this.fb.array([], [Validators.required, Validators.minLength(1), this.atLeastOneValidStep])
    });
  }

  get ingredients(): FormArray {
    return this.recipeForm.get('ingredients') as FormArray;
  }

  get steps(): FormArray {
    return this.recipeForm.get('steps') as FormArray;
  }

  private atLeastOneValidIngredient(control: AbstractControl): ValidationErrors | null {
    const ingredients = control as FormArray;
    if (ingredients.length === 0) return { required: true };
    return ingredients.controls.some(i => i.get('name')?.value?.trim()) ? null : { noValidIngredients: true };
  }

  private atLeastOneValidStep(control: AbstractControl): ValidationErrors | null {
    const steps = control as FormArray;
    if (steps.length === 0) return { required: true };
    return steps.controls.some(s => s.value?.trim()) ? null : { noValidSteps: true };
  }

  addRecipe(): void {
    if (this.recipeForm.valid) {
      const formValue = this.recipeForm.value;
      const recipe: Recipe = {
        id: '',
        title: formValue.title,
        description: formValue.description,
        imageUrl: formValue.imageUrl,
        prepTime: formValue.prepTime ? Number(formValue.prepTime) : undefined,
        cookTime: formValue.cookTime ? Number(formValue.cookTime) : undefined,
        tags: this.tags.length > 0 ? this.tags : undefined,
        userId: '',
        ingredients: formValue.ingredients.filter((ing: any) => ing.name?.trim()),
        steps: formValue.steps.filter((step: string) => step?.trim())
      };

      this.recipeService.createRecipe(recipe).subscribe({
        next: () => this.router.navigate(['/recipes']),
        error: (error) => console.error('Error creating recipe', error)
      });
    } else {
      this.markFormGroupTouched(this.recipeForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup | FormArray): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      } else {
        control?.markAsTouched();
      }
    });
  }

  openImportDialog(): void {
    this.openImport({ initialMode: 'url' });
  }

  openPhotoImport(): void {
    this.openImport({ initialMode: 'photo' });
  }

  private openImport(data: { initialMode: 'url' | 'photo' }): void {
    const dialogRef = this.dialog.open(ImportRecipeDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      data,
    });

    dialogRef.afterClosed().subscribe((scrapedRecipe: Recipe | undefined) => {
      if (scrapedRecipe) {
        this.populateFormWithScrapedRecipe(scrapedRecipe);
      }
    });
  }

  populateFormWithScrapedRecipe(recipe: Recipe): void {
    while (this.ingredients.length > 0) this.ingredients.removeAt(0);
    while (this.steps.length > 0) this.steps.removeAt(0);

    this.recipeForm.patchValue({
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      prepTime: recipe.prepTime ?? null,
      cookTime: recipe.cookTime ?? null,
    });

    recipe.ingredients.forEach(ingredient => {
      this.ingredients.push(this.fb.group({
        name: [ingredient.name, Validators.required],
        quantity: [ingredient.quantity],
        unit: [ingredient.unit]
      }));
    });

    recipe.steps.forEach(step => {
      this.steps.push(this.fb.control(step, Validators.required));
    });

    if (recipe.tags) this.tags = [...recipe.tags];
  }

  addIngredient(): void {
    this.ingredients.push(this.fb.group({ name: ['', Validators.required], quantity: [1], unit: [''] }));
  }

  removeIngredient(index: number): void {
    this.ingredients.removeAt(index);
  }

  addStep(): void {
    this.steps.push(this.fb.control('', Validators.required));
  }

  removeStep(index: number): void {
    this.steps.removeAt(index);
  }

  addTag(value: string): void {
    const tag = value.trim();
    if (tag && !this.tags.includes(tag)) this.tags = [...this.tags, tag];
  }

  removeTag(index: number): void {
    this.tags = this.tags.filter((_, i) => i !== index);
  }

  getErrorMessage(controlName: string): string {
    const control = this.recipeForm.get(controlName);
    if (control?.hasError('required')) return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} is required`;
    if (control?.hasError('minlength')) return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} must be at least ${control.errors?.['minlength']?.requiredLength} characters`;
    return '';
  }

  getIngredientsErrorMessage(): string {
    const c = this.recipeForm.get('ingredients');
    if (c?.hasError('required') || c?.hasError('minlength')) return 'At least one ingredient is required';
    if (c?.hasError('noValidIngredients')) return 'At least one ingredient must have a name';
    return '';
  }

  getStepsErrorMessage(): string {
    const c = this.recipeForm.get('steps');
    if (c?.hasError('required') || c?.hasError('minlength')) return 'At least one step is required';
    if (c?.hasError('noValidSteps')) return 'At least one step must have content';
    return '';
  }
}
