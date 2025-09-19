using GameDataOCR.API.Services;
using GameDataOCR.API.Data;
using Microsoft.EntityFrameworkCore;
using DotNetEnv;

// Load environment variables from .env file
var envPath = Path.Combine(Directory.GetCurrentDirectory(), ".env");
Console.WriteLine($"Looking for .env file at: {envPath}");
Console.WriteLine($".env file exists: {File.Exists(envPath)}");
Env.Load(envPath);
Console.WriteLine($"After Env.Load() - CONNECTION_STRINGS__DEFAULTCONNECTION: {Environment.GetEnvironmentVariable("CONNECTION_STRINGS__DEFAULTCONNECTION")}");

var builder = WebApplication.CreateBuilder(args);

// Manually add the connection string from environment variable
var envConnectionString = Environment.GetEnvironmentVariable("CONNECTION_STRINGS__DEFAULTCONNECTION");
if (!string.IsNullOrEmpty(envConnectionString))
{
    builder.Configuration["ConnectionStrings:DefaultConnection"] = envConnectionString;
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add Entity Framework
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=gamedata.db";
Console.WriteLine($"Using connection string: {connectionString}");
Console.WriteLine($"Environment variable CONNECTION_STRINGS__DEFAULTCONNECTION: {Environment.GetEnvironmentVariable("CONNECTION_STRINGS__DEFAULTCONNECTION")}");
builder.Services.AddDbContext<GameDataContext>(options =>
    options.UseSqlite(connectionString));

builder.Services.AddScoped<AzureOcrService>();
builder.Services.AddScoped<GoogleOcrService>();
builder.Services.AddHttpClient();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<GameDataContext>();
    context.Database.EnsureCreated();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");
// Disable HTTPS redirection for development
// app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();