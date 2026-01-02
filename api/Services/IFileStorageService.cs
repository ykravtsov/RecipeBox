using Microsoft.AspNetCore.Http;

namespace api.Services;

public interface IFileStorageService
{
    Task<string> UploadFileAsync(IFormFile file, string folder = "images");
    Task<string> UploadFileFromUrlAsync(string url, string folder = "images");
    Task<bool> DeleteFileAsync(string filePath);
    string GetFileUrl(string filePath);
}