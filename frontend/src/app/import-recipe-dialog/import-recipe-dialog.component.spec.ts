import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportRecipeDialogComponent } from './import-recipe-dialog.component';

describe('ImportRecipeDialogComponent', () => {
  let component: ImportRecipeDialogComponent;
  let fixture: ComponentFixture<ImportRecipeDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportRecipeDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ImportRecipeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
