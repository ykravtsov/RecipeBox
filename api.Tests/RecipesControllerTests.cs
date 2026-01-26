using api.Data;
using api.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using System.Text.Encodings.Web;
using Xunit;
using Moq;
using api.Services;
using Microsoft.AspNetCore.TestHost;

namespace api.Tests;

public class RecipesControllerTests : IClassFixture<RecipesWebApplicationFactory>
{
    private readonly RecipesWebApplicationFactory _factory;

    public RecipesControllerTests(RecipesWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private HttpClient CreateAuthenticatedClient()
    {
        var client = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = "TestScheme";
                    options.DefaultChallengeScheme = "TestScheme";
                })
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("TestScheme", o => { });
            });
        }).CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("TestScheme");
        return client;
    }

    [Fact]
    public async Task Get_Recipes_ReturnsSuccessAndCorrectContentType()
    {
        // Arrange
        var client = CreateAuthenticatedClient();

        // Act
        var response = await client.GetAsync("/api/recipes");

        // Assert
        response.EnsureSuccessStatusCode(); // Status Code 200-299
        Assert.Equal("application/json; charset=utf-8",
            response.Content.Headers.ContentType.ToString());
    }

    [Fact]
    public async Task Post_Recipe_ReturnsCreatedStatusCode()
    {
        // Arrange
        var client = CreateAuthenticatedClient();
        var newRecipe = new Recipe
        {
            Title = "Integration Test Recipe",
            Description = "Created during integration testing",
            UserId = "test-user-id",
            Ingredients = new List<Ingredient>
            {
                new Ingredient { Name = "Test Ingredient", Quantity = 1, Unit = "cup" }
            },
            Steps = new List<string> { "Step 1", "Step 2" }
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/recipes", newRecipe);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Get_RecipeById_ReturnsNotFound_WhenRecipeDoesNotExist()
    {
        // Arrange
        var client = CreateAuthenticatedClient();

        // Act
        var response = await client.GetAsync("/api/recipes/999");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Put_Recipe_ReturnsBadRequest_WhenIdMismatch()
    {
        // Arrange
        var client = CreateAuthenticatedClient();
        var recipe = new Recipe
        {
            Id = 1,
            Title = "Updated Recipe",
            UserId = "test-user-id",
            Ingredients = new List<Ingredient>(),
            Steps = new List<string> { "Updated Step" }
        };

        // Act
        var response = await client.PutAsJsonAsync("/api/recipes/2", recipe);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Delete_Recipe_ReturnsNotFound_WhenRecipeDoesNotExist()
    {
        // Arrange
        var client = CreateAuthenticatedClient();

        // Act
        var response = await client.DeleteAsync("/api/recipes/999");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Post_ScrapeRecipe_ReturnsBadRequest_WhenUrlIsInvalid()
    {
        // Arrange
        var client = CreateAuthenticatedClient();
        var scrapeRequest = new { Url = "invalid-url" };

        // Act
        var response = await client.PostAsJsonAsync("/api/recipes/scrape-recipe", scrapeRequest);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Post_ScrapeRecipe_ReturnsRecipe_WhenUrlIsValid()
    {
        // Arrange
        var mockScraper = new Mock<IRecipeScraperService>();
        mockScraper.Setup(s => s.ScrapeRecipeAsync(It.IsAny<string>())).ReturnsAsync(new ScrapedRecipeData
        {
            Title = "Test Recipe",
            Description = "Test Description",
            Ingredients = new List<IngredientData> { new IngredientData { Name = "Test Ingredient", Quantity = 1, Unit = "cup" } },
            Steps = new List<string> { "Step 1", "Step 2" },
            ImageUrls = new List<string>()
        });
        var mockFileStorage = new Mock<IFileStorageService>();

        var client = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = "TestScheme";
                    options.DefaultChallengeScheme = "TestScheme";
                })
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("TestScheme", o => { });
            });
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton(mockScraper.Object);
                services.AddSingleton(mockFileStorage.Object);
            });
        }).CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("TestScheme");

        var scrapeRequest = new { Url = "https://example.com/recipe" };

        // Act
        var response = await client.PostAsJsonAsync("/api/recipes/scrape-recipe", scrapeRequest);

        // Assert
        response.EnsureSuccessStatusCode();
        var recipe = await response.Content.ReadFromJsonAsync<Recipe>();
        Assert.NotNull(recipe);
        Assert.Equal("Test Recipe", recipe.Title);
        Assert.Equal("Test Description", recipe.Description);
        Assert.Single(recipe.Ingredients);
        Assert.Equal("Test Ingredient", recipe.Ingredients.First().Name);
        Assert.Equal(2, recipe.Steps.Count);
    }
}

public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger, UrlEncoder encoder) : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, "TestUser") };
        var identity = new ClaimsIdentity(claims, "Test");
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, "TestScheme");

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

public class RecipesWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            // Remove all DbContext registrations
            var dbContextDescriptors = services.Where(
                d => d.ServiceType == typeof(DbContextOptions<AppDbContext>)).ToList();

            foreach (var descriptor in dbContextDescriptors)
            {
                services.Remove(descriptor);
            }

            // Remove the AppDbContext service itself
            var appDbContextDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(AppDbContext));

            if (appDbContextDescriptor != null)
            {
                services.Remove(appDbContextDescriptor);
            }

            // Add DbContext using an in-memory database for testing
            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseInMemoryDatabase("InMemoryTestDb");
            });

            // Ensure MVC is configured
            services.AddControllers();
        });
    }
}
