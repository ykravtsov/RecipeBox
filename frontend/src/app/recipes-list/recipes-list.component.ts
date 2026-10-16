import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';

import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { RecipeService } from '../services/recipe.service';
import { MealService } from '../services/meal.service';
import { AuthService } from '../services/auth.service';
import { Recipe } from '../models/recipe';
import { ImportRecipeDialogComponent } from '../import-recipe-dialog/import-recipe-dialog.component';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

@Component({
    standalone: true,
    selector: 'app-recipes-list',
    imports: [RouterLink, FormsModule, MatDialogModule, BottomNavComponent],
    templateUrl: './recipes-list.component.html',
    styleUrl: './recipes-list.component.scss'
})
export class RecipesListComponent implements OnInit, OnDestroy {
  recipes: Recipe[] = [];
  searchQuery: string = '';
  searchTerms: string[] = [];
  view: 'feed' | 'search' | 'saved' = 'feed';
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  private navSub?: Subscription;

  constructor(
    private recipeService: RecipeService,
    private mealService: MealService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.applyView();
    this.navSub = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(() => this.applyView());
    this.loadRecipes();
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  private applyView(): void {
    const view = this.route.snapshot.data['view'];
    this.view = view === 'search' || view === 'saved' ? view : 'feed';
    if (this.view === 'search') {
      setTimeout(() => this.searchInput?.nativeElement.focus());
    }
  }

  loadRecipes(): void {
    this.recipeService.getRecipes().subscribe({
      next: (data) => this.recipes = data,
      error: (error) => console.error('Error loading recipes', error)
    });
  }

  addSearchTerm(): void {
    const term = this.searchQuery.trim();
    if (term && !this.searchTerms.includes(term)) {
      this.searchTerms.push(term);
      this.searchQuery = '';
    }
    if (this.searchTerms.length > 0) {
      this.searchRecipes();
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
