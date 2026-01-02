import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test('should login with seeded user and access recipes', async ({ page }) => {
        // Navigate to the app - should redirect to login
        await page.goto('/');

        // Verify we're on the login page
        await expect(page).toHaveURL(/.*login/);

        // Fill in login form with seeded user credentials
        await page.getByLabel('Email').fill('test@example.com');
        await page.getByLabel('Password').fill('Test123!');

        // Click login button (submit button in form)
        await page.locator('button[type="submit"]').click();

        // Should redirect to recipes list after successful login
        await expect(page).toHaveURL('/');

        // Verify we can see the recipes list (assuming there are seeded recipes)
        await expect(page.getByText('Recipes')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto('/login');

        // Fill in invalid credentials
        await page.getByLabel('Email').fill('invalid@example.com');
        await page.getByLabel('Password').fill('wrongpassword');

        // Click login button (submit button in form)
        await page.locator('button[type="submit"]').click();

        // Should show error message
        await expect(page.getByText(/error|invalid|failed/i)).toBeVisible();
    });

    test('should logout and redirect to login page', async ({ page }) => {
        // First login
        await page.goto('/');

        // Should redirect to login
        await expect(page).toHaveURL(/.*login/);

        // Fill in login form
        await page.getByLabel('Email').fill('test@example.com');
        await page.getByLabel('Password').fill('Test123!');

        // Click login button
        await page.locator('button[type="submit"]').click();

        // Should redirect to recipes list
        await expect(page).toHaveURL('/');

        // Now click logout
        await page.getByText('Logout').click();

        // Should redirect to login page
        await expect(page).toHaveURL(/.*login/);
    });
});