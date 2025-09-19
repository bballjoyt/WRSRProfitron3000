using System.ComponentModel.DataAnnotations;

namespace GameDataOCR.API.Data.Entities;

public class Resource
{
    [Key]
    public string Name { get; set; } = string.Empty;

    public decimal NatoBuy { get; set; }
    public decimal NatoSell { get; set; }
    public decimal UssrBuy { get; set; }
    public decimal UssrSell { get; set; }

    public DateTime LastUpdated { get; set; }
}