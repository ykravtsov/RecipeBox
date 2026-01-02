using api.Data;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RecipesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly RecipeScraperService _scraperService;
    private readonly IFileStorageService _fileStorageService;

    public RecipesController(AppDbContext context, RecipeScraperService scraperService, IFileStorageService fileStorageService)
    {
        _context = context;
        _scraperService = scraperService;
        _fileStorageService = fileStorageService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Recipe>>> GetRecipes()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return await _context.Recipes.Where(r => r.UserId == userId).ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Recipe>> GetRecipe(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var recipe = await _context.Recipes.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
        if (recipe == null) return NotFound();
        return recipe;
    }

    [HttpPost]
    public async Task<ActionResult<Recipe>> PostRecipe(Recipe recipe)
    {
        recipe.UserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        _context.Recipes.Add(recipe);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetRecipe), new { id = recipe.Id }, recipe);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> PutRecipe(int id, Recipe recipe)
    {
        if (id != recipe.Id) return BadRequest();
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (recipe.UserId != userId) return Forbid();
        _context.Entry(recipe).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRecipe(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var recipe = await _context.Recipes.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
        if (recipe == null) return NotFound();
        _context.Recipes.Remove(recipe);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost]
    [Route("scrape-recipe")]
    public async Task<ActionResult<Recipe>> ScrapeRecipe([FromBody] ScrapeRequest request)
    {
        try
        {
            // Scrape the recipe data
            var scrapedData = await _scraperService.ScrapeRecipeAsync(request.Url);

            // Download and store the first image if available
            string? imageUrl = null;
            if (scrapedData.ImageUrls.Any())
            {
                try
                {
                    var storedImagePath = await _fileStorageService.UploadFileFromUrlAsync(scrapedData.ImageUrls.First());
                    imageUrl = _fileStorageService.GetFileUrl(storedImagePath);
                }
                catch (Exception ex)
                {
                    // Log error but continue without image
                    Console.WriteLine($"Failed to download image: {ex.Message}");
                }
            }

            // Convert scraped data to Recipe model
            var recipe = new Recipe
            {
                Title = scrapedData.Title,
                Description = scrapedData.Description,
                ImageUrl = imageUrl ?? "",
                Ingredients = scrapedData.Ingredients.Select(i => new Ingredient
                {
                    Name = i.Name,
                    Quantity = i.Quantity,
                    Unit = i.Unit
                }).ToList(),
                Steps = scrapedData.Steps
            };

            return recipe;
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to scrape recipe: {ex.Message}");
        }
    }
}

public class ScrapeRequest
{
    public string Url { get; set; } = string.Empty;
}