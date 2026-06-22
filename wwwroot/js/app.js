let allItems = [];
let sortCol = 'name';
let sortAsc = true;
let activeChart = null;
const chartModal = new bootstrap.Modal(document.getElementById('chartModal'));

document.getElementById('chartModal').addEventListener('hidden.bs.modal', () => {
    if (activeChart) { activeChart.destroy(); activeChart = null; }
});

function formatName(id) {
    return id.replace(/^minecraft:/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmt(n) {
    if (n < 0) return '—';
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

async function loadItems() {
    try {
        const res = await fetch('/api/prices');
        allItems = await res.json();
        document.getElementById('lastUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString();
        updateStats();
        render();
        const dl = document.getElementById('itemsList');
        dl.innerHTML = allItems.map(i => `<option value="${i.name}">${formatName(i.name)}</option>`).join('');
    } catch {
        document.getElementById('itemsBody').innerHTML =
            '<tr><td colspan="6" class="text-center text-muted py-4">Failed to load data.</td></tr>';
    }
}

function updateStats() {
    const totalSales = allItems.reduce((s, i) => s + i.recordCount, 0);
    const totalVolume = allItems.reduce((s, i) => s + Math.max(0, i.amountRecorded), 0);
    document.getElementById('statItems').textContent = allItems.length.toLocaleString();
    document.getElementById('statSales').textContent = totalSales.toLocaleString();
    document.getElementById('statVolume').textContent = totalVolume.toLocaleString();
}

function render() {
    const query = document.getElementById('search').value.toLowerCase();
    let items = allItems.filter(i =>
        formatName(i.name).toLowerCase().includes(query) || i.name.toLowerCase().includes(query)
    );

    items.sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (sortCol === 'name') { va = formatName(va); vb = formatName(vb); }
        if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortAsc ? va - vb : vb - va;
    });

    const body = document.getElementById('itemsBody');
    if (items.length === 0) {
        body.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No items found.</td></tr>';
        return;
    }

    body.innerHTML = items.map(i => `
        <tr data-id="${i.name}" onclick="showChart('${i.name}')">
            <td class="fw-medium">${formatName(i.name)}</td>
            <td>${fmt(i.averagePrice)}</td>
            <td class="text-profit">${fmt(i.minPrice)}</td>
            <td>${fmt(i.maxPrice)}</td>
            <td>${i.amountRecorded < 0 ? '—' : i.amountRecorded.toLocaleString()}</td>
            <td>${i.recordCount}</td>
            <td onclick="event.stopPropagation()">
                ${i.overridePrice != null
                    ? `<span class="text-warning fw-semibold">${fmt(i.overridePrice)}</span>`
                    : '<span class="text-muted small">—</span>'}
                <button class="btn btn-sm btn-icon btn-outline-secondary ms-1"
                    onclick="editOverride('${i.name}')">
                    <i class="bi bi-pencil-square"></i>
                </button>
                <button class="btn btn-sm btn-icon btn-outline-secondary ms-1"
                    onclick="showOverrideHistory('${i.name}')" title="Override history">
                    <i class="bi bi-clock-history"></i>
                </button>
                <button class="btn btn-sm btn-icon btn-outline-danger ms-1"
                    onclick="removeItem('${i.name}')">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

document.getElementById('search').addEventListener('input', render);

document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (sortCol === col) sortAsc = !sortAsc;
        else { sortCol = col; sortAsc = true; }
        document.querySelectorAll('th.sortable i').forEach(i => i.className = 'bi bi-arrow-down-up ms-1');
        th.querySelector('i').className = `bi bi-arrow-${sortAsc ? 'up' : 'down'} ms-1`;
        render();
    });
});

function groupHistory(history, gapSeconds = 10) {
    if (history.length === 0) return [];
    const sorted = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const buckets = [];
    let bucket = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
        const gap = new Date(sorted[i].timestamp) - new Date(sorted[i - 1].timestamp);
        if (gap <= gapSeconds * 1000) bucket.push(sorted[i]);
        else { buckets.push(bucket); bucket = [sorted[i]]; }
    }
    buckets.push(bucket);
    return buckets.map(b => {
        const times = b.map(p => +new Date(p.timestamp));
        const prices = b.map(p => p.price);
        return {
            x: new Date((Math.min(...times) + Math.max(...times)) / 2),
            min: Math.min(...prices),
            max: Math.max(...prices),
            avg: prices.reduce((s, p) => s + p, 0) / prices.length
        };
    });
}

async function showChart(itemId) {
    document.getElementById('chartTitle').textContent = formatName(itemId) + ' — Price History';
    chartModal.show();

    const res = await fetch(`/api/prices/${encodeURIComponent(itemId)}/history`);
    const history = await res.json();
    const grouped = groupHistory(history);

    if (activeChart) { activeChart.destroy(); activeChart = null; }

    activeChart = new Chart(document.getElementById('priceChart'), {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Max',
                    data: grouped.map(p => ({ x: p.x, y: p.max })),
                    borderColor: '#dc2626',
                    borderWidth: 1.5,
                    borderDash: [4, 3],
                    pointRadius: 2,
                    fill: { target: 2, above: 'rgba(148,163,184,0.12)' },
                    tension: 0.3
                },
                {
                    label: 'Avg',
                    data: grouped.map(p => ({ x: p.x, y: p.avg })),
                    borderColor: '#e8590c',
                    borderWidth: 2.5,
                    pointRadius: 3,
                    fill: false,
                    tension: 0.3
                },
                {
                    label: 'Min',
                    data: grouped.map(p => ({ x: p.x, y: p.min })),
                    borderColor: '#16a34a',
                    borderWidth: 1.5,
                    borderDash: [4, 3],
                    pointRadius: 2,
                    fill: false,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { type: 'time', time: { tooltipFormat: 'MMM d, HH:mm:ss' }, grid: { color: '#e2e8f0' } },
                y: { grid: { color: '#e2e8f0' }, ticks: { callback: v => fmt(v) } }
            },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } }
            }
        }
    });
}

let liveInterval = null;

function switchTab(tab, btn) {
    document.querySelectorAll('.nav-tabs .nav-link').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-items').classList.toggle('d-none', tab !== 'items');
    document.getElementById('tab-sellers').classList.toggle('d-none', tab !== 'sellers');
    document.getElementById('tab-live').classList.toggle('d-none', tab !== 'live');
    document.getElementById('tab-recipes').classList.toggle('d-none', tab !== 'recipes');

    clearInterval(liveInterval);
    if (tab === 'sellers') loadSellers();
    if (tab === 'live') { loadLive(); liveInterval = setInterval(loadLive, 1000); }
    if (tab === 'recipes') loadRecipes();
}

function timeAgo(isoString) {
    const sec = Math.floor((Date.now() - new Date(isoString)) / 1000);
    if (sec < 5)  return 'just now';
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    return `${Math.floor(sec / 3600)}h ago`;
}

async function loadLive() {
    try {
        const res = await fetch('/api/prices/live');
        const sales = await res.json();
        const body = document.getElementById('liveBody');
        if (sales.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No sales yet.</td></tr>';
            return;
        }
        body.innerHTML = sales.map(s => `
            <tr>
                <td class="text-muted" style="white-space:nowrap">${timeAgo(s.timestamp)}</td>
                <td class="fw-medium">${formatName(s.itemName)}</td>
                <td>${s.seller}</td>
                <td>${fmt(s.unitPrice)}</td>
                <td>${s.amount.toLocaleString()}</td>
                <td class="fw-semibold">${fmt(s.unitPrice * s.amount)}</td>
            </tr>
        `).join('');
    } catch {
        document.getElementById('liveBody').innerHTML =
            '<tr><td colspan="6" class="text-center text-muted py-4">Failed to load.</td></tr>';
    }
}

async function loadSellers() {
    try {
        const res = await fetch('/api/prices/sellers');
        const sellers = await res.json();
        const body = document.getElementById('sellersBody');
        if (sellers.length === 0) {
            body.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">No data yet.</td></tr>';
            return;
        }
        body.innerHTML = sellers.map((s, i) => `
            <tr>
                <td class="text-muted">${i === 0 ? '<i class="bi bi-trophy-fill" style="color:#f59e0b"></i>' : i === 1 ? '<i class="bi bi-trophy-fill" style="color:#94a3b8"></i>' : i === 2 ? '<i class="bi bi-trophy-fill" style="color:#b45309"></i>' : i + 1}</td>
                <td class="fw-medium">${s.name}</td>
                <td>${s.saleCount.toLocaleString()}</td>
            </tr>
        `).join('');
    } catch {
        document.getElementById('sellersBody').innerHTML =
            '<tr><td colspan="3" class="text-center text-muted py-4">Failed to load.</td></tr>';
    }
}

async function removeItem(itemName) {
    if (!confirm(`Remove "${formatName(itemName)}"?\n\nThis will delete all recorded price history for this item.`)) return;
    await fetch(`/api/prices/items/${encodeURIComponent(itemName)}`, { method: 'DELETE' });
    await loadItems();
}

async function addManualItem() {
    const itemName = window.prompt('Enter the item ID to add:\n(e.g. minecraft:netherite_scrap)');
    if (!itemName || !itemName.trim()) return;
    await fetch('/api/prices/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemName.trim())
    });
    await loadItems();
}

loadItems();
setInterval(loadItems, 5000);

// ── Override ──────────────────────────────────────────────────────────────────

async function editOverride(itemName) {
    const item = allItems.find(i => i.name === itemName);
    const current = item?.overridePrice;
    const input = window.prompt(
        `Price override for ${formatName(itemName)}` +
        (current != null ? ` (current: ${fmt(current)})` : '') +
        `\n\nEnter a price, or leave empty to clear:`,
        current != null ? String(current) : ''
    );
    if (input === null) return;

    if (input.trim() === '') {
        await fetch(`/api/prices/overrides/${encodeURIComponent(itemName)}`, { method: 'DELETE' });
        if (item) item.overridePrice = null;
    } else {
        const price = parseFloat(input);
        if (isNaN(price) || price < 0) return;
        await fetch(`/api/prices/overrides/${encodeURIComponent(itemName)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(price)
        });
        if (item) item.overridePrice = price;
    }
    render();
}

const overrideHistoryModal = new bootstrap.Modal(document.getElementById('overrideHistoryModal'));
let overrideHistoryItem = '';

async function showOverrideHistory(itemName) {
    overrideHistoryItem = itemName;
    document.getElementById('overrideHistoryTitle').textContent = formatName(itemName) + ' — Override History';
    document.getElementById('overrideHistoryBody').innerHTML =
        '<tr><td colspan="3" class="text-center text-muted py-3">Loading…</td></tr>';
    overrideHistoryModal.show();
    await refreshOverrideHistory();
}

async function refreshOverrideHistory() {
    const res = await fetch(`/api/prices/overrides/${encodeURIComponent(overrideHistoryItem)}/history`);
    const history = await res.json();
    const body = document.getElementById('overrideHistoryBody');
    if (history.length === 0) {
        body.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">No history yet.</td></tr>';
        return;
    }
    body.innerHTML = history.map(h => `
        <tr>
            <td class="ps-3 text-muted small" style="white-space:nowrap">${new Date(h.timestamp).toLocaleString()}</td>
            <td>${h.price != null
                ? `<span class="text-warning fw-semibold">${fmt(h.price)}</span>`
                : '<span class="text-muted fst-italic small">Cleared</span>'}</td>
            <td class="pe-2 text-end">
                <button class="btn btn-sm btn-icon btn-outline-danger"
                    onclick="deleteOverrideHistoryEntry(${h.id})" title="Delete this record">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function deleteOverrideHistoryEntry(id) {
    await fetch(`/api/prices/overrides/history/${id}`, { method: 'DELETE' });
    await refreshOverrideHistory();
}

// ── Recipes ──────────────────────────────────────────────────────────────────

const RECIPE_CATEGORIES = [
    { value: 'crafting', label: 'Crafting', icon: 'bi-hammer',       color: '#8b5cf6' },
    { value: 'smelting', label: 'Smelting', icon: 'bi-fire',         color: '#f97316' },
    { value: 'brewing',  label: 'Brewing',  icon: 'bi-cup-hot',      color: '#06b6d4' },
    { value: 'smithing', label: 'Smithing', icon: 'bi-shield-shaded',color: '#64748b' },
    { value: 'other',    label: 'Other',    icon: 'bi-box-seam',     color: '#94a3b8' },
];

function getCategoryInfo(value) {
    return RECIPE_CATEGORIES.find(c => c.value === value) || RECIPE_CATEGORIES[RECIPE_CATEGORIES.length - 1];
}

let cachedRecipes = [];
let recipeSort        = 'margin';
let recipeFilter      = '';
let recipeBudget      = 0;
let recipePriceMode = 'override'; // 'override' | 'average' | 'min' | 'max'
let expandedRecipes   = new Set();

const recipeModal = new bootstrap.Modal(document.getElementById('recipeModal'));

document.getElementById('recipeModal').addEventListener('input', updateRecipePreview);
document.getElementById('recipeModal').addEventListener('hidden.bs.modal', () => {
    document.getElementById('recipeIngredients').innerHTML = '';
});

function parseQty(str) {
    str = String(str).trim().replace(/,/g, '.');
    if (str.includes('/')) {
        const parts = str.split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(str) || 0;
}

function fmtQty(raw, parsed) {
    const s = String(raw).trim().replace(/,/g, '.');
    if (s.includes('/')) return s;
    const r = Math.round(parsed * 1e6) / 1e6;
    if (Number.isInteger(r)) return r;
    return r.toFixed(6).replace(/\.?0+$/, '');
}

function fmtQtyNum(n) {
    const r = Math.round(n * 1e6) / 1e6;
    if (Number.isInteger(r)) return r;
    return r.toFixed(6).replace(/\.?0+$/, '');
}

function getEffectivePrice(itemName, useOverride = true) {
    const item = allItems.find(i => i.name === itemName);
    if (!item) return 0;
    if (useOverride && item.overridePrice != null) return item.overridePrice;
    return item.averagePrice;
}

function getRecipePrice(itemName, ingUseOverride) {
    const item = allItems.find(i => i.name === itemName);
    if (!item) return 0;
    if (recipePriceMode === 'min') return item.minPrice;
    if (recipePriceMode === 'max') return item.maxPrice;
    if (recipePriceMode === 'override' && ingUseOverride && item.overridePrice != null) return item.overridePrice;
    return item.averagePrice;
}

function calcRecipe(recipe) {
    const cost = recipe.ingredients.reduce(
        (sum, ing) => sum + getRecipePrice(ing.item, ing.useOverride !== false) * parseQty(ing.qty), 0);
    const revenue = getRecipePrice(recipe.output.item, recipe.output.useOverride !== false) * parseQty(recipe.output.qty);
    const profit = revenue - cost;
    const margin = cost > 0 ? (profit / cost) * 100 : 0;
    return { cost, revenue, profit, margin };
}

function fmtProfit(profit, margin) {
    const cls = profit >= 0 ? 'text-profit' : 'text-loss';
    const sign = profit >= 0 ? '+' : '−';
    return `<span class="${cls}">${sign}${fmt(Math.abs(profit))} <span class="fw-normal small">(${margin.toFixed(1)}%)</span></span>`;
}

function ingredientLabel(ing) {
    const itemHasOverride = allItems.find(i => i.name === ing.item)?.overridePrice != null;
    const usingOverride   = recipePriceMode === 'override' && ing.useOverride !== false && itemHasOverride;
    return `${formatName(ing.item)} × ${ing.qty}${usingOverride ? ' <span class="badge-category">override</span>' : ''}`;
}

function renderRecipesControls() {
    const SORTS = [
        { key: 'revenue', label: 'Revenue' },
        { key: 'profit',  label: 'Profit'  },
        { key: 'margin',  label: 'Margin'  },
        { key: 'name',    label: 'Name'    },
    ];

    const sortBtns = SORTS.map(s => {
        const active = recipeSort === s.key;
        return `<button class="btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}"
            onclick="setRecipeSort('${s.key}')">
            ${s.label}${active && s.key !== 'name' ? ' <i class="bi bi-arrow-down"></i>' : ''}
        </button>`;
    }).join('');

    const filterBtns = [
        `<button class="btn btn-sm ${recipeFilter === '' ? 'btn-primary' : 'btn-outline-secondary'}"
            onclick="setRecipeFilter('')">All</button>`
    ].concat(RECIPE_CATEGORIES.map(c => {
        const active = recipeFilter === c.value;
        const style = active ? `background:${c.color};border-color:${c.color};color:#fff` : `color:${c.color};border-color:${c.color}`;
        return `<button class="btn btn-sm" style="${style}"
            onclick="setRecipeFilter('${c.value}')">
            <i class="bi ${c.icon} me-1"></i>${c.label}
        </button>`;
    })).join('');

    const PRICE_MODES = [
        { key: 'override', label: 'Override', icon: 'bi-tag-fill',    title: 'Use override prices where set, average otherwise' },
        { key: 'average',  label: 'Average',  icon: 'bi-bar-chart',   title: 'Use average market prices for all items' },
        { key: 'min',      label: 'Min',      icon: 'bi-arrow-down',  title: 'Use minimum recorded prices for all items' },
        { key: 'max',      label: 'Max',      icon: 'bi-arrow-up',    title: 'Use maximum recorded prices for all items' },
    ];
    const priceBtns = PRICE_MODES.map(m =>
        `<button class="btn btn-sm ${recipePriceMode === m.key ? 'btn-primary' : 'btn-outline-secondary'}"
            onclick="setRecipePriceMode('${m.key}')" title="${m.title}">
            <i class="bi ${m.icon} me-1"></i>${m.label}
        </button>`).join('');

    document.getElementById('recipesControls').innerHTML = `
        <div class="d-flex flex-wrap gap-3 align-items-center">
            <div class="d-flex align-items-center gap-2">
                <span class="text-muted small fw-semibold" style="white-space:nowrap">Sort by</span>
                <div class="d-flex gap-1">${sortBtns}</div>
            </div>
            <div class="d-flex align-items-center gap-2">
                <span class="text-muted small fw-semibold">Filter</span>
                <div class="d-flex gap-1 flex-wrap">${filterBtns}</div>
            </div>
            <div class="d-flex align-items-center gap-2">
                <span class="text-muted small fw-semibold" style="white-space:nowrap">Prices</span>
                <div class="d-flex gap-1">${priceBtns}</div>
            </div>
            <div class="d-flex align-items-center gap-2 ms-auto">
                <span class="text-muted small fw-semibold" style="white-space:nowrap"><i class="bi bi-coin me-1"></i>Budget</span>
                <input type="text" class="form-control form-control-sm" style="width:130px"
                    placeholder="e.g. 10k, 5M, 1B" value="${recipeBudget > 0 ? fmt(recipeBudget) : ''}"
                    onchange="setRecipeBudget(this.value)"
                    title="Set a spend budget — supports 10k, 5M, 1B notation">
                ${recipeBudget > 0 ? `<button class="btn btn-sm btn-outline-secondary btn-icon" onclick="setRecipeBudget(0)" title="Clear budget"><i class="bi bi-x"></i></button>` : ''}
            </div>
        </div>`;
}

