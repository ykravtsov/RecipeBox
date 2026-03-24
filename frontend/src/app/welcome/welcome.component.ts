import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { AuthService } from '../services/auth.service';

@Component({
    standalone: true,
    selector: 'app-welcome',
    imports: [RouterModule, ReactiveFormsModule],
    templateUrl: './welcome.component.html',
    styleUrl: './welcome.component.scss'
})
export class WelcomeComponent implements OnInit {
  loginForm: FormGroup;
  registerForm: FormGroup;
  loginError = '';
  registerError = '';

  constructor(
    private meta: Meta,
    private title: Title,
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      loginEmail: ['', [Validators.required, Validators.email]],
      loginPassword: ['', Validators.required]
    });
    this.registerForm = this.fb.group({
      registerEmail: ['', [Validators.required, Validators.email]],
      registerPassword: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit() {
    this.title.setTitle('RecipeBox — The Digital Sommelier for Your Kitchen');
    this.meta.updateTag({ name: 'description', content: 'Curate your culinary legacy with elegant organization and AI-powered intelligence. Your recipes, refined.' });
  }

  onLogin() {
    if (this.loginForm.valid) {
      const { loginEmail, loginPassword } = this.loginForm.value;
      this.authService.login(loginEmail, loginPassword).subscribe({
        next: () => this.router.navigate(['/recipes']),
        error: () => this.loginError = 'Login failed. Please check your credentials.'
      });
    }
  }

  onRegister() {
    if (this.registerForm.valid) {
      const { registerEmail, registerPassword } = this.registerForm.value;
      this.authService.register(registerEmail, registerPassword).subscribe({
        next: () => this.router.navigate(['/recipes']),
        error: (err: any) => this.registerError = err?.error?.message || 'Registration failed.'
      });
    }
  }
}
