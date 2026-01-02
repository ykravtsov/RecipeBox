import { Routes } from '@angular/router';
import { RecipesListComponent } from './recipes-list/recipes-list.component';
import { RecipeDetailComponent } from './recipe-detail/recipe-detail.component';
import { RecipeAddComponent } from './recipe-add/recipe-add.component';
import { RegisterComponent } from './auth/register/register.component';
import { LoginComponent } from './auth/login/login.component';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: '', component: RecipesListComponent, canActivate: [authGuard] },
    { path: 'add', component: RecipeAddComponent, canActivate: [authGuard] },
    { path: 'recipe/:id', component: RecipeDetailComponent, canActivate: [authGuard] },
    { path: 'recipe/:id/edit', component: RecipeDetailComponent, canActivate: [authGuard] },
    { path: '**', redirectTo: '' }
];
