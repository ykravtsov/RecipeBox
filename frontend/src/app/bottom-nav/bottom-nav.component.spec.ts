import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BottomNavComponent } from './bottom-nav.component';

describe('BottomNavComponent', () => {
  let fixture: ComponentFixture<BottomNavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomNavComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BottomNavComponent);
    fixture.detectChanges();
  });

  it('routes each button to its own screen', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/recipes', '/search', '/saved', '/profile']);
    const labels = links.map((link) => link.textContent || '');
    expect(labels[0]).toContain('Feed');
    expect(labels[1]).toContain('Search');
    expect(labels[2]).toContain('Saved');
    expect(labels[3]).toContain('Profile');
    expect(fixture.nativeElement.querySelector('a[href="#"]')).toBeNull();
  });
});
