Feature: Recipes

    Background:
        Given I am logged in with email "test@example.com" and password "Test123!"

    Scenario: Display recipes list
        Given I am on the recipes page
        Then I should see the recipes list
        And I should see recipe cards

    Scenario: Navigate to add recipe page
        Given I am on the recipes page
        When I click the "Add New Recipe" button
        Then I should be redirected to the add recipe page

    Scenario: Navigate to recipe details
        Given I am on the recipes page
        When I click the "View Details" button on the first recipe
        Then I should be redirected to the recipe detail page

    Scenario: Add a new recipe manually
        Given I am on the add recipe page
        When I fill in the recipe form with title "Test Recipe", description "A test recipe", and ingredients "1 cup flour, 2 eggs"
        And I click the "Add Recipe" button
        Then I should be redirected to the recipes page
        And I should see the new recipe "Test Recipe" in the list

    Scenario: Import recipe from website
        Given I am on the add recipe page
        When I click the "Import from Website" button
        And I enter URL "https://www.budgetbytes.com/creamy-garlic-chicken/" in the import dialog
        And I click the "Scrape Recipe" button
        Then I should see the scraped recipe content
        When I select an image and click "Import Recipe"
        Then I should be redirected to the recipes page
        And I should see the imported recipe in the list
        When I click the "View Details" button on the imported recipe
        Then I should be redirected to the recipe detail page
        And I should see the recipe image