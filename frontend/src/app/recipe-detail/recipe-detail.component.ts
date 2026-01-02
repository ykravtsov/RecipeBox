import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { RecipeService } from '../services/recipe.service';
import { Recipe } from '../models/recipe';

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './recipe-detail.component.html',
  styleUrl: './recipe-detail.component.scss'
})
export class RecipeDetailComponent implements OnInit {
  recipe: Recipe = {
    id: 0,
    title: '',
    description: '',
    imageUrl: '',
    userId: '',
    ingredients: [],
    steps: []
  };
  isEditMode = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recipeService: RecipeService
  ) { }

  ngOnInit(): void {
    const id = +this.route.snapshot.paramMap.get('id')!;
    const edit = this.route.snapshot.url.some(segment => segment.path === 'edit');
    this.isEditMode = edit;

    if (id) {
      this.recipeService.getRecipe(id).subscribe({
        next: (data) => this.recipe = data,
        error: (error) => console.error('Error loading recipe', error)
      });
    }
  }

  saveRecipe(): void {
    if (this.recipe.id) {
      this.recipeService.updateRecipe(this.recipe.id, this.recipe).subscribe({
        next: () => this.router.navigate(['/']),
        error: (error) => console.error('Error updating recipe', error)
      });
    }
  }

  deleteRecipe(): void {
    if (this.recipe.id && confirm('Are you sure you want to delete this recipe?')) {
      this.recipeService.deleteRecipe(this.recipe.id).subscribe({
        next: () => this.router.navigate(['/']),
        error: (error) => console.error('Error deleting recipe', error)
      });
    }
  }
}