function parseBudget(str) {
    str = String(str).trim().replace(/,/g, '');
    if (!str) return 0;
    const lower = str.toLowerCase();
    const num = parseFloat(lower);
    if (isNaN(num)) return 0;
    if (lower.endsWith('b')) return num * 1_000_000_000;
    if (lower.endsWith('m')) return num * 1_000_000;
    if (lower.endsWith('k')) return num * 1_000;
    return num;
}

function setRecipeSort(key) { recipeSort = key; renderRecipesControls(); renderRecipes(); }
function setRecipeFilter(val) { recipeFilter = val; renderRecipesControls(); renderRecipes(); }
function setRecipeBudget(val) { recipeBudget = parseBudget(val); renderRecipesControls(); renderRecipes(); }
function setRecipePriceMode(val) { recipePriceMode = val; renderRecipesControls(); renderRecipes(); }
function toggleRecipe(id) {
    if (expandedRecipes.has(id)) expandedRecipes.delete(id); else expandedRecipes.add(id);
    renderRecipes();
}

function renderRecipes() {
    const container = document.getElementById('recipesContainer');

    let recipes = [...cachedRecipes];
    if (recipeFilter) recipes = recipes.filter(r => r.category === recipeFilter);

    // Hide recipes where any ingredient or the output has no valid price under the current price mode
    recipes = recipes.filter(r => {
        for (const ing of r.ingredients) {
            if (parseQty(ing.qty) > 0 && getRecipePrice(ing.item, ing.useOverride !== false) <= 0)
                return false;
        }
        return getRecipePrice(r.output.item, r.output.useOverride !== false) > 0;
    });

    const budgetActive = recipeBudget > 0;

    recipes.sort((a, b) => {
        if (recipeSort === 'name') return a.name.localeCompare(b.name);
        const ca = calcRecipe(a), cb = calcRecipe(b);
        if (budgetActive) {
            const ma = ca.cost > 0 ? Math.floor(recipeBudget / ca.cost) : 0;
            const mb = cb.cost > 0 ? Math.floor(recipeBudget / cb.cost) : 0;
            if (recipeSort === 'profit') return (mb * cb.profit) - (ma * ca.profit);
            if (recipeSort === 'margin') return cb.margin - ca.margin;
            return (mb * cb.revenue) - (ma * ca.revenue);
        }
        if (recipeSort === 'profit') return cb.profit  - ca.profit;
        if (recipeSort === 'margin') return cb.margin  - ca.margin;
        return cb.revenue - ca.revenue;
    });

    if (recipes.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-4">No recipes yet. Click "New Recipe" to get started.</p>';
        return;
    }

    container.innerHTML = recipes.map(r => {
        const { cost, revenue, profit, margin } = calcRecipe(r);
        const cat      = getCategoryInfo(r.category);
        const expanded = expandedRecipes.has(r.id);

        const multiplier   = budgetActive ? (cost > 0 ? Math.floor(recipeBudget / cost) : 0) : 1;
        const cantAfford   = budgetActive && multiplier === 0;
        const scaledCost   = cost    * multiplier;
        const scaledRev    = revenue * multiplier;
        const scaledProfit = profit  * multiplier;

        // ── collapsed header ─────────────────────────────────────────────────
        const marginCls  = margin >= 0 ? 'text-profit' : 'text-loss';
        const marginSign = margin >= 0 ? '+' : '';

        const budgetBadge = budgetActive
            ? `<span class="badge-category" style="${cantAfford
                ? 'color:#ef4444;border-color:#ef444440;background:#ef444415'
                : 'color:#22c55e;border-color:#22c55e40;background:#22c55e15'}">
                    ${cantAfford ? '×0' : `×${multiplier}`}
               </span>`
            : '';

        const budgetHint = (budgetActive && !cantAfford)
            ? `<span class="text-muted small" style="white-space:nowrap">${fmtProfit(scaledProfit, margin)}</span>`
            : '';

        // ── expanded body ────────────────────────────────────────────────────
        const outOverride = recipePriceMode === 'override' && r.output.useOverride !== false && allItems.find(i => i.name === r.output.item)?.overridePrice != null;

        // Per-ingredient lines — scaled by multiplier when budget is active
        const showTotals = budgetActive && !cantAfford && multiplier > 1;
        const ingRows = r.ingredients.map(ing => {
            const unitPrice   = getEffectivePrice(ing.item);
            const perCraftQty = parseQty(ing.qty);
            const displayQty  = showTotals ? perCraftQty * multiplier : perCraftQty;
            const displayCost = unitPrice * displayQty;
            const qtyStr      = fmtQtyNum(displayQty);
            const hasOverride = recipePriceMode === 'override' && ing.useOverride !== false && allItems.find(i => i.name === ing.item)?.overridePrice != null;
            const perCraftNote = showTotals
                ? ` <span class="text-muted" style="font-size:.7rem">(${fmtQty(ing.qty, perCraftQty)} per craft)</span>`
                : '';
            return `
            <div class="d-flex justify-content-between align-items-center gap-3 py-1" style="border-top:1px solid var(--border)">
              <span class="small">${formatName(ing.item)} × ${qtyStr}${hasOverride ? ' <span class="badge-category">override</span>' : ''}${perCraftNote}</span>
              <span class="small text-muted" style="white-space:nowrap">${fmt(displayCost)}</span>
            </div>`;
        }).join('');

        // Right-side stat panel (always per-craft; budget adds a second block)
        const statPanel = `
            <div style="min-width:165px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:.65rem 1rem">
              <div class="stat-label">Cost</div>
              <div class="fw-semibold small mb-2">${fmt(cost)}</div>
              <div class="stat-label">Revenue</div>
              <div class="fw-semibold small mb-2">${fmt(revenue)}</div>
              <div class="stat-label">Profit</div>
              <div class="fw-semibold small">${fmtProfit(profit, margin)}</div>
              ${budgetActive && !cantAfford ? `
              <div style="border-top:1px solid var(--border);margin-top:.65rem;padding-top:.65rem">
                <div class="stat-label mb-1">×${multiplier} crafts</div>
                <div class="stat-label">Total Cost</div>
                <div class="fw-semibold small mb-2">${fmt(scaledCost)}</div>
                <div class="stat-label">Total Revenue</div>
                <div class="fw-semibold small mb-2">${fmt(scaledRev)}</div>
                <div class="stat-label">Total Profit</div>
                <div class="fw-semibold small">${fmtProfit(scaledProfit, margin)}</div>
              </div>` : ''}
              ${cantAfford ? `<div class="text-muted small fst-italic mt-2">Can't afford</div>` : ''}
            </div>`;

        // Output quantity — scaled when budget active
        const outPerCraft = parseQty(r.output.qty);
        const outDisplayQty = showTotals ? outPerCraft * multiplier : outPerCraft;
        const outQtyStr = fmtQtyNum(outDisplayQty);
        const outPerCraftNote = showTotals
            ? ` <span class="text-muted" style="font-size:.7rem">(${fmtQty(r.output.qty, outPerCraft)} per craft)</span>`
            : '';

        return `
        <div class="mb-1" style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r);${cantAfford ? 'opacity:.5' : ''}">
          <div class="d-flex align-items-center gap-2 px-3 py-2"
               style="cursor:pointer;user-select:none"
               onclick="toggleRecipe('${r.id}')">
            <span style="color:${cat.color};flex-shrink:0"><i class="bi ${cat.icon}"></i></span>
            <span class="fw-semibold flex-grow-1 text-truncate">${r.name}</span>
            <span class="badge-category" style="color:${cat.color};border-color:${cat.color}20;background:${cat.color}15;flex-shrink:0">${cat.label}</span>
            ${budgetBadge}
            <span class="${marginCls} small fw-semibold" style="flex-shrink:0">${marginSign}${margin.toFixed(1)}%</span>
            ${budgetHint}
            <i class="bi bi-chevron-${expanded ? 'up' : 'down'} small text-muted" style="flex-shrink:0"></i>
          </div>
          ${expanded ? `
          <div style="border-top:1px solid var(--border)">
            <div class="px-3 py-2">
              <div style="display:grid;grid-template-columns:1fr auto;gap:1.25rem;align-items:start">
                <div>
                  <div class="text-muted small mb-2">
                    Output: <strong>${formatName(r.output.item)}</strong> × ${outQtyStr}${outOverride ? ' <span class="badge-category">override</span>' : ''}${outPerCraftNote}
                  </div>
                  ${r.ingredients.length ? `<div>${ingRows}</div>` : '<div class="text-muted small fst-italic">No ingredients</div>'}
                </div>
                ${statPanel}
              </div>
              <div class="d-flex gap-1 justify-content-end mt-2">
                <button class="btn btn-sm btn-outline-secondary btn-icon" onclick="event.stopPropagation();openRecipeModal('${r.id}')">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger btn-icon" onclick="event.stopPropagation();deleteRecipe('${r.id}')">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>` : ''}
        </div>`;
    }).join('');
}

async function loadRecipes() {
    try {
        const res = await fetch('/api/recipes');
        cachedRecipes = await res.json();
        renderRecipesControls();
        renderRecipes();
    } catch {
        document.getElementById('recipesContainer').innerHTML =
            '<p class="text-muted text-center py-4">Failed to load recipes.</p>';
    }
}

function renderCategoryPicker(selected) {
    const group = document.getElementById('recipeCategoryGroup');
    group.innerHTML = '';
    RECIPE_CATEGORIES.forEach(cat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm';
        const isActive = cat.value === selected;
        btn.style.cssText = isActive
            ? `background:${cat.color};border-color:${cat.color};color:#fff`
            : `color:${cat.color};border-color:${cat.color}40;background:transparent`;
        btn.innerHTML = `<i class="bi ${cat.icon} me-1"></i>${cat.label}`;
        btn.onclick = () => {
            document.getElementById('recipeCategory').value = cat.value;
            renderCategoryPicker(cat.value);
        };
        group.appendChild(btn);
    });
}

