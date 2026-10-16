import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { WelcomeComponent } from './welcome.component';

describe('WelcomeComponent', () => {
  let fixture: ComponentFixture<WelcomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WelcomeComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomeComponent);
    fixture.detectChanges();
  });

  it('sends sign up to the sign-up form below login', () => {
    const root = fixture.nativeElement as HTMLElement;
    const signUpLinks = Array.from(root.querySelectorAll('a')).filter((link) =>
      /sign up/i.test(link.textContent || '')
    );
    expect(signUpLinks.length).toBeGreaterThan(0);
    for (const link of signUpLinks) {
      expect(link.getAttribute('href')).toBe('#signup-section');
    }

    const loginForm = root.querySelector('#auth-section form');
    const signup = root.querySelector('#signup-section');
    expect(loginForm).toBeTruthy();
    expect(signup?.textContent).toContain('Create Account');
    expect(loginForm!.compareDocumentPosition(signup!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
