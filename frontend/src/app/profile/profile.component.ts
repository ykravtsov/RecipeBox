import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';

@Component({
  standalone: true,
  selector: 'app-profile',
  imports: [RouterLink, BottomNavComponent],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  email: string | null;

  constructor(private authService: AuthService, private router: Router) {
    this.email = this.authService.getEmail();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
