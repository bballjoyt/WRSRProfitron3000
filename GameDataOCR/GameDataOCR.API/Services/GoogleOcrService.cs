using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using GameDataOCR.API.Models;
using System.Text.Json;
using System.Text;

namespace GameDataOCR.API.Services;

public class GoogleOcrService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly ILogger<GoogleOcrService> _logger;

    public GoogleOcrService(IConfiguration configuration, ILogger<GoogleOcrService> logger, HttpClient httpClient)
    {
        _apiKey = configuration["GoogleVision:ApiKey"] ?? throw new InvalidOperationException("Google Vision API key must be configured");
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<OcrResult> ProcessImageAsync(byte[] imageData, ImageType imageType)
    {
        try
        {
            var response = await CallGoogleVisionApi(imageData);

            if (response?.TextAnnotations == null || !response.TextAnnotations.Any())
            {
                return new OcrResult { Success = false, ErrorMessage = "No text found in image" };
            }

            var textElements = ExtractTextElements(response.TextAnnotations);
            var colorAnalysis = await AnalyzeTextColors(imageData, textElements);

            return imageType switch
            {
                ImageType.Industry => ProcessIndustryData(textElements, colorAnalysis),
                ImageType.Prices => ProcessPriceData(textElements),
                _ => new OcrResult { Success = false, ErrorMessage = "Unknown image type" }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process image with Google Vision OCR");
            return new OcrResult { Success = false, ErrorMessage = ex.Message };
        }
    }

    private async Task<GoogleVisionResponse?> CallGoogleVisionApi(byte[] imageData)
    {
        var url = $"https://vision.googleapis.com/v1/images:annotate?key={_apiKey}";

        var base64Image = Convert.ToBase64String(imageData);

        var request = new
        {
            requests = new[]
            {
                new
                {
                    image = new { content = base64Image },
                    features = new[] { new { type = "TEXT_DETECTION", maxResults = 100 } }
                }
            }
        };

        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync(url, content);
        var responseJson = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Google Vision API error: {ResponseJson}", responseJson);
            throw new HttpRequestException($"Google Vision API failed: {response.StatusCode}");
        }

        var result = JsonSerializer.Deserialize<GoogleVisionApiResponse>(responseJson, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        return result?.Responses?.FirstOrDefault();
    }

    private List<GoogleTextElement> ExtractTextElements(List<GoogleTextAnnotation> annotations)
    {
        var elements = new List<GoogleTextElement>();

        // Skip the first annotation as it's the full text
        foreach (var annotation in annotations.Skip(1))
        {
            if (annotation.BoundingPoly?.Vertices?.Count >= 4)
            {
                var vertices = annotation.BoundingPoly.Vertices;
                var minX = vertices.Min(v => v.X);
                var minY = vertices.Min(v => v.Y);
                var maxX = vertices.Max(v => v.X);
                var maxY = vertices.Max(v => v.Y);

                elements.Add(new GoogleTextElement
                {
                    Text = CleanOcrText(annotation.Description ?? ""),
                    X = minX,
                    Y = minY,
                    Width = maxX - minX,
                    Height = maxY - minY,
                    Confidence = annotation.Confidence ?? 0.9f
                });
            }
        }

        return elements.OrderBy(e => e.Y).ThenBy(e => e.X).ToList();
    }

    private async Task<Dictionary<string, bool>> AnalyzeTextColors(byte[] imageData, List<GoogleTextElement> textElements)
    {
        var colorAnalysis = new Dictionary<string, bool>();

        try
        {
            using var image = Image.Load<Rgb24>(imageData);

            foreach (var element in textElements)
            {
                var avgColor = GetAverageColorInRegion(image, element);
                var isRed = IsRedColor(avgColor);
                colorAnalysis[element.Text] = isRed;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to analyze text colors, defaulting to black text");
            foreach (var element in textElements)
            {
                colorAnalysis[element.Text] = false;
            }
        }

        return colorAnalysis;
    }

    private Rgb24 GetAverageColorInRegion(Image<Rgb24> image, GoogleTextElement element)
    {
        var x = Math.Max(0, element.X);
        var y = Math.Max(0, element.Y);
        var width = Math.Min(image.Width - x, element.Width);
        var height = Math.Min(image.Height - y, element.Height);

        if (width <= 0 || height <= 0) return new Rgb24(0, 0, 0);

        long totalR = 0, totalG = 0, totalB = 0;
        int pixelCount = 0;

        for (int py = y; py < y + height; py += 2)
        {
            for (int px = x; px < x + width; px += 2)
            {
                if (px < image.Width && py < image.Height)
                {
                    var pixel = image[px, py];
                    totalR += pixel.R;
                    totalG += pixel.G;
                    totalB += pixel.B;
                    pixelCount++;
                }
            }
        }

        if (pixelCount == 0) return new Rgb24(0, 0, 0);

        return new Rgb24(
            (byte)(totalR / pixelCount),
            (byte)(totalG / pixelCount),
            (byte)(totalB / pixelCount));
    }

    private bool IsRedColor(Rgb24 color)
    {
        return color.R > 120 && color.G < 80 && color.B < 80 && (color.R - color.G) > 40;
    }

    private OcrResult ProcessIndustryData(List<GoogleTextElement> textElements, Dictionary<string, bool> colorAnalysis)
    {
        var industryData = new IndustryData();
        var sections = new List<IndustrySection>();

        // Find the building name (first black text at the top)
        var buildingName = textElements.FirstOrDefault(e => !colorAnalysis.GetValueOrDefault(e.Text, false));
        if (buildingName != null)
        {
            industryData.Name = CleanOcrText(buildingName.Text);
        }

        // Group text by lines with better spacing detection
        var lines = GroupElementsIntoLines(textElements);
        IndustrySection? currentSection = null;

        foreach (var line in lines)
        {
            if (!line.Any()) continue;

            // Combine words in the line that are close together
            var combinedLine = CombineCloseWords(line);

            // Check for section headers - either red text with keywords OR strong header patterns
            var redElements = combinedLine.Where(e => colorAnalysis.GetValueOrDefault(e.Text, false)).ToList();
            var hasRedWithKeywords = redElements.Any() &&
                                    combinedLine.Any(e => IsLikelySectionHeader(e.Text));

            var hasStrongPattern = combinedLine.Any(e => IsStrongSectionHeader(e.Text));

            // Exclude obvious data items (numbers + units)
            var isDataItem = combinedLine.All(e => IsDataItem(e.Text));

            if ((hasRedWithKeywords || hasStrongPattern) && !isDataItem)
            {
                // Save previous section
                if (currentSection != null)
                {
                    sections.Add(currentSection);
                }

                // Get the full line text to properly handle colon separation
                var fullLineText = string.Join(" ", combinedLine.Select(e => e.Text));

                // Split at colon if present
                string sectionName;
                string? inlineItem = null;

                if (fullLineText.Contains(':'))
                {
                    var parts = fullLineText.Split(':', 2);
                    sectionName = parts[0].Trim();
                    if (parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1]))
                    {
                        inlineItem = parts[1].Trim();
                    }
                }
                else
                {
                    // Build section name from red text and header keywords
                    var sectionParts = new List<string>();

                    // Add red text
                    sectionParts.AddRange(redElements.Select(e => e.Text));

                    // Add header keywords that might not be red
                    var headerWords = combinedLine.Where(e =>
                        IsLikelySectionHeader(e.Text) &&
                        !redElements.Contains(e)).Select(e => e.Text);
                    sectionParts.AddRange(headerWords);

                    sectionName = string.Join(" ", sectionParts).Trim();
                }

                currentSection = new IndustrySection
                {
                    SectionName = CleanOcrText(sectionName),
                    Items = new List<string>()
                };

                // Add inline item if found after colon
                if (!string.IsNullOrWhiteSpace(inlineItem))
                {
                    currentSection.Items.Add(CleanOcrText(inlineItem));
                }
            }
            else if (currentSection != null)
            {
                // This is content for the current section - handle two-column layout
                var contentElements = combinedLine.Where(e => e.Text != buildingName?.Text).ToList();
                if (contentElements.Any())
                {
                    // Split into columns if there are multiple items on the same line
                    var columnItems = SplitIntoColumns(contentElements);

                    foreach (var item in columnItems)
                    {
                        if (!string.IsNullOrWhiteSpace(item))
                        {
                            currentSection.Items.Add(CleanOcrText(item));
                        }
                    }
                }
            }
        }

        // Add the last section
        if (currentSection != null)
        {
            sections.Add(currentSection);
        }

        industryData.Sections = sections;

        return new OcrResult
        {
            Success = true,
            IndustryData = industryData
        };
    }

    private List<GoogleTextElement> CombineCloseWords(List<GoogleTextElement> lineElements)
    {
        if (!lineElements.Any()) return lineElements;

        var combined = new List<GoogleTextElement>();
        var currentGroup = new List<GoogleTextElement> { lineElements.First() };

        for (int i = 1; i < lineElements.Count; i++)
        {
            var current = lineElements[i];
            var previous = lineElements[i - 1];

            // If words are close together (less than 20 pixels apart), combine them
            var distance = current.X - (previous.X + previous.Width);

            if (distance < 20)
            {
                currentGroup.Add(current);
            }
            else
            {
                // Create combined element from current group
                if (currentGroup.Count > 1)
                {
                    var combinedText = string.Join(" ", currentGroup.Select(e => e.Text));
                    var firstElement = currentGroup.First();
                    var lastElement = currentGroup.Last();

                    combined.Add(new GoogleTextElement
                    {
                        Text = combinedText,
                        X = firstElement.X,
                        Y = firstElement.Y,
                        Width = (lastElement.X + lastElement.Width) - firstElement.X,
                        Height = Math.Max(firstElement.Height, lastElement.Height),
                        Confidence = currentGroup.Average(e => e.Confidence)
                    });
                }
                else
                {
                    combined.Add(currentGroup.First());
                }

                currentGroup = new List<GoogleTextElement> { current };
            }
        }

        // Add the last group
        if (currentGroup.Count > 1)
        {
            var combinedText = string.Join(" ", currentGroup.Select(e => e.Text));
            var firstElement = currentGroup.First();
            var lastElement = currentGroup.Last();

            combined.Add(new GoogleTextElement
            {
                Text = combinedText,
                X = firstElement.X,
                Y = firstElement.Y,
                Width = (lastElement.X + lastElement.Width) - firstElement.X,
                Height = Math.Max(firstElement.Height, lastElement.Height),
                Confidence = currentGroup.Average(e => e.Confidence)
            });
        }
        else
        {
            combined.Add(currentGroup.First());
        }

        return combined;
    }

    private List<string> SplitIntoColumns(List<GoogleTextElement> elements)
    {
        if (elements.Count <= 1)
            return elements.Select(e => e.Text).ToList();

        var items = new List<string>();

        // Sort by X position to get left-to-right order
        var sortedElements = elements.OrderBy(e => e.X).ToList();

        // Look for significant gaps that indicate column separation
        var gaps = new List<(int index, int gap)>();
        for (int i = 1; i < sortedElements.Count; i++)
        {
            var current = sortedElements[i];
            var previous = sortedElements[i - 1];
            var gap = current.X - (previous.X + previous.Width);
            gaps.Add((i, gap));
        }

        // Find the largest gap - this likely separates columns
        if (gaps.Any())
        {
            var largestGap = gaps.OrderByDescending(g => g.gap).First();

            // If the gap is significantly larger than others (> 50 pixels), split here
            if (largestGap.gap > 50)
            {
                var leftColumn = sortedElements.Take(largestGap.index).ToList();
                var rightColumn = sortedElements.Skip(largestGap.index).ToList();

                // Combine each column into a single item
                if (leftColumn.Any())
                {
                    items.Add(string.Join(" ", leftColumn.Select(e => e.Text)));
                }
                if (rightColumn.Any())
                {
                    items.Add(string.Join(" ", rightColumn.Select(e => e.Text)));
                }

                return items;
            }
        }

        // No significant column separation found - treat as single item
        return new List<string> { string.Join(" ", sortedElements.Select(e => e.Text)) };
    }

    private List<List<GoogleTextElement>> GroupElementsIntoLines(List<GoogleTextElement> elements)
    {
        var lines = new List<List<GoogleTextElement>>();
        var currentLine = new List<GoogleTextElement>();
        var lastY = -1;
        const int lineThreshold = 15;

        foreach (var element in elements.OrderBy(e => e.Y).ThenBy(e => e.X))
        {
            if (lastY == -1 || Math.Abs(element.Y - lastY) < lineThreshold)
            {
                currentLine.Add(element);
            }
            else
            {
                if (currentLine.Any())
                {
                    lines.Add(currentLine.OrderBy(e => e.X).ToList());
                }
                currentLine = new List<GoogleTextElement> { element };
            }
            lastY = element.Y;
        }

        if (currentLine.Any())
        {
            lines.Add(currentLine.OrderBy(e => e.X).ToList());
        }

        return lines;
    }

    private bool IsLikelySectionHeader(string text)
    {
        var lowerText = text.ToLowerInvariant();
        return sectionKeywords.Any(keyword => lowerText.Contains(keyword)) || text.EndsWith(':');
    }

    private bool IsStrongSectionHeader(string text)
    {
        // These are strong indicators of section headers that should only appear in red text
        var strongHeaderKeywords = new[] {
            "resources needed", "needed to build", "maximum number", "number of workers",
            "building lifespan", "machines lifespan", "maximum production", "production per",
            "consumption at", "at maximum", "required water", "water quality",
            "daily garbage", "garbage production", "production per worker",
            "environment pollution", "power consumption", "max. power", "max. wattage",
            "circuit breaker", "daily water", "water consumption", "stations for",
            "vehicle loading", "loading/unloading", "warehouse", "import", "export",
            "garbage container"
        };

        var lowerText = text.ToLowerInvariant();
        return strongHeaderKeywords.Any(keyword => lowerText.Contains(keyword)) ||
               (text.Contains(':') && sectionKeywords.Any(keyword => lowerText.Contains(keyword)));
    }

    private readonly string[] sectionKeywords = new[] {
        "resources", "needed", "build", "workers", "maximum", "number",
        "building", "lifespan", "machines", "production", "workday",
        "consumption", "pollution", "power", "water", "wattage",
        "circuit", "breaker", "storage", "import", "export", "warehouse",
        "garbage", "container", "stations", "vehicle", "loading", "unloading",
        "required", "quality", "daily", "environment"
    };

    private bool IsDataItem(string text)
    {
        var lowerText = text.ToLowerInvariant();

        // Pattern: number + unit (like "1644 Workdays", "22t of Concrete", "6.0t of Alcohol")
        var numberUnitPattern = System.Text.RegularExpressions.Regex.IsMatch(text, @"^\d+[\.\d]*\s*(t|kg|m3|mwh|kw|tons|workdays|years|%)",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        // Pure numbers
        var isJustNumber = System.Text.RegularExpressions.Regex.IsMatch(text, @"^\d+[\.\d]*$");

        // Common data units/materials without section keywords
        var dataTerms = new[] { "workdays", "concrete", "gravel", "asphalt", "steel", "bricks", "boards",
                               "alcohol", "crops", "waste", "water", "power", "tons/year", "m3/day" };
        var isDataTerm = dataTerms.Any(term => lowerText.Contains(term)) &&
                        !sectionKeywords.Any(keyword => lowerText.Contains(keyword));

        return numberUnitPattern || isJustNumber || isDataTerm;
    }

    private OcrResult ProcessPriceData(List<GoogleTextElement> textElements)
    {
        var priceData = new PriceData();
        var items = new List<PriceItem>();

        var lines = GroupElementsIntoLines(textElements);

        // Skip header lines (Current prices, Resource:, Buy, Sell, etc.)
        var dataLines = lines.Where(line =>
            line.Any() &&
            !IsHeaderLine(line) &&
            ContainsNumericData(line)).ToList();

        foreach (var line in dataLines)
        {
            var processedLine = ProcessPriceLine(line);
            if (processedLine != null)
            {
                items.Add(processedLine);
            }
        }

        priceData.Items = items;

        return new OcrResult
        {
            Success = true,
            PriceData = priceData
        };
    }

    private bool IsHeaderLine(List<GoogleTextElement> line)
    {
        var lineText = string.Join(" ", line.Select(e => e.Text)).ToLowerInvariant();
        var headerKeywords = new[] { "current prices", "resource", "buy", "sell", "nato", "ussr", "economy", "trade" };
        return headerKeywords.Any(keyword => lineText.Contains(keyword));
    }

    private bool ContainsNumericData(List<GoogleTextElement> line)
    {
        // A valid data line should have at least one decimal number
        return line.Any(e => decimal.TryParse(CleanNumericText(e.Text), out _));
    }

    private PriceItem? ProcessPriceLine(List<GoogleTextElement> line)
    {
        if (!line.Any()) return null;

        // Sort elements by X position (left to right)
        var sortedElements = line.OrderBy(e => e.X).ToList();

        // Find the resource name (leftmost non-numeric elements)
        var resourceParts = new List<string>();
        var numericElements = new List<GoogleTextElement>();

        foreach (var element in sortedElements)
        {
            if (decimal.TryParse(CleanNumericText(element.Text), out _) ||
                element.Text.Contains('-') && element.Text.Length < 10)
            {
                numericElements.Add(element);
            }
            else if (numericElements.Count == 0) // Only add to resource name if we haven't hit numbers yet
            {
                resourceParts.Add(element.Text);
            }
        }

        if (!resourceParts.Any() || numericElements.Count < 4)
        {
            return null;
        }

        var item = new PriceItem
        {
            Resource = CleanOcrText(string.Join(" ", resourceParts).Trim().TrimEnd(':'))
        };

        // Parse the 4 numeric values (USSR Buy, USSR Sell, NATO Buy, NATO Sell)
        if (numericElements.Count >= 4)
        {
            if (decimal.TryParse(CleanNumericText(numericElements[0].Text), out var ussrBuy))
                item.UssrBuy = ussrBuy;
            if (decimal.TryParse(CleanNumericText(numericElements[1].Text), out var ussrSell))
                item.UssrSell = ussrSell;
            if (decimal.TryParse(CleanNumericText(numericElements[2].Text), out var natoBuy))
                item.NatoBuy = natoBuy;
            if (decimal.TryParse(CleanNumericText(numericElements[3].Text), out var natoSell))
                item.NatoSell = natoSell;
        }

        return item;
    }

    private string CleanNumericText(string text)
    {
        return text.Replace(",", "").Replace("$", "").Replace(" ", "").Trim();
    }

    private string CleanOcrText(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return "";

        // Remove common OCR artifacts and extra characters
        text = text.Trim();

        // Remove leading/trailing parentheses and brackets that are likely OCR errors
        text = System.Text.RegularExpressions.Regex.Replace(text, @"^[\)\]\}]+|[\(\[\{]+$", "");

        // Clean up spacing around punctuation
        text = System.Text.RegularExpressions.Regex.Replace(text, @"\s+([\.,:;])\s*", "$1 ");

        // Remove extra spaces
        text = System.Text.RegularExpressions.Regex.Replace(text, @"\s+", " ");

        // Fix common OCR character substitutions
        text = text.Replace(" . ", ". ")  // "Max . daily" -> "Max. daily"
                  .Replace(" / ", "/")    // "tons / year" -> "tons/year"
                  .Replace(" - ", "-")    // "Open - space" -> "Open-space"
                  .Replace("°", "")       // Remove degree symbols
                  .Trim();

        // Remove leading artifacts like ") " from ") 20"
        text = System.Text.RegularExpressions.Regex.Replace(text, @"^[\)\]\}]\s+", "");

        return text.Trim();
    }
}

public class GoogleTextElement
{
    public string Text { get; set; } = string.Empty;
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public float Confidence { get; set; }
}

// Google Vision API Response Models
public class GoogleVisionApiResponse
{
    public List<GoogleVisionResponse> Responses { get; set; } = new();
}

public class GoogleVisionResponse
{
    public List<GoogleTextAnnotation> TextAnnotations { get; set; } = new();
}

public class GoogleTextAnnotation
{
    public string? Description { get; set; }
    public GoogleBoundingPoly? BoundingPoly { get; set; }
    public float? Confidence { get; set; }
}

public class GoogleBoundingPoly
{
    public List<GoogleVertex> Vertices { get; set; } = new();
}

public class GoogleVertex
{
    public int X { get; set; }
    public int Y { get; set; }
}