using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace api.Models;

public class Recipe
{
    public int Id { get; set; }

    [Required]
    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string ImageUrl { get; set; } = string.Empty;

    public List<string> ImageUrls { get; set; } = new();

    [JsonIgnore]
    public string UserId { get; set; } = string.Empty;

    public List<Ingredient> Ingredients { get; set; } = new();

    public List<string> Steps { get; set; } = new();
}

public class Ingredient
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
}