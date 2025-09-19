using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GameDataOCR.API.Data;
using GameDataOCR.API.Data.Entities;

namespace GameDataOCR.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GameDataController : ControllerBase
{
    private readonly GameDataContext _context;

    public GameDataController(GameDataContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Get price information for a specific resource
    /// </summary>
    [HttpGet("resources/{resourceName}")]
    public async Task<ActionResult<Resource>> GetResource(string resourceName)
    {
        var resource = await _context.Resources.FindAsync(resourceName);

        if (resource == null)
        {
            return NotFound($"Resource '{resourceName}' not found");
        }

        return Ok(resource);
    }

    /// <summary>
    /// Get all available resources with their prices
    /// </summary>
    [HttpGet("resources")]
    public async Task<ActionResult<List<Resource>>> GetAllResources()
    {
        var resources = await _context.Resources
            .OrderBy(r => r.Name)
            .ToListAsync();

        return Ok(resources);
    }

    /// <summary>
    /// Search for resources by name (partial match)
    /// </summary>
    [HttpGet("resources/search/{searchTerm}")]
    public async Task<ActionResult<List<Resource>>> SearchResources(string searchTerm)
    {
        var resources = await _context.Resources
            .Where(r => r.Name.ToLower().Contains(searchTerm.ToLower()))
            .OrderBy(r => r.Name)
            .ToListAsync();

        return Ok(resources);
    }

    /// <summary>
    /// Get industry information by name
    /// </summary>
    [HttpGet("industries/{industryName}")]
    public async Task<ActionResult<Industry>> GetIndustry(string industryName)
    {
        var industry = await _context.Industries
            .Include(i => i.Sections)
            .FirstOrDefaultAsync(i => i.Name == industryName);

        if (industry == null)
        {
            return NotFound($"Industry '{industryName}' not found");
        }

        return Ok(industry);
    }

    /// <summary>
    /// Get all available industries
    /// </summary>
    [HttpGet("industries")]
    public async Task<ActionResult<List<Industry>>> GetAllIndustries()
    {
        var industries = await _context.Industries
            .Include(i => i.Sections)
            .OrderBy(i => i.Name)
            .ToListAsync();

        return Ok(industries);
    }

    /// <summary>
    /// Get buy price for a resource in specified currency
    /// </summary>
    [HttpGet("resources/{resourceName}/buy/{currency}")]
    public async Task<ActionResult<decimal>> GetBuyPrice(string resourceName, string currency)
    {
        var resource = await _context.Resources.FindAsync(resourceName);

        if (resource == null)
        {
            return NotFound($"Resource '{resourceName}' not found");
        }

        var price = currency.ToUpper() switch
        {
            "NATO" => resource.NatoBuy,
            "USSR" => resource.UssrBuy,
            _ => throw new ArgumentException("Currency must be 'NATO' or 'USSR'")
        };

        return Ok(new { Resource = resourceName, Currency = currency.ToUpper(), BuyPrice = price });
    }

    /// <summary>
    /// Get sell price for a resource in specified currency
    /// </summary>
    [HttpGet("resources/{resourceName}/sell/{currency}")]
    public async Task<ActionResult<decimal>> GetSellPrice(string resourceName, string currency)
    {
        var resource = await _context.Resources.FindAsync(resourceName);

        if (resource == null)
        {
            return NotFound($"Resource '{resourceName}' not found");
        }

        var price = currency.ToUpper() switch
        {
            "NATO" => resource.NatoSell,
            "USSR" => resource.UssrSell,
            _ => throw new ArgumentException("Currency must be 'NATO' or 'USSR'")
        };

        return Ok(new { Resource = resourceName, Currency = currency.ToUpper(), SellPrice = price });
    }

    /// <summary>
    /// Calculate profitability for resources that an industry produces vs consumes
    /// </summary>
    [HttpGet("industries/{industryName}/profitability/{currency}")]
    public async Task<ActionResult> CalculateProfitability(string industryName, string currency)
    {
        var industry = await _context.Industries
            .Include(i => i.Sections)
            .FirstOrDefaultAsync(i => i.Name == industryName);

        if (industry == null)
        {
            return NotFound($"Industry '{industryName}' not found");
        }

        var result = new
        {
            Industry = industryName,
            Currency = currency.ToUpper(),
            Analysis = "Profitability calculation would analyze production outputs vs consumption inputs using current market prices"
        };

        return Ok(result);
    }

    /// <summary>
    /// Clear all resources from the database
    /// </summary>
    [HttpDelete("resources")]
    public async Task<ActionResult> ClearAllResources()
    {
        var count = await _context.Resources.CountAsync();
        _context.Resources.RemoveRange(_context.Resources);
        await _context.SaveChangesAsync();

        return Ok(new { Message = $"Cleared {count} resources from database" });
    }

    /// <summary>
    /// Clear all industries from the database
    /// </summary>
    [HttpDelete("industries")]
    public async Task<ActionResult> ClearAllIndustries()
    {
        var count = await _context.Industries.CountAsync();
        _context.Industries.RemoveRange(_context.Industries);
        await _context.SaveChangesAsync();

        return Ok(new { Message = $"Cleared {count} industries from database" });
    }

    /// <summary>
    /// Clear all data (resources and industries) from the database
    /// </summary>
    [HttpDelete("all")]
    public async Task<ActionResult> ClearAllData()
    {
        var resourceCount = await _context.Resources.CountAsync();
        var industryCount = await _context.Industries.CountAsync();

        _context.Resources.RemoveRange(_context.Resources);
        _context.Industries.RemoveRange(_context.Industries);
        await _context.SaveChangesAsync();

        return Ok(new {
            Message = $"Cleared all data from database",
            ResourcesCleared = resourceCount,
            IndustriesCleared = industryCount
        });
    }

    /// <summary>
    /// Delete a specific resource by name
    /// </summary>
    [HttpDelete("resources/{resourceName}")]
    public async Task<ActionResult> DeleteResource(string resourceName)
    {
        var resource = await _context.Resources.FindAsync(resourceName);

        if (resource == null)
        {
            return NotFound($"Resource '{resourceName}' not found");
        }

        _context.Resources.Remove(resource);
        await _context.SaveChangesAsync();

        return Ok(new { Message = $"Deleted resource '{resourceName}'" });
    }

    /// <summary>
    /// Delete a specific industry by name
    /// </summary>
    [HttpDelete("industries/{industryName}")]
    public async Task<ActionResult> DeleteIndustry(string industryName)
    {
        var industry = await _context.Industries
            .Include(i => i.Sections)
            .FirstOrDefaultAsync(i => i.Name == industryName);

        if (industry == null)
        {
            return NotFound($"Industry '{industryName}' not found");
        }

        _context.Industries.Remove(industry);
        await _context.SaveChangesAsync();

        return Ok(new { Message = $"Deleted industry '{industryName}'" });
    }
}