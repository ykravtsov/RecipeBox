import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { RecipesListComponent } from './recipes-list.component';
import { RecipeService } from '../services/recipe.service';

describe('RecipesListComponent', () => {
  let fixture: ComponentFixture<RecipesListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipesListComponent],
      providers: [
        provideRouter([]),
        {
          provide: RecipeService,
          useValue: {
            getRecipes: () => of([]),
            searchRecipes: () => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipesListComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('keeps the import button beside the logo instead of covering it', () => {
    const nav = fixture.nativeElement.querySelector('header nav') as HTMLElement;
    expect(nav.className).toContain('flex-wrap');
    expect(fixture.nativeElement.querySelector('[data-testid="site-logo"]').textContent).toContain('RecipeBox');
    expect(fixture.nativeElement.querySelector('[data-testid="import-recipe-button"]').textContent).toContain('Import Recipe');
  });

  it('points the bottom navigation at separate screens', () => {
    const hrefs = Array.from(fixture.nativeElement.querySelectorAll('.app-bottom-nav a') as NodeListOf<HTMLAnchorElement>)
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/recipes', '/search', '/saved', '/profile']);
  });
});
