// main.js
// Behavior:
// - Try to fetch hero list from public API(s).
// - If fetch fails, use local fallback hero list (names + placeholder images).
// - Render grid lazily, open modal with 3D click animation on tile click.

// --- Config / endpoints (try these public sources) ---
const API_CANDIDATES = [
    // fan-made MLBB wiki API (may be online)
    'https://mlbb-wiki-api.vercel.app/api/heroes',
    // another possible source (example repo raw data)
    'https://raw.githubusercontent.com/p3hndrx/MLBB-API/main/sample%20data/hero-data.json'
];

// Fallback hero list (short names only) - will be expanded client-side to "complete" if you provide images later
const FALLBACK_HEROES = [
    // This is a sample fallback; it's safe & quick. You can expand or replace with exact hero list.
    "Aamon", "Akai", "Aldous", "Alice", "Alpha", "Alucard", "Angela", "Argus", "Argus_old", "Atlas",
    "Aurora", "Badang", "Balmond", "Bane", "Barats", "Baxia", "Belerick", "Beatrix", "Bruno", "Brody",
    "Carmilla", "Chang'e", "Chou", "Claude", "Cyclops", "Diggie", "Eudora", "Esmeralda", "Fanny", "Faramis",
    "Floryn", "Freya", "Gatotkaca", "Gusion", "Guinevere", "Hanabi", "Harith", "Hayabusa", "Helcurt", "Hylos",
    "Irithel", "Ishizu", "Jawhead", "Johnson", "Kadita", "Kagura", "Karina", "Karrie", "Khufra", "Khaleed",
    "Kimmy", "Lancelot", "Lapu-Lapu", "Layla", "Lesley", "Lylia", "Lunox", "Martis", "Minotaur", "Miya",
    "Natan", "Nana", "Natalia", "Odette", "Pharsa", "Roger", "Saber", "Selena", "Silvanna", "Sun",
    "Thamuz", "Uranus", "Vexana", "Valir", "Wanwan", "X.Borg", "Yve", "Yin", "Zilong", "Zip"
];

// A simple placeholder image for fallback (fast)
const PLACEHOLDER_IMG = 'https://via.placeholder.com/512x720.png?text=MLBB+Hero+%F0%9F%8E%AE';

// DOM refs
const grid = document.getElementById('grid');
const loader = document.getElementById('loader');
const refreshBtn = document.getElementById('refreshBtn');
const toggleImagesBtn = document.getElementById('toggleImagesBtn');

const modal = document.getElementById('modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalCard = document.getElementById('modalCard');
const card3d = document.getElementById('card3d');
const cardFront = document.getElementById('cardFront');
const modalImg = document.getElementById('modalImg');
const modalName = document.getElementById('modalName');
const modalRole = document.getElementById('modalRole');
const modalDesc = document.getElementById('modalDesc');
const playVoiceBtn = document.getElementById('playVoice');
const wikiLink = document.getElementById('wikiLink');
const closeModalBtn = document.getElementById('closeModal');

let heroData = []; // {name, image, role, wiki, voice}
let imagesEnabled = true;

// UTILS
function el(name, cls) { const d = document.createElement(name); if (cls) d.className = cls; return d; }
function safeText(t) { return (t || '').toString(); }

// Try fetching from candidate APIs (first success wins)
async function fetchHeroFromAPIs() {
    for (const url of API_CANDIDATES) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) continue;
            const json = await res.json();
            // Attempt to normalize data
            const normalized = normalizeAPIResponse(json);
            if (normalized && normalized.length) return normalized;
        } catch (e) {
            // ignore and try next
            // console.warn('API fetch failed', url, e);
        }
    }
    return null;
}

// Normalizer: accept few common shapes
function normalizeAPIResponse(json) {
    // some endpoints return {data: [...]}
    const list = json?.data || json?.heroes || json || null;
    if (!list || !Array.isArray(list)) return null;
    // Try to map each item to {name, image, role, wiki, voice}
    return list.map(item => {
        // item may be string or object
        if (typeof item === 'string') return { name: item, image: PLACEHOLDER_IMG };
        const name = item.name || item.hero || item.title || item.hero_name || '';
        // heuristic tries to find an image field
        const image = item.image || item.icon || item.avatar || item.image_url || item.img || item.thumbnail || '';
        const role = item.role || item.type || item.class || '';
        // if image is relative, ignore
        const imgUrl = (image && image.startsWith('http')) ? image : '';
        const wiki = item.wiki || item.link || (name ? `https://mobile-legends.fandom.com/wiki/${encodeURIComponent(name)}` : '');
        return { name: safeText(name), image: imgUrl || '', role: safeText(role), wiki };
    }).filter(h => h.name);
}

