using System.Net.Http.Headers;
using System.Text.Json;

namespace api.Services;

public class LlmRecipeParserService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;

    public LlmRecipeParserService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _apiKey = configuration["Grok:ApiKey"] ?? throw new InvalidOperationException("Grok API key not configured");
    }

    public async Task<ScrapedRecipeData> ParseRecipeFromHtmlAsync(string html, string url)
    {
        var prompt = $@"You are a recipe extraction expert. Given the HTML content of a recipe webpage, extract the recipe information and return it as JSON.

URL: {url}

HTML Content:
{html}

Please extract the following information and return it as a JSON object with this exact structure:
{{
    ""title"": ""Recipe title"",
    ""description"": ""Brief description of the recipe"",
    ""ingredients"": [
        {{
            ""name"": ""ingredient name"",
            ""quantity"": 1.5,
            ""unit"": ""cups""
        }}
    ],
    ""steps"": [""Step 1"", ""Step 2"", ""Step 3""],
    ""imageUrls"": [""https://example.com/image1.jpg"", ""https://example.com/image2.jpg""]
}}

Rules:
- For ingredients, try to parse quantity and unit. If you can't determine quantity/unit, use quantity: 1 and unit: ""piece""
- Only include relevant recipe images (food photos, not ads or logos)
- If any field cannot be found, use appropriate defaults or empty arrays
- Make sure the JSON is valid and properly formatted

Return only the JSON object, no additional text or explanation.";

        var requestBody = new
        {
            messages = new[]
            {
                new
                {
                    role = "user",
                    content = prompt
                }
            },
            model = "grok-4-1-fast-reasoning",
            stream = false,
            temperature = 0.1
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.x.ai/v1/chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), System.Text.Encoding.UTF8, "application/json")
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

        try
        {
            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync();
            var grokResponse = JsonSerializer.Deserialize<GrokResponse>(responseContent);

            var jsonText = grokResponse?.Choices?[0]?.Message?.Content ?? "{}";

            var jsonData = JsonSerializer.Deserialize<JsonRecipeData>(jsonText, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return new ScrapedRecipeData
            {
                Title = jsonData?.Title ?? "Scraped Recipe",
                Description = jsonData?.Description ?? "Recipe imported from website",
                Ingredients = jsonData?.Ingredients?.Select(i => new IngredientData
                {
                    Name = i.Name ?? "Unknown ingredient",
                    Quantity = i.Quantity ?? 1,
                    Unit = i.Unit ?? "piece"
                }).ToList() ?? new List<IngredientData>(),
                Steps = jsonData?.Steps ?? new List<string>(),
                ImageUrls = jsonData?.ImageUrls ?? new List<string>()
            };
        }
        catch (Exception)
        {
            // Fallback if API call or JSON parsing fails
            return new ScrapedRecipeData
            {
                Title = "Scraped Recipe",
                Description = "Recipe imported from website",
                Ingredients = new List<IngredientData>(),
                Steps = new List<string>(),
                ImageUrls = new List<string>()
            };
        }
    }

    private class JsonRecipeData
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public List<JsonIngredientData>? Ingredients { get; set; }
        public List<string>? Steps { get; set; }
        public List<string>? ImageUrls { get; set; }
    }

    private class JsonIngredientData
    {
        public string? Name { get; set; }
        public decimal? Quantity { get; set; }
        public string? Unit { get; set; }
    }

    private class GrokResponse
    {
        public Choice[]? Choices { get; set; }
    }

    private class Choice
    {
        public Message? Message { get; set; }
    }

    private class Message
    {
        public string? Content { get; set; }
    }
}