using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace api.Services;

public class LlmRecipeParserService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly ILogger<LlmRecipeParserService> _logger;

    public LlmRecipeParserService(HttpClient httpClient, IConfiguration configuration, ILogger<LlmRecipeParserService> logger)
    {
        _httpClient = httpClient;
        _apiKey = configuration["Grok:ApiKey"] ?? throw new InvalidOperationException("Grok API key not configured");
        _logger = logger;
    }

    public async Task<ScrapedRecipeData> ParseRecipeFromHtmlAsync(string html)
    {
        _logger.LogInformation("ParseRecipeFromHtmlAsync called with HTML length: {Length}", html.Length);
        var prompt = $@"You are a recipe extraction expert. Extract the recipe information from the following HTML content and return it as JSON.

HTML Content:
{html}

Please extract the following information from the recipe HTML and return it as a JSON object with this exact structure:
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
    ""steps"": [""Step 1"", ""Step 2"", ""Step 3""]
}}

Rules:
- For ingredients, try to parse quantity and unit. If you can't determine quantity/unit, use quantity: 1 and unit: ""piece""
- If any field cannot be found, use appropriate defaults or empty arrays
- Make sure the JSON is valid and properly formatted

Return only the JSON object, no additional text or explanation.";
        _logger.LogInformation("Sending request to Grok API for HTML parsing");

        var requestBody = new
        {
            messages = new[]
            {
                new
                {
                    role = "system",
                    content = "You are a recipe parser. Output strictly valid JSON. No markdown. No conversational text."
                },
                new
                {
                    role = "user",
                    content = prompt
                }
            },
            model = "grok-4-1-fast-reasoning",
            stream = false,
            temperature = 0.1,
            response_format = new { type = "json_object" }
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.x.ai/v1/chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), System.Text.Encoding.UTF8, "application/json")
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

        try
        {
            var response = await _httpClient.SendAsync(request);
            var responseContent = await response.Content.ReadAsStringAsync();
            _logger.LogInformation("Grok API response status: {Status}, content length: {Length}", response.StatusCode, responseContent.Length);
            _logger.LogInformation("Full Grok API response: {Response}", responseContent);
            response.EnsureSuccessStatusCode();

            // Parse as GrokResponse
            var grokResponse = JsonSerializer.Deserialize<GrokResponse>(responseContent, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            var jsonText = grokResponse?.Choices?[0]?.Message?.Content ?? "{}";
            _logger.LogInformation("Raw LLM response JSON length: {Length}", jsonText.Length);
            jsonText = CleanJsonString(jsonText);
            string rawResponse = jsonText;
            _logger.LogInformation("Deserializing jsonText to JsonRecipeData");
            var jsonData = JsonSerializer.Deserialize<JsonRecipeData>(jsonText, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            _logger.LogInformation("Deserialization succeeded, jsonData.Title: {Title}", jsonData?.Title);
            _logger.LogInformation("Deserialized JSON data: Title='{Title}', Description='{Description}', IngredientsCount={IngredientsCount}, StepsCount={StepsCount}", jsonData?.Title, jsonData?.Description, jsonData?.Ingredients?.Count, jsonData?.Steps?.Count);

            var result = new ScrapedRecipeData
            {
                Title = jsonData?.Title ?? "Fallback Recipe",
                Description = jsonData?.Description ?? "Recipe imported from website",
                Ingredients = jsonData?.Ingredients?.Select(i => new IngredientData
                {
                    Name = i.Name ?? "Unknown ingredient",
                    Quantity = i.Quantity ?? 1,
                    Unit = i.Unit ?? "piece"
                }).ToList() ?? new List<IngredientData>(),
                Steps = jsonData?.Steps ?? new List<string>(),
                ImageUrls = new List<string>(), // Will be set separately
                RawResponse = rawResponse
            };
            _logger.LogInformation("Returning ScrapedRecipeData with Title: {Title}", result.Title);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse recipe from HTML using LLM API");
            throw new Exception("Failed to parse recipe from HTML", ex);
        }
    }

    private static string CleanJsonString(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        // Remove markdown wrappers
        var cleaned = raw.Replace("```json", "").Replace("```", "").Trim();
        // Extract logic between the first and last brace
        int first = cleaned.IndexOf('{');
        int last = cleaned.LastIndexOf('}');
        return (first >= 0 && last > first) ? cleaned.Substring(first, last - first + 1) : cleaned;
    }

    private class JsonRecipeData
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public List<JsonIngredientData>? Ingredients { get; set; }
        public List<string>? Steps { get; set; }
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