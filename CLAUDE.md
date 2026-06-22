# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DonutSMP-Tracker is an ASP.NET Core 10 web app that tracks auction house transactions on the DonutSMP Minecraft server. It continuously polls the DonutSMP REST API, stores price history in SQLite, and serves a single-page dashboard with price analytics, seller leaderboards, and a recipe cost calculator.

## Commands

```bash
# Build
dotnet build

# Run (from repo root)
dotnet run --project DonutSMP.csproj

# Run with environment override
dotnet run --project DonutSMP.csproj --environment Development

# Publish
dotnet publish DonutSMP.csproj -c Release

# Docker
docker build -t donutsmp-tracker .
docker run -p 8080:8080 -p 8081:8081 donutsmp-tracker
```

Local configuration goes in `appsettings.Local.json` (gitignored). The DonutSMP API key belongs there, not in `appsettings.json`.

## Architecture

The solution has two projects:

- **DonutSMP/** — ASP.NET Core host: `Program.cs`, `Controllers/`, `wwwroot/`
- **Application/** — Class library with all business logic and data access

### Data flow

1. `PriceSystem` (a `BackgroundService`) starts on boot, loads the last 7 days of records into memory, then polls the DonutSMP API every 250ms.
2. Each transaction is deduplicated by a composite key (`unixMillisDateSold:seller.uuid:item.id`), priced by `totalPrice / amount`, and fed into `PriceService`.
3. `PriceService` keeps an in-memory rolling window of the last 1000 price records per item and the last 20 live sales. It also persists to SQLite via `IDbContextFactory<DonutDbContext>`.
4. Controllers read from `PriceService` (in-memory); writes (overrides, recipes, manual items) go straight to the DB.

### Key components

| Component | Location | Role |
|-----------|----------|------|
| `PriceSystem` | `Application/Business/Prices/PriceSystem.cs` | Background polling & persistence |
| `PriceService` | `Application/Business/Prices/PriceService.cs` | In-memory cache & aggregation |
| `AuctionHouse` | `Application/API/AuctionHouse.cs` | HTTP client for DonutSMP API |
| `DonutDbContext` | `Application/Data/DonutDbContext.cs` | EF Core context (SQLite) |
| `PricesController` | `Controllers/PricesController.cs` | REST API for prices, overrides, manual items |
| `RecipesController` | `Controllers/RecipesController.cs` | REST CRUD for recipes |
| `wwwroot/js/app.js` | `wwwroot/js/app.js` | Entire frontend (vanilla JS, no build step) |

### Database

SQLite file: `donut.db` (created on startup via EF migrations). Five tables:

- **PriceRecords** — transaction history; per-item cap 1000 rows, max 7-day TTL
- **ProcessedTransactions** — dedup cache keyed on transaction composite ID
- **PriceOverrides** — user-set price overrides (PK: ItemName)
- **ManualItems** — items tracked by the user before they appear on the market
- **Recipes** — crafting recipes; ingredients stored as a JSON string column

### Frontend

No build step — plain HTML/JS/CSS served from `wwwroot/`. Dependencies loaded from CDN (Bootstrap 5.3.3, Chart.js 4.4.3). All logic lives in `app.js` as a single-page app with four tabs: All Items, Top Sellers, Live Sales, Recipes.

## Configuration

`appsettings.json` → `DonutApi` section:

```json
{
  "DonutApi": {
    "ApiKey": "",
    "BaseUrl": "https://api.donutsmp.net",
    "TransactionCount": 10,
    "PinnedSellers": ["lee_vgs"]
  }
}
```

`PinnedSellers` always appear at the top of the sellers leaderboard.

## Notable conventions

- Item name lookups are case-insensitive (`StringComparer.OrdinalIgnoreCase`).
- DTOs use C# `record` types; database entities are regular classes in `Application/Data/Entities.cs`.
- Recipe ingredients are serialized as JSON inside a single `string` DB column.
- The budget input in the recipe tab accepts shorthand notation: `10k`, `5M`, `1B`.
- Price history chart groups transactions into 10-second buckets for readability.
