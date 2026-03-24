import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
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
    standalone: true,
    selector: 'app-recipe-add',
    imports: [
    ReactiveFormsModule,
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
export class RecipeAddComponent implements OnInit {
  recipeForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private recipeService: RecipeService,
    private router: Router,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.recipeForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      imageUrl: [''],
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
    if (ingredients.length === 0) {
      return { required: true };
    }
    const hasValidIngredient = ingredients.controls.some(ingredient =>
      ingredient.get('name')?.value?.trim()
    );
    return hasValidIngredient ? null : { noValidIngredients: true };
  }

  private atLeastOneValidStep(control: AbstractControl): ValidationErrors | null {
    const steps = control as FormArray;
    if (steps.length === 0) {
      return { required: true };
    }
    const hasValidStep = steps.controls.some(step =>
      step.value?.trim()
    );
    return hasValidStep ? null : { noValidSteps: true };
  }

  addRecipe(): void {
    if (this.recipeForm.valid) {
      const formValue = this.recipeForm.value;
      const recipe: Recipe = {
        id: '',
        title: formValue.title,
        description: formValue.description,
        imageUrl: formValue.imageUrl,
        userId: '',
        ingredients: formValue.ingredients.filter((ing: any) => ing.name?.trim()),
        steps: formValue.steps.filter((step: string) => step?.trim())
      };

      this.recipeService.createRecipe(recipe).subscribe({
        next: () => this.router.navigate(['/']),
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
    const dialogRef = this.dialog.open(ImportRecipeDialogComponent, {
      width: '600px'
    });

    dialogRef.afterClosed().subscribe((scrapedRecipe: Recipe | undefined) => {
      if (scrapedRecipe) {
        this.populateFormWithScrapedRecipe(scrapedRecipe);
      }
    });
  }

  private populateFormWithScrapedRecipe(recipe: Recipe): void {
    // Clear existing form arrays
    while (this.ingredients.length > 0) {
      this.ingredients.removeAt(0);
    }
    while (this.steps.length > 0) {
      this.steps.removeAt(0);
    }

    // Populate form with scraped data
    this.recipeForm.patchValue({
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl
    });

    // Add ingredients
    recipe.ingredients.forEach(ingredient => {
      this.ingredients.push(this.fb.group({
        name: [ingredient.name, Validators.required],
        quantity: [ingredient.quantity],
        unit: [ingredient.unit]
      }));
    });

    // Add steps
    recipe.steps.forEach(step => {
      this.steps.push(this.fb.control(step, Validators.required));
    });
  }

  addIngredient(): void {
    this.ingredients.push(this.fb.group({
      name: ['', Validators.required],
      quantity: [0],
      unit: ['']
    }));
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

  getErrorMessage(controlName: string): string {
    const control = this.recipeForm.get(controlName);
    if (control?.hasError('required')) {
      return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} is required`;
    }
    if (control?.hasError('minlength')) {
      const minLength = control.errors?.['minlength']?.requiredLength;
      return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} must be at least ${minLength} characters`;
    }
    return '';
  }

  getIngredientsErrorMessage(): string {
    const ingredientsControl = this.recipeForm.get('ingredients');
    if (ingredientsControl?.hasError('required') || ingredientsControl?.hasError('minlength')) {
      return 'At least one ingredient is required';
    }
    if (ingredientsControl?.hasError('noValidIngredients')) {
      return 'At least one ingredient must have a name';
    }
    return '';
  }

  getStepsErrorMessage(): string {
    const stepsControl = this.recipeForm.get('steps');
    if (stepsControl?.hasError('required') || stepsControl?.hasError('minlength')) {
      return 'At least one step is required';
    }
    if (stepsControl?.hasError('noValidSteps')) {
      return 'At least one step must have content';
    }
    return '';
  }
}