function openRecipeModal(id) {
    document.getElementById('recipeEditId').value = id || '';
    document.getElementById('recipeModalTitle').textContent = id ? 'Edit Recipe' : 'New Recipe';
    document.getElementById('recipeName').value = '';
    document.getElementById('recipeOutputItem').value = '';
    document.getElementById('recipeOutputQty').value = '1';
    document.getElementById('recipeIngredients').innerHTML = '';
    document.getElementById('recipePreview').style.display = 'none';

    let defaultCategory = 'crafting';
    let outputUseOverride = true;

    if (id) {
        const recipe = cachedRecipes.find(r => r.id === id);
        if (recipe) {
            document.getElementById('recipeName').value = recipe.name;
            document.getElementById('recipeOutputItem').value = recipe.output.item;
            document.getElementById('recipeOutputQty').value = recipe.output.qty;
            recipe.ingredients.forEach(i => addIngredientRow(i.item, i.qty, i.useOverride));
            defaultCategory = recipe.category || 'crafting';
            outputUseOverride = recipe.output.useOverride !== false;
        }
    } else {
        addIngredientRow();
    }

    document.getElementById('recipeOutputUseOverride').value = outputUseOverride;
    applyOverrideToggleStyle(document.getElementById('recipeOutputOverrideBtn'), outputUseOverride);

    document.getElementById('recipeCategory').value = defaultCategory;
    renderCategoryPicker(defaultCategory);
    recipeModal.show();
    updateRecipePreview();
}

function addIngredientRow(item, qty, useOverride) {
    item       = item || '';
    qty        = qty  || '1';
    useOverride = useOverride !== false; // default true
    const tagStyle = useOverride
        ? `color:var(--accent);border-color:var(--accent);background:transparent`
        : `color:var(--text-muted);border-color:var(--border);background:transparent`;
    const tagTitle = useOverride
        ? 'Override price active — click to use average price instead'
        : 'Using average price — click to use override price';
    const row = document.createElement('div');
    row.className = 'ingredient-row';
    row.innerHTML = `
        <input type="text" class="form-control ing-item" list="itemsList" value="${item}" placeholder="minecraft:item_id">
        <input type="text" class="form-control ing-qty" style="flex:0 0 90px" value="${qty}" placeholder="Qty (1/12…)">
        <input type="hidden" class="ing-use-override" value="${useOverride}">
        <button type="button" class="btn btn-sm btn-icon" style="${tagStyle};flex-shrink:0" title="${tagTitle}"
            onclick="toggleIngOverride(this)">
            <i class="bi bi-tag-fill"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-danger btn-icon" style="flex-shrink:0"
            onclick="this.closest('.ingredient-row').remove(); updateRecipePreview();">
            <i class="bi bi-x"></i>
        </button>`;
    document.getElementById('recipeIngredients').appendChild(row);
}

function applyOverrideToggleStyle(btn, active) {
    btn.style.color       = active ? 'var(--accent)'  : 'var(--text-muted)';
    btn.style.borderColor = active ? 'var(--accent)'  : 'var(--border)';
    btn.title = active
        ? 'Override price active — click to use average price instead'
        : 'Using average price — click to use override price';
}

function toggleIngOverride(btn) {
    const row    = btn.closest('.ingredient-row');
    const input  = row.querySelector('.ing-use-override');
    const active = input.value !== 'true';
    input.value  = active;
    applyOverrideToggleStyle(btn, active);
    updateRecipePreview();
}

function toggleOutputOverride() {
    const input  = document.getElementById('recipeOutputUseOverride');
    const btn    = document.getElementById('recipeOutputOverrideBtn');
    const active = input.value !== 'true';
    input.value  = active;
    applyOverrideToggleStyle(btn, active);
    updateRecipePreview();
}

function readModalRecipe() {
    const ingredients = [...document.querySelectorAll('#recipeIngredients .ingredient-row')].map(row => ({
        item:       row.querySelector('.ing-item').value.trim(),
        qty:        row.querySelector('.ing-qty').value.trim() || '1',
        useOverride: row.querySelector('.ing-use-override').value !== 'false'
    })).filter(i => i.item);

    return {
        id: document.getElementById('recipeEditId').value || String(Date.now()),
        name: document.getElementById('recipeName').value.trim() || 'Unnamed Recipe',
        category: document.getElementById('recipeCategory').value || 'crafting',
        output: {
            item:       document.getElementById('recipeOutputItem').value.trim(),
            qty:        document.getElementById('recipeOutputQty').value.trim() || '1',
            useOverride: document.getElementById('recipeOutputUseOverride').value !== 'false'
        },
        ingredients
    };
}

function updateRecipePreview() {
    const recipe = readModalRecipe();
    const hasData = recipe.output.item || recipe.ingredients.length > 0;
    const preview = document.getElementById('recipePreview');
    preview.style.display = hasData ? '' : 'none';
    if (!hasData) return;

    const { cost, revenue, profit, margin } = calcRecipe(recipe);
    document.getElementById('previewCost').textContent = fmt(cost);
    document.getElementById('previewRevenue').textContent = fmt(revenue);
    document.getElementById('previewProfit').innerHTML = fmtProfit(profit, margin);
    document.getElementById('previewMargin').innerHTML =
        `<span class="${profit >= 0 ? 'text-profit' : 'text-loss'}">${margin.toFixed(1)}%</span>`;
}

async function saveRecipe() {
    const recipe = readModalRecipe();
    if (!recipe.output.item) return;

    const isNew = !cachedRecipes.find(r => r.id === recipe.id);
    await fetch(isNew ? '/api/recipes' : `/api/recipes/${recipe.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipe)
    });

    recipeModal.hide();
    await loadRecipes();
}

async function deleteRecipe(id) {
    await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
    await loadRecipes();
}
