import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';


@Component({
    standalone: true,
    selector: 'app-register',
    imports: [ReactiveFormsModule, RouterModule],
    templateUrl: './register.component.html',
    styleUrl: './register.component.scss'
})
export class RegisterComponent {
  registerForm: FormGroup;
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(6),
        this.passwordValidator
      ]]
    });
  }

  passwordValidator(control: any) {
    const value = control.value;
    if (!value) return null;

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNonAlphanumeric = /[^A-Za-z0-9]/.test(value);

    const passwordValid = hasUpperCase && hasLowerCase && hasNonAlphanumeric;
    return !passwordValid ? { invalidPassword: true } : null;
  }

  getPasswordErrorMessage() {
    const password = this.registerForm.get('password');
    if (password?.hasError('required')) {
      return 'Password is required';
    }
    if (password?.hasError('minlength')) {
      return 'Password must be at least 6 characters';
    }
    if (password?.hasError('invalidPassword')) {
      const value = password.value || '';
      const errors = [];

      if (!/[A-Z]/.test(value)) {
        errors.push('one uppercase letter');
      }
      if (!/[a-z]/.test(value)) {
        errors.push('one lowercase letter');
      }
      if (!/[^A-Za-z0-9]/.test(value)) {
        errors.push('one special character');
      }

      if (errors.length > 0) {
        return `Password must contain at least ${errors.join(', ')}`;
      }
    }
    return '';
  }

  onSubmit() {
    if (this.registerForm.valid) {
      const { email, password } = this.registerForm.value;
      this.authService.register(email, password).subscribe({
        next: () => {
          // After successful registration, automatically log the user in
          this.authService.login(email, password).subscribe({
            next: () => {
              this.router.navigate(['/recipes']);
            },
            error: (loginError) => {
              // If auto-login fails, redirect to login page
              this.router.navigate(['/login']);
            }
          });
        },
        error: (error) => {
          if (error.error && error.error.length > 0) {
            // Show specific validation errors from API
            this.errorMessage = error.error.map((e: any) => e.description).join('. ');
          } else {
            this.errorMessage = 'Registration failed. Please try again.';
          }
        }
      });
    }
  }
}
