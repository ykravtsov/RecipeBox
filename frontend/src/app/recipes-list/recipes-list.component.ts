import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { RecipeService } from '../services/recipe.service';
import { Recipe } from '../models/recipe';

@Component({
  selector: 'app-recipes-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule],
  templateUrl: './recipes-list.component.html',
  styleUrl: './recipes-list.component.scss'
})
export class RecipesListComponent implements OnInit {
  recipes: Recipe[] = [];

  constructor(private recipeService: RecipeService) { }

  ngOnInit(): void {
    this.loadRecipes();
  }

  loadRecipes(): void {
    this.recipeService.getRecipes().subscribe({
      next: (data) => this.recipes = data,
      error: (error) => console.error('Error loading recipes', error)
    });
  }
}
