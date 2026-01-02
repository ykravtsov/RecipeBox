using api.Data;
using api.Models;
using Bogus;
using Microsoft.AspNetCore.Identity;

namespace api.Services;

public class DatabaseSeeder
{
    private readonly AppDbContext _context;
    private readonly UserManager<IdentityUser> _userManager;

    public DatabaseSeeder(AppDbContext context, UserManager<IdentityUser> userManager)
    {
        _context = context;
        _userManager = userManager;
    }

    public async Task SeedAsync()
    {
        // Seed test user
        var testUser = await _userManager.FindByEmailAsync("test@example.com");
        if (testUser == null)
        {
            testUser = new IdentityUser { UserName = "test@example.com", Email = "test@example.com" };
            await _userManager.CreateAsync(testUser, "Test123!");
            // Confirm the email so the user can sign in
            testUser.EmailConfirmed = true;
            await _userManager.UpdateAsync(testUser);
        }

        // Seed recipes using Bogus
        if (!_context.Recipes.Any())
        {
            var recipeFaker = new Faker<Recipe>()
                .RuleFor(r => r.Title, f => f.Lorem.Sentence(3, 5).TrimEnd('.'))
                .RuleFor(r => r.Description, f => f.Lorem.Sentence(10, 20))
                .RuleFor(r => r.ImageUrl, f => "")
                .RuleFor(r => r.UserId, testUser.Id)
                .RuleFor(r => r.Ingredients, f => new Faker<Ingredient>()
                    .RuleFor(i => i.Name, f => f.Commerce.ProductName())
                    .RuleFor(i => i.Quantity, f => f.Random.Decimal(0.5m, 5m))
                    .RuleFor(i => i.Unit, f => f.PickRandom(new[] { "cups", "tbsp", "tsp", "oz", "lbs", "pieces" }))
                    .Generate(f.Random.Int(3, 8)))
                .RuleFor(r => r.Steps, f => new Faker<string>()
                    .CustomInstantiator(f => f.Lorem.Sentence(8, 15))
                    .Generate(f.Random.Int(3, 6)));

            var recipes = recipeFaker.Generate(5);
            _context.Recipes.AddRange(recipes);
            await _context.SaveChangesAsync();
        }
    }
}