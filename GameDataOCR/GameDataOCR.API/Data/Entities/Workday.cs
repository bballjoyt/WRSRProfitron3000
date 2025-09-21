using System.ComponentModel.DataAnnotations;

namespace GameDataOCR.API.Data.Entities;

public class Workday
{
    [Key]
    public string Name { get; set; } = "Workday";

    /// <summary>
    /// NATO buy price for workdays (cost per workday)
    /// </summary>
    public decimal NatoBuy { get; set; }

    /// <summary>
    /// USSR buy price for workdays (cost per workday)
    /// </summary>
    public decimal UssrBuy { get; set; }

    /// <summary>
    /// Workdays don't have sell prices, only buy prices (costs)
    /// </summary>
    public decimal NatoSell { get; set; } = 0;

    /// <summary>
    /// Workdays don't have sell prices, only buy prices (costs)
    /// </summary>
    public decimal UssrSell { get; set; } = 0;

    public DateTime LastUpdated { get; set; }
}