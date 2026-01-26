Feature: Authentication

    Scenario: Login with seeded user and access recipes
        Given I navigate to the app
        When I enter email "test@example.com" and password "Test123!"
        And I click the login button
        Then I should be redirected to the recipes page
        And I should see the recipes list

    Scenario: Show error for invalid credentials
        Given I am on the login page
        When I enter email "invalid@example.com" and password "wrongpassword"
        And I click the login button
        Then I should see an error message

    Scenario: Logout and redirect to login page
        Given I am logged in with email "test@example.com" and password "Test123!"
        When I click the logout button
        Then I should be redirected to the login page