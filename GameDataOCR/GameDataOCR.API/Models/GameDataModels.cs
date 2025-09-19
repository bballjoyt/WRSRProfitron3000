namespace GameDataOCR.API.Models;

public class IndustryData
{
    public string Name { get; set; } = string.Empty;
    public List<IndustrySection> Sections { get; set; } = new();
}

public class IndustrySection
{
    public string SectionName { get; set; } = string.Empty;
    public List<string> Items { get; set; } = new();
}

public class PriceData
{
    public List<PriceItem> Items { get; set; } = new();
}

public class PriceItem
{
    public string Resource { get; set; } = string.Empty;
    public decimal NatoBuy { get; set; }
    public decimal NatoSell { get; set; }
    public decimal UssrBuy { get; set; }
    public decimal UssrSell { get; set; }
}

public class OcrResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public IndustryData? IndustryData { get; set; }
    public PriceData? PriceData { get; set; }
}

public enum ImageType
{
    Industry,
    Prices
}