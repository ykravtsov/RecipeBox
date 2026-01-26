using System.Net.Http;
using Microsoft.Extensions.Logging;

namespace api.Services;

public interface IRecipeScraperService
{
    Task<ScrapedRecipeData> ScrapeRecipeAsync(string url);
}

public class RecipeScraperService : IRecipeScraperService
{
    private readonly HttpClient _httpClient;
    private readonly LlmRecipeParserService _llmParser;
    private readonly ILogger<RecipeScraperService> _logger;

    public RecipeScraperService(HttpClient httpClient, LlmRecipeParserService llmParser, ILogger<RecipeScraperService> logger)
    {
        _httpClient = httpClient;
        _llmParser = llmParser;
        _logger = logger;
    }

    public virtual async Task<ScrapedRecipeData> ScrapeRecipeAsync(string url)
    {
        _logger.LogInformation("Starting to scrape recipe from URL: {Url}", url);

        try
        {
            // Fetch HTML content
            _logger.LogInformation("Fetching HTML from URL");
            var html = await FetchHtmlAsync(url);

            // Extract image URLs from HTML
            _logger.LogInformation("Extracting image URLs from HTML");
            var imageUrls = ExtractImageUrls(html, url);
            _logger.LogInformation("Extracted {ImageCount} image URLs", imageUrls.Count);

            // Use LLM to parse the recipe data from HTML
            _logger.LogInformation("Parsing recipe data using LLM from HTML");
            var result = await _llmParser.ParseRecipeFromHtmlAsync(html);
            result.ImageUrls = imageUrls; // Set the extracted image URLs
            _logger.LogInformation("LLM parsing completed. Title: {Title}, Ingredients: {IngredientCount}, Steps: {StepCount}",
                result.Title, result.Ingredients.Count, result.Steps.Count);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to scrape recipe from URL: {Url}", url);
            throw;
        }
    }

    private async Task<string> FetchHtmlAsync(string url)
    {
        const int maxRetries = 3;
        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                _logger.LogInformation("Attempt {Attempt}/{MaxRetries} to fetch HTML from {Url}", attempt, maxRetries, url);
                var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.UserAgent.ParseAdd("Mozilla/5.0 (compatible; RecipeScraper/1.0)");
                var response = await _httpClient.SendAsync(request);
                response.EnsureSuccessStatusCode();
                var content = await response.Content.ReadAsStringAsync();
                _logger.LogInformation("Successfully fetched HTML from {Url} on attempt {Attempt}, content length: {Length}",
                    url, attempt, content.Length);
                return content;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "Attempt {Attempt}/{MaxRetries} failed to fetch HTML from {Url}: {Message}",
                    attempt, maxRetries, url, ex.Message);
                if (attempt == maxRetries)
                {
                    _logger.LogError(ex, "All {MaxRetries} attempts failed to fetch HTML from {Url}", maxRetries, url);
                    throw new Exception($"Failed to fetch HTML from {url} after {maxRetries} attempts: {ex.Message}", ex);
                }
                // Wait before retry
                await Task.Delay(1000 * attempt);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error fetching HTML from {Url}: {Message}", url, ex.Message);
                throw;
            }
        }
        throw new Exception($"Failed to fetch HTML from {url} after {maxRetries} attempts");
    }

    private List<string> ExtractImageUrls(string html, string baseUrl)
    {
        var imageUrls = new List<string>();
        // Extract various image source attributes
        var regex = new System.Text.RegularExpressions.Regex(@"<img[^>]*(?:src|data-src|data-lazy-src|data-original|data-url)\s*=\s*[""']([^""']*)[""']", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        var matches = regex.Matches(html);
        var imageExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp" };
        foreach (System.Text.RegularExpressions.Match match in matches)
        {
            if (match.Groups.Count > 1)
            {
                var src = match.Groups[1].Value;
                // Filter out unwanted images (logos, icons, avatars, etc.) and check for image extensions
                if (!src.Contains("avatar") && !src.Contains("logo") && !src.Contains("icon") && !src.Contains("banner") && !src.Contains("header") && !src.Contains("footer") && src.Length > 10 &&
                    imageExtensions.Any(ext => src.EndsWith(ext, StringComparison.OrdinalIgnoreCase)))
                {
                    // Resolve relative URLs to absolute
                    var absoluteUrl = ResolveUrl(src, baseUrl);
                    if (!string.IsNullOrEmpty(absoluteUrl))
                    {
                        imageUrls.Add(absoluteUrl);
                    }
                }
            }
        }
        return imageUrls.Distinct().ToList();
    }

    private string ResolveUrl(string url, string baseUrl)
    {
        try
        {
            if (Uri.IsWellFormedUriString(url, UriKind.Absolute))
            {
                return url; // Already absolute
            }
            else if (Uri.IsWellFormedUriString(baseUrl, UriKind.Absolute))
            {
                var baseUri = new Uri(baseUrl);
                var resolvedUri = new Uri(baseUri, url);
                return resolvedUri.ToString();
            }
        }
        catch
        {
            // If resolution fails, return null
        }
        return null;
    }

    private string ExtractRecipeHtml(string html)
    {
        // Try to find the main recipe content
        // Look for common recipe containers
        var patterns = new[]
        {
            @"<div[^>]*class=""[^""]*recipe[^""]*""[^>]*>.*?</div>",
            @"<article[^>]*class=""[^""]*recipe[^""]*""[^>]*>.*?</article>",
            @"<section[^>]*class=""[^""]*recipe[^""]*""[^>]*>.*?</section>"
        };

        foreach (var pattern in patterns)
        {
            var regex = new System.Text.RegularExpressions.Regex(pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
            var match = regex.Match(html);
            if (match.Success)
            {
                _logger.LogInformation("Found recipe HTML using pattern: {Pattern}", pattern);
                return match.Value;
            }
        }

        // Fallback: look for ingredients and instructions sections
        var ingredientsMatch = System.Text.RegularExpressions.Regex.Match(html, @"<[^>]*>Ingredients?<[^>]*>.*?(?=<[^>]*>(?:Instructions?|Directions?|Steps?)<[^>]*>)", System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
        var instructionsMatch = System.Text.RegularExpressions.Regex.Match(html, @"<[^>]*>(?:Instructions?|Directions?|Steps?)<[^>]*>.*?(?=<[^>]*>|$)", System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);

        if (ingredientsMatch.Success || instructionsMatch.Success)
        {
            var start = ingredientsMatch.Success ? ingredientsMatch.Index : instructionsMatch.Index;
            var end = instructionsMatch.Success ? instructionsMatch.Index + instructionsMatch.Length : html.Length;
            var recipePart = html.Substring(start, end - start);
            _logger.LogInformation("Extracted recipe part from ingredients/instructions, length: {Length}", recipePart.Length);
            return recipePart;
        }

        // If no specific recipe section found, return the whole HTML
        _logger.LogWarning("No recipe section found, using full HTML");
        return html;
    }

}

public class ScrapedRecipeData
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<IngredientData> Ingredients { get; set; } = new();
    public List<string> Steps { get; set; } = new();
    public List<string> ImageUrls { get; set; } = new();
    public string RawResponse { get; set; } = string.Empty;
}

public class IngredientData
{
    public string Name { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
}