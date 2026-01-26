const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Given('I navigate to the app', async function () {
    await this.page.goto('/');
});

Given('I am on the login page', async function () {
    await this.page.goto('/login');
});

When('I enter email {string} and password {string}', async function (email, password) {
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
});

When('I click the login button', async function () {
    await this.page.locator('button[type="submit"]').click();
});

Then('I should see the recipes list', async function () {
    await expect(this.page.getByText('Recipes')).toBeVisible();
});

Then('I should see an error message', async function () {
    await expect(this.page.getByText(/error|invalid|failed/i)).toBeVisible();
});

Given('I am logged in with email {string} and password {string}', async function (email, password) {
    await this.page.goto('/login', { timeout: 10000 });
    await this.page.waitForSelector('mat-card', { timeout: 10000 });
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.locator('button[type="submit"]').click();
    await expect(this.page).toHaveURL('/');
});

When('I click the logout button', async function () {
    await this.page.getByText('Logout').click();
});

Then('I should be redirected to the login page', async function () {
    await expect(this.page).toHaveURL(/.*login/);
});