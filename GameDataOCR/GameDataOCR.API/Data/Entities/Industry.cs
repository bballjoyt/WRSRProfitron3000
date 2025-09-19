using System.ComponentModel.DataAnnotations;

namespace GameDataOCR.API.Data.Entities;

public class Industry
{
    [Key]
    public string Name { get; set; } = string.Empty;

    public DateTime LastUpdated { get; set; }

    public virtual ICollection<IndustrySectionEntity> Sections { get; set; } = new List<IndustrySectionEntity>();
}

public class IndustrySectionEntity
{
    public int Id { get; set; }
    public string SectionName { get; set; } = string.Empty;
    public List<string> Items { get; set; } = new();

    public string IndustryName { get; set; } = string.Empty;
    public virtual Industry Industry { get; set; } = null!;
}