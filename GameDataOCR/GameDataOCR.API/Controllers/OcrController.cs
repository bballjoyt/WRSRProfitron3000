using Microsoft.AspNetCore.Mvc;
using GameDataOCR.API.Models;
using GameDataOCR.API.Services;
using GameDataOCR.API.Data;
using GameDataOCR.API.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace GameDataOCR.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OcrController : ControllerBase
{
    private readonly AzureOcrService _azureOcrService;
    private readonly GoogleOcrService _googleOcrService;
    private readonly GameDataContext _context;

    public OcrController(AzureOcrService azureOcrService, GoogleOcrService googleOcrService, GameDataContext context)
    {
        _azureOcrService = azureOcrService;
        _googleOcrService = googleOcrService;
        _context = context;
    }

    [HttpPost("azure/process-industry")]
    public async Task<ActionResult<OcrResult>> ProcessIndustryImageAzure(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("No file uploaded");
        }

        if (!IsImageFile(file))
        {
            return BadRequest("File must be an image (PNG, JPG, JPEG)");
        }

        try
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            var imageData = stream.ToArray();

            var result = await _azureOcrService.ProcessImageAsync(imageData, ImageType.Industry);

            // Save to database if successful
            if (result.Success && result.IndustryData != null)
            {
                await SaveIndustryToDatabase(result.IndustryData);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new OcrResult
            {
                Success = false,
                ErrorMessage = $"Processing failed: {ex.Message}"
            });
        }
    }

    [HttpPost("azure/process-prices")]
    public async Task<ActionResult<OcrResult>> ProcessPricesImageAzure(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("No file uploaded");
        }

        if (!IsImageFile(file))
        {
            return BadRequest("File must be an image (PNG, JPG, JPEG)");
        }

        try
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            var imageData = stream.ToArray();

            var result = await _azureOcrService.ProcessImageAsync(imageData, ImageType.Prices);

            // Save to database if successful
            if (result.Success && result.PriceData != null)
            {
                await SavePricesToDatabase(result.PriceData);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new OcrResult
            {
                Success = false,
                ErrorMessage = $"Processing failed: {ex.Message}"
            });
        }
    }

    [HttpPost("azure/auto-detect")]
    public async Task<ActionResult<OcrResult>> AutoDetectAndProcessAzure(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("No file uploaded");
        }

        if (!IsImageFile(file))
        {
            return BadRequest("File must be an image (PNG, JPG, JPEG)");
        }

        try
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            var imageData = stream.ToArray();

            var imageType = DetectImageType(imageData);
            var result = await _azureOcrService.ProcessImageAsync(imageData, imageType);

            // Save to database if successful
            if (result.Success)
            {
                if (result.IndustryData != null)
                {
                    await SaveIndustryToDatabase(result.IndustryData);
                }
                if (result.PriceData != null)
                {
                    await SavePricesToDatabase(result.PriceData);
                }
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new OcrResult
            {
                Success = false,
                ErrorMessage = $"Processing failed: {ex.Message}"
            });
        }
    }

    private bool IsImageFile(IFormFile file)
    {
        var allowedExtensions = new[] { ".png", ".jpg", ".jpeg" };
        var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
        return allowedExtensions.Contains(fileExtension);
    }

    private ImageType DetectImageType(byte[] imageData)
    {
        using var stream = new MemoryStream(imageData);
        using var image = SixLabors.ImageSharp.Image.Load(stream);

        // Price data is typically wider (landscape)
        // Industry data is typically taller (portrait)
        if (image.Width > image.Height * 1.2)
        {
            return ImageType.Prices;
        }

        return ImageType.Industry;
    }

    private async Task SaveIndustryToDatabase(IndustryData industryData)
    {
        // Remove existing industry if it exists (overwrite)
        var existing = await _context.Industries
            .Include(i => i.Sections)
            .FirstOrDefaultAsync(i => i.Name == industryData.Name);

        if (existing != null)
        {
            _context.Industries.Remove(existing);
        }

        // Create new industry entity
        var industry = new Industry
        {
            Name = industryData.Name,
            LastUpdated = DateTime.UtcNow,
            Sections = industryData.Sections.Select(s => new IndustrySectionEntity
            {
                SectionName = s.SectionName,
                Items = s.Items
            }).ToList()
        };

        _context.Industries.Add(industry);
        await _context.SaveChangesAsync();
    }

    private async Task SavePricesToDatabase(PriceData priceData)
    {
        foreach (var priceItem in priceData.Items)
        {
            // Find existing resource or create new one
            var existing = await _context.Resources.FindAsync(priceItem.Resource);

            if (existing != null)
            {
                // Update existing resource (overwrite)
                existing.NatoBuy = priceItem.NatoBuy;
                existing.NatoSell = priceItem.NatoSell;
                existing.UssrBuy = priceItem.UssrBuy;
                existing.UssrSell = priceItem.UssrSell;
                existing.LastUpdated = DateTime.UtcNow;
            }
            else
            {
                // Create new resource
                var resource = new Resource
                {
                    Name = priceItem.Resource,
                    NatoBuy = priceItem.NatoBuy,
                    NatoSell = priceItem.NatoSell,
                    UssrBuy = priceItem.UssrBuy,
                    UssrSell = priceItem.UssrSell,
                    LastUpdated = DateTime.UtcNow
                };

                _context.Resources.Add(resource);
            }
        }

        await _context.SaveChangesAsync();
    }

    // Google Vision API Endpoints

    [HttpPost("google/process-industry")]
    public async Task<ActionResult<OcrResult>> ProcessIndustryImageGoogle(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("No file uploaded");
        }

        if (!IsImageFile(file))
        {
            return BadRequest("File must be an image (PNG, JPG, JPEG)");
        }

        try
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            var imageData = stream.ToArray();

            var result = await _googleOcrService.ProcessImageAsync(imageData, ImageType.Industry);

            // Save to database if successful
            if (result.Success && result.IndustryData != null)
            {
                await SaveIndustryToDatabase(result.IndustryData);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new OcrResult
            {
                Success = false,
                ErrorMessage = $"Processing failed: {ex.Message}"
            });
        }
    }

    [HttpPost("google/process-prices")]
    public async Task<ActionResult<OcrResult>> ProcessPricesImageGoogle(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("No file uploaded");
        }

        if (!IsImageFile(file))
        {
            return BadRequest("File must be an image (PNG, JPG, JPEG)");
        }

        try
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            var imageData = stream.ToArray();

            var result = await _googleOcrService.ProcessImageAsync(imageData, ImageType.Prices);

            // Save to database if successful
            if (result.Success && result.PriceData != null)
            {
                await SavePricesToDatabase(result.PriceData);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new OcrResult
            {
                Success = false,
                ErrorMessage = $"Processing failed: {ex.Message}"
            });
        }
    }

    [HttpPost("google/auto-detect")]
    public async Task<ActionResult<OcrResult>> AutoDetectAndProcessGoogle(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("No file uploaded");
        }

        if (!IsImageFile(file))
        {
            return BadRequest("File must be an image (PNG, JPG, JPEG)");
        }

        try
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            var imageData = stream.ToArray();

            var imageType = DetectImageType(imageData);
            var result = await _googleOcrService.ProcessImageAsync(imageData, imageType);

            // Save to database if successful
            if (result.Success)
            {
                if (result.IndustryData != null)
                {
                    await SaveIndustryToDatabase(result.IndustryData);
                }
                if (result.PriceData != null)
                {
                    await SavePricesToDatabase(result.PriceData);
                }
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new OcrResult
            {
                Success = false,
                ErrorMessage = $"Processing failed: {ex.Message}"
            });
        }
    }
}