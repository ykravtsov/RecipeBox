import { Component, OnInit, OnDestroy } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { MealService, Meal } from '../services/meal.service';
import { Recipe } from '../models/recipe';

@Component({
    standalone: true,
    selector: 'app-meal',
    imports: [MatCardModule, MatButtonModule, MatIconModule, MatListModule, MatDialogModule],
    templateUrl: './meal.component.html',
    styleUrl: './meal.component.scss'
})
export class MealComponent implements OnInit, OnDestroy {
  meal: Meal = {
    recipes: [],
    totalPrepTime: 0,
    totalCookTime: 0,
    aggregatedIngredients: []
  };
  private subscription: Subscription = new Subscription();

  constructor(private mealService: MealService, private dialog: MatDialog) { }

  ngOnInit(): void {
    this.subscription = this.mealService.currentMeal$.subscribe(meal => {
      this.meal = meal;
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  removeRecipe(recipeId: string): void {
    this.mealService.removeRecipe(recipeId);
  }

  clearMeal(): void {
    this.mealService.clearMeal();
  }

  scheduleMeal(): void {
    // Will implement calendar integration
    this.openScheduleDialog();
  }

  private openScheduleDialog(): void {
    // Placeholder for dialog - improved to use properties instead of prompts
    const dateTime = '2023-12-01T12:00'; // placeholder
    const calendar = 'google'; // placeholder
    this.generateCalendarLink(dateTime, calendar);
  }

  private generateCalendarLink(dateTime: string, calendar: string): void {
    const title = this.meal.recipes.map(r => r.title).join(' & ');
    const description = `Ingredients: ${this.meal.aggregatedIngredients.map(i => `${i.quantity} ${i.unit} ${i.name}`).join(', ')}`;
    const url = 'http://localhost:4200'; // Placeholder

    let link = '';
    if (calendar.toLowerCase() === 'google') {
      link = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dateTime.replace(/[:-]/g, '')}/${dateTime.replace(/[:-]/g, '')}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(url)}`;
    } else if (calendar.toLowerCase() === 'outlook') {
      link = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(description)}&startdt=${dateTime}&enddt=${dateTime}`;
    } else if (calendar.toLowerCase() === 'apple') {
      link = `webcal://`; // Apple calendar link format
    }

    if (link) {
      window.open(link, '_blank');
    }
  }
}
