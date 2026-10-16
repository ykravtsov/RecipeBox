import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ImportRecipeDialogComponent } from './import-recipe-dialog.component';
import { RecipeService } from '../services/recipe.service';
import { Recipe } from '../models/recipe';

describe('ImportRecipeDialogComponent', () => {
  let component: ImportRecipeDialogComponent;
  let fixture: ComponentFixture<ImportRecipeDialogComponent>;

  const extracted: Recipe = {
    id: '',
    title: 'Banana Bread',
    description: 'From the cookbook page',
    userId: '',
    ingredients: [{ name: 'banana', quantity: 3, unit: 'piece' }],
    steps: ['Mash the bananas'],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportRecipeDialogComponent],
      providers: [
        provideHttpClient(),
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        { provide: MAT_DIALOG_DATA, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportRecipeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the camera on mobile and a file picker otherwise', () => {
    component.mode = 'photo';
    component.useCamera = true;
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('[data-testid="cookbook-photo"]') as HTMLInputElement;
    expect(input.getAttribute('capture')).toBe('environment');
    expect(fixture.nativeElement.textContent).toContain('Take photo');

    component.useCamera = false;
    fixture.detectChanges();
    expect(input.getAttribute('capture')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Upload photo');
  });

  it('sends a cookbook photo to the importer for review', (done) => {
    const service = TestBed.inject(RecipeService);
    spyOn(service, 'importRecipePhoto').and.returnValue(of(extracted));
    component.mode = 'photo';
    component.useCamera = false;
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('[data-testid="cookbook-photo"]') as HTMLInputElement;
    const file = new File(['page'], 'page.jpg', { type: 'image/jpeg' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));

    setTimeout(() => {
      fixture.detectChanges();
      expect(service.importRecipePhoto).toHaveBeenCalled();
      const [payload] = (service.importRecipePhoto as jasmine.Spy).calls.mostRecent().args;
      expect(typeof payload).toBe('string');
      expect(payload.length).toBeGreaterThan(0);
      expect(component.scrapedRecipe?.title).toBe('Banana Bread');
      expect(fixture.nativeElement.textContent).toContain('Banana Bread');
      done();
    }, 200);
  });
});
