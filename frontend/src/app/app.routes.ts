import { Routes } from '@angular/router';
import { RecipesListComponent } from './recipes-list/recipes-list.component';
import { RecipeDetailComponent } from './recipe-detail/recipe-detail.component';
import { RecipeAddComponent } from './recipe-add/recipe-add.component';
import { RegisterComponent } from './auth/register/register.component';
import { LoginComponent } from './auth/login/login.component';
import { WelcomeComponent } from './welcome/welcome.component';
import { ProfileComponent } from './profile/profile.component';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: '', component: WelcomeComponent },
    { path: 'recipes', component: RecipesListComponent, canActivate: [authGuard], data: { view: 'feed' } },
    { path: 'search', component: RecipesListComponent, canActivate: [authGuard], data: { view: 'search' } },
    { path: 'saved', component: RecipesListComponent, canActivate: [authGuard], data: { view: 'saved' } },
    { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
    { path: 'recipes/add', component: RecipeAddComponent, canActivate: [authGuard] },
    { path: 'recipes/recipe/:id', component: RecipeDetailComponent, canActivate: [authGuard] },
    { path: 'recipes/recipe/:id/edit', component: RecipeDetailComponent, canActivate: [authGuard] },
    { path: '**', redirectTo: '' }
];
