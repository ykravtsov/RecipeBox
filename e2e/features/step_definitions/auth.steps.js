const { Given, When, Then } = require("@cucumber/cucumber");
const { expect } = require("@playwright/test");

const BASE_URL = process.env.BASE_URL || "http://localhost:4200";

Given("I navigate to the app", async function () {
  await this.page.goto(`${BASE_URL}/`);
});

Given("I am on the login page", { timeout: 30000 }, async function () {
  await this.page.goto(`${BASE_URL}/login`);
  await this.page.waitForSelector('form', { timeout: 20000 });
});

Given("I am on the register page", { timeout: 30000 }, async function () {
  await this.page.goto(`${BASE_URL}/register`);
  await this.page.waitForSelector('form', { timeout: 20000 });
});

When(
  "I enter email {string} and password {string}",
  async function (email, password) {
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
  },
);

When("I click the login button", async function () {
  await this.page.locator('button[type="submit"]').click();
});

When("I click the register button", async function () {
  await this.page.locator('button[type="submit"]').click();
});

Then("I should see the recipes list", async function () {
  await expect(this.page.getByText("My Box")).toBeVisible({ timeout: 10000 });
});

Then("I should see an error message", async function () {
  await expect(this.page.getByText(/error|invalid|failed|incorrect/i)).toBeVisible({ timeout: 10000 });
});

Given(
  "I am logged in with email {string} and password {string}",
  { timeout: 60000 },
  async function (email, password) {
    await this.page.goto(`${BASE_URL}/login`, { timeout: 30000 });
    await this.page.waitForSelector('form', { timeout: 30000 });
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.locator('button[type="submit"]').click();
    await expect(this.page).toHaveURL(/.*recipes/, { timeout: 15000 });
  },
);

When("I click the logout button", async function () {
  // Logout is a button containing a material icon with text "logout"
  await this.page.locator('button').filter({ hasText: /logout/i }).first().click();
});

Then("I should be redirected to the login page", async function () {
  // After logout, app navigates to '/' (welcome page) - check we are no longer on recipes
  await expect(this.page).not.toHaveURL(/.*recipes/, { timeout: 5000 });
});
