import { test, expect } from '@playwright/test';

test.describe('Recipes', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto('/login');
        await page.getByLabel('Email').fill('test@example.com');
        await page.getByLabel('Password').fill('Test123!');
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL('/');
    });

    test('should display recipes list', async ({ page }) => {
        // Verify recipes are loaded and displayed
        await expect(page.getByText('Recipes')).toBeVisible();

        // Check that we have recipe cards (assuming seeded data exists)
        const recipeCards = page.locator('.recipe-card');
        await expect(recipeCards.first()).toBeVisible();
    });

    test('should navigate to add recipe page', async ({ page }) => {
        // Click add new recipe button
        await page.getByRole('button', { name: 'Add New Recipe' }).click();

        // Should navigate to add page
        await expect(page).toHaveURL(/.*add/);
    });

    test('should navigate to recipe details', async ({ page }) => {
        // Click on first recipe's view details button
        await page.getByRole('button', { name: 'View Details' }).first().click();

        // Should navigate to recipe detail page
        await expect(page).toHaveURL(/.*recipe\/\d+/);
    });
});