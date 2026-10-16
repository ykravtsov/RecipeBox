import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { RecipeDetailComponent } from './recipe-detail.component';
import { RecipeService } from '../services/recipe.service';

describe('RecipeDetailComponent', () => {
  let fixture: ComponentFixture<RecipeDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '1' }),
              url: [],
            },
          },
        },
        {
          provide: RecipeService,
          useValue: {
            getRecipe: () => of({
              id: '1',
              title: 'Soup',
              description: 'A bowl of soup',
              userId: 'u',
              ingredients: [],
              steps: [],
            }),
            deleteRecipe: () => of(undefined),
            updateRecipe: () => of(undefined),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeDetailComponent);
    fixture.detectChanges();
  });

  it('routes the bottom navigation away from the main page', () => {
    const hrefs = Array.from(fixture.nativeElement.querySelectorAll('.app-bottom-nav a') as NodeListOf<HTMLAnchorElement>)
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/recipes', '/search', '/saved', '/profile']);
    expect(fixture.nativeElement.querySelector('a[href="#"]')).toBeNull();
  });
});
