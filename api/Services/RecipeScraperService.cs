using System.Net.Http;

namespace api.Services;

public class RecipeScraperService
{
    private readonly HttpClient _httpClient;
    private readonly LlmRecipeParserService _llmParser;

    public RecipeScraperService(HttpClient httpClient, LlmRecipeParserService llmParser)
    {
        _httpClient = httpClient;
        _llmParser = llmParser;
    }

    public async Task<ScrapedRecipeData> ScrapeRecipeAsync(string url)
    {
        // Fetch HTML content from the URL
        var html = await FetchHtmlAsync(url);

        // Use LLM to parse the recipe data from HTML
        return await _llmParser.ParseRecipeFromHtmlAsync(html, url);
    }

    private async Task<string> FetchHtmlAsync(string url)
    {
        try
        {
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync();
        }
        catch (HttpRequestException ex)
        {
            throw new Exception($"Failed to fetch HTML from {url}: {ex.Message}", ex);
        }
    }

}

public class ScrapedRecipeData
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<IngredientData> Ingredients { get; set; } = new();
    public List<string> Steps { get; set; } = new();
    public List<string> ImageUrls { get; set; } = new();
}

public class IngredientData
{
    public string Name { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
}