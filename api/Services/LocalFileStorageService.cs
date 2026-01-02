using Microsoft.AspNetCore.Http;
using System.Net.Http;

namespace api.Services;

public class LocalFileStorageService : IFileStorageService
{
    private readonly string _basePath;
    private readonly string _baseUrl;
    private readonly HttpClient _httpClient;

    public LocalFileStorageService(IConfiguration configuration, HttpClient httpClient)
    {
        _basePath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
        _baseUrl = configuration.GetValue<string>("FileStorage:BaseUrl") ?? "http://localhost:8080/uploads";
        _httpClient = httpClient;

        // Ensure directory exists
        Directory.CreateDirectory(_basePath);
    }

    public async Task<string> UploadFileAsync(IFormFile file, string folder = "images")
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException("File is required");

        var folderPath = Path.Combine(_basePath, folder);
        Directory.CreateDirectory(folderPath);

        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        var filePath = Path.Combine(folderPath, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return $"{folder}/{fileName}";
    }

    public async Task<string> UploadFileFromUrlAsync(string url, string folder = "images")
    {
        if (string.IsNullOrEmpty(url))
            throw new ArgumentException("URL is required");

        var folderPath = Path.Combine(_basePath, folder);
        Directory.CreateDirectory(folderPath);

        var response = await _httpClient.GetAsync(url);
        response.EnsureSuccessStatusCode();

        var contentType = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
        var extension = GetExtensionFromContentType(contentType);
        var fileName = $"{Guid.NewGuid()}{extension}";
        var filePath = Path.Combine(folderPath, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await response.Content.CopyToAsync(stream);
        }

        return $"{folder}/{fileName}";
    }

    public Task<bool> DeleteFileAsync(string filePath)
    {
        if (string.IsNullOrEmpty(filePath))
            return Task.FromResult(false);

        var fullPath = Path.Combine(_basePath, filePath.Replace("/", Path.DirectorySeparatorChar.ToString()));
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
            return Task.FromResult(true);
        }

        return Task.FromResult(false);
    }

    public string GetFileUrl(string filePath)
    {
        if (string.IsNullOrEmpty(filePath))
            return string.Empty;

        return $"{_baseUrl}/{filePath}";
    }

    private string GetExtensionFromContentType(string contentType)
    {
        return contentType.ToLower() switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/gif" => ".gif",
            "image/webp" => ".webp",
            _ => ".jpg"
        };
    }
}