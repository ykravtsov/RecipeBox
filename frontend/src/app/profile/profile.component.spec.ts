import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProfileComponent } from './profile.component';
import { AuthService } from '../services/auth.service';

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { getEmail: () => 'chef@recipebox.com', logout: () => undefined } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
  });

  it('shows the signed-in email and a profile route', () => {
    expect(fixture.nativeElement.textContent).toContain('chef@recipebox.com');
    expect(fixture.nativeElement.querySelector('a[href="/profile"]')).toBeTruthy();
  });
});