// Build heroData from fallback list
function buildFallbackData() {
    return FALLBACK_HEROES.map(name => {
        return { name, image: PLACEHOLDER_IMG, role: '', wiki: `https://mobile-legends.fandom.com/wiki/${encodeURIComponent(name)}` };
    });
}

// Render grid (virtualize minimal)
function renderGrid(data) {
    grid.innerHTML = '';
    data.forEach((h, idx) => {
        const tile = el('div', 'tile');
        tile.tabIndex = 0;
        tile.setAttribute('data-index', idx);
        const img = el('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = h.name;
        img.src = imagesEnabled && h.image ? h.image : PLACEHOLDER_IMG;
        // if image 404 -> fallback to placeholder
        img.onerror = () => img.src = PLACEHOLDER_IMG;
        const name = el('div', 'name');
        name.textContent = h.name;
        tile.appendChild(img);
        tile.appendChild(name);
        tile.addEventListener('click', () => openModal(idx));
        tile.addEventListener('keydown', (e) => { if (e.key === 'Enter') openModal(idx); });
        grid.appendChild(tile);
    });
}

// Open modal with hero idx
function openModal(idx) {
    const h = heroData[idx];
    if (!h) return;
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    modalCard.classList.add('open');
    // fill content
    modalImg.src = imagesEnabled && h.image ? h.image : PLACEHOLDER_IMG;
    modalImg.alt = h.name;
    modalName.textContent = h.name;
    modalRole.textContent = h.role ? `Role: ${h.role}` : 'Role: —';
    modalDesc.textContent = h.desc || `Informasi ${h.name} (data terbatas).`;
    wikiLink.href = h.wiki || `https://mobile-legends.fandom.com/wiki/${encodeURIComponent(h.name)}`;
    // small 3D tilt effect on mouse move inside modal card
    card3d.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1.02)';
    modalCard.focus();
    // animate
    setTimeout(() => modalCard.classList.add('animate-in'), 10);
    // voice play hook
    playVoiceBtn.onclick = () => {
        if (h.voice) {
            const a = new Audio(h.voice);
            a.volume = 0.85;
            a.play().catch(() => console.warn('voice play blocked'));
        } else {
            alert('Voice tidak tersedia untuk hero ini.');
        }
    };
}

// Close modal
function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    modalCard.classList.remove('open', 'animate-in');
}

// init
async function init() {
    loader.style.display = 'block';
    grid.innerHTML = '';
    let data = null;
    try {
        const apiData = await fetchHeroFromAPIs();
        if (apiData && apiData.length) data = apiData;
    } catch (e) { }
    if (!data) {
        data = buildFallbackData();
        loader.textContent = 'Menggunakan data fallback (API tidak tersedia).';
        setTimeout(() => loader.style.display = 'none', 1200);
    } else {
        loader.textContent = `Ditemukan ${data.length} hero dari API.`;
        setTimeout(() => loader.style.display = 'none', 900);
    }
    // Ensure each hero has image: if empty, try build image url from fandom pattern (best-effort)
    data = data.map(h => {
        let image = h.image || '';
        if (!image) {
            // try fandom thumbnail pattern (best-effort): many fandom images follow /images/.../revision/latest/scale-to-width/...
            // We'll try a generic MLBB CDN pattern but it might not always work; fallback to placeholder.
            const slug = h.name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
            image = `https://static.wikia.nocookie.net/mobile-legends/images/0/00/${encodeURIComponent(slug)}.png`;
        }
        return { name: h.name, image, role: h.role || '', wiki: h.wiki || '', desc: h.desc || '', voice: h.voice || '' };
    });
    heroData = data;
    renderGrid(heroData);
}

// Events
refreshBtn.addEventListener('click', () => init());
toggleImagesBtn.addEventListener('click', () => {
    imagesEnabled = !imagesEnabled;
    renderGrid(heroData);
    toggleImagesBtn.textContent = imagesEnabled ? 'Images: ON' : 'Images: OFF';
});

// modal events
closeModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// small tilt on modal card pointer move
modalCard.addEventListener('pointermove', (e) => {
    const r = modalCard.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const ry = dx / (r.width / 2) * 8; // rotateY
    const rx = dy / (r.height / 2) * -6; // rotateX
    card3d.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
});
modalCard.addEventListener('pointerleave', () => { card3d.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1.02)'; });

// Start
init();
