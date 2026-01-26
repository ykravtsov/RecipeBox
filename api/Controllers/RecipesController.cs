using api.Data;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Security.Claims;
using System.Text.Json;

namespace api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RecipesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IRecipeScraperService _scraperService;
    private readonly IFileStorageService _fileStorageService;
    private readonly ILogger<RecipesController> _logger;

    public RecipesController(AppDbContext context, IRecipeScraperService scraperService, IFileStorageService fileStorageService, ILogger<RecipesController> logger)
    {
        _context = context;
        _scraperService = scraperService;
        _fileStorageService = fileStorageService;
        _logger = logger;
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
        _logger.LogInformation("ScrapeRecipe called with URL: {Url}", request.Url);
        try
        {
            // Scrape the recipe data
            _logger.LogInformation("About to call scraper service");
            var scrapedData = await _scraperService.ScrapeRecipeAsync(request.Url);
            _logger.LogInformation("Scraper service returned: Title={Title}", scrapedData.Title);

            if (scrapedData.Title == "Fallback Recipe")
            {
                _logger.LogWarning("Returning BadRequest due to fallback title");
                return BadRequest($"LLM parsing failed to extract recipe data from the URL. Raw response: {scrapedData.RawResponse}");
            }
            _logger.LogInformation("Scraped data for URL {Url}: Title={Title}, Images={ImageCount}", request.Url, scrapedData.Title, scrapedData.ImageUrls.Count);

            // Download and store the first image if available
            string? imageUrl = null;
            if (scrapedData.ImageUrls.Any())
            {
                try
                {
                    _logger.LogInformation("Attempting to download image from {ImageUrl}", scrapedData.ImageUrls.First());
                    var storedImagePath = await _fileStorageService.UploadFileFromUrlAsync(scrapedData.ImageUrls.First());
                    imageUrl = _fileStorageService.GetFileUrl(storedImagePath);
                    _logger.LogInformation("Image stored at {StoredPath}, URL: {ImageUrl}", storedImagePath, imageUrl);
                }
                catch (Exception ex)
                {
                    // Log error but continue without image
                    _logger.LogError(ex, "Failed to download image from {ImageUrl}", scrapedData.ImageUrls.First());
                }
            }
            else
            {
                _logger.LogWarning("No images found in scraped data for URL {Url}", request.Url);
            }

            // Convert scraped data to Recipe model
            var recipe = new Recipe
            {
                Title = scrapedData.Title,
                Description = scrapedData.Description,
                ImageUrl = imageUrl ?? "",
                ImageUrls = scrapedData.ImageUrls,
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
            _logger.LogError(ex, "Failed to scrape recipe from URL: {Url}", request.Url);
            return BadRequest("Could not complete the scrape. Please try again later.");
        }
    }
}

public class ScrapeRequest
{
    public string Url { get; set; } = string.Empty;
}