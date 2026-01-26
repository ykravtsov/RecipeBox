import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [RouterModule, MatCardModule, MatButtonModule],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss'
})
export class WelcomeComponent implements OnInit {

  constructor(private meta: Meta, private title: Title) { }

  ngOnInit() {
    this.title.setTitle('RecipeBox - Organize and Share Your Recipes');
    this.meta.updateTag({ name: 'description', content: 'Discover, organize, and share your favorite recipes with RecipeBox. Import recipes from websites, add your own, and keep everything in one place.' });
  }

}
