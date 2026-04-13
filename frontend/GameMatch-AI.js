const API_URL = 'http://127.0.0.1:5000';
const RAWG_KEY = 'a7cb5c95fc82419d9187f92ec104c981';
let favorites = JSON.parse(localStorage.getItem('gm_favorites') || '[]');
let currentPage = 'chat';
let draggedItem = null;

async function loadPage(page) {
    const response = await fetch(`pages/${page}.html`);
    const html = await response.text();
    document.getElementById('page-content').innerHTML = html;
}

async function showPage(page) {
    currentPage = page;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => {
        if (l.getAttribute('onclick')?.includes(page)) l.classList.add('active');
    });
    await loadPage(page);
    if (page === 'favorites') loadFavorites();
}

document.addEventListener('DOMContentLoaded', () => {
    loadPage('chat');
});

function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('theme-btn').textContent = isDark ? '☀️' : '🌙';
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        background: ${type === 'success' ? 'rgba(0,255,136,0.15)' : 'rgba(255,71,87,0.15)'};
        border: 1px solid ${type === 'success' ? 'rgba(0,255,136,0.3)' : 'rgba(255,71,87,0.3)'};
        color: ${type === 'success' ? '#00ff88' : '#ff4757'};
        backdrop-filter: blur(10px);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function getGameImage(gameName) {
    try {
        const response = await fetch(
            `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(gameName)}&page_size=1`
        );
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            return {
                image: data.results[0].background_image || 'https://via.placeholder.com/400x200/1a1a2e/00ff88?text=🎮',
                rating: data.results[0].rating,
                released: data.results[0].released,
                rawg_id: data.results[0].id
            };
        }
    } catch (e) {}
    return { image: 'https://via.placeholder.com/400x200/1a1a2e/00ff88?text=🎮', rating: null };
}

function openModal(game) {
    document.getElementById('modal-title').textContent = game.nume;
    document.getElementById('modal-image').src = game.image || 'https://via.placeholder.com/750x250/1a1a2e/00ff88?text=🎮';
    document.getElementById('modal-desc').textContent = game.descriere || game.motiv || 'Informatii indisponibile.';

    const tags = document.getElementById('modal-tags');
    tags.innerHTML = '';
    if (game.gen) tags.innerHTML += `<span class="tag tag-genre">${game.gen}</span>`;
    if (game.platforma) tags.innerHTML += `<span class="tag tag-platform">${game.platforma}</span>`;
    if (game.varsta) tags.innerHTML += `<span class="tag tag-age">${game.varsta}</span>`;
    if (game.rating) tags.innerHTML += `<span class="tag tag-rating">⭐ ${game.rating}</span>`;

    const links = document.getElementById('modal-links');
    const steamSearch = `https://store.steampowered.com/search/?term=${encodeURIComponent(game.nume)}`;
    const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(game.nume + ' gameplay')}`;
    const isFav = favorites.some(f => f.nume === game.nume);

    links.innerHTML = `
        <a href="${steamSearch}" target="_blank" class="modal-link-btn btn-steam">🎮 Steam</a>
        <a href="${ytSearch}" target="_blank" class="modal-link-btn btn-yt">▶ YouTube</a>
        <button class="modal-link-btn btn-fav" onclick="toggleFavorite(${JSON.stringify(game).replace(/"/g, '&quot;')})">
            ${isFav ? '💔 Sterge din favorite' : '❤️ Adauga la favorite'}
        </button>
    `;

    document.getElementById('modal-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

function toggleFavorite(game) {
    const idx = favorites.findIndex(f => f.nume === game.nume);
    if (idx === -1) {
        favorites.push(game);
        showToast(`${game.nume} adaugat la favorite!`, 'success');
    } else {
        favorites.splice(idx, 1);
        showToast(`${game.nume} sters din favorite!`, 'error');
    }
    localStorage.setItem('gm_favorites', JSON.stringify(favorites));
    openModal(game);
}

function setChat(text) {
    document.getElementById('chat-input').value = text;
    document.getElementById('chat-input').focus();
}

async function sendChat() {
    const input = document.getElementById('chat-input');
    const intrebare = input.value.trim();
    if (!intrebare) return;

    const varsta = document.getElementById('age-filter')?.value || 'toate';
    const intrebareFull = varsta !== 'toate' ? `${intrebare} (jocuri potrivite pentru ${varsta})` : intrebare;

    addMessage(intrebare, 'user');
    input.value = '';

    const btn = document.getElementById('chat-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    addMessage('Se gandeste...', 'ai', 'loading-msg');

    try {
        const response = await fetch(`${API_URL}/api/intreaba`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intrebare: intrebareFull })
        });

        const data = await response.json();
        document.querySelector('.loading-msg')?.remove();

        if (data.raspuns) {
            addMessage(data.raspuns, 'ai');
            await extrageJocuriDinRaspuns(data.raspuns);
        } else if (data.error === 'intrebare_nepermisa') {
            addMessage(`⚠️ ${data.motiv}`, 'ai');
        } else {
            addMessage('Eroare la generarea raspunsului!', 'ai');
        }
    } catch (err) {
        document.querySelector('.loading-msg')?.remove();
        addMessage('Serverul nu raspunde. Verifica daca backend-ul ruleaza!', 'ai');
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Trimite'; }
}

function addMessage(text, type, className = '') {
    const messages = document.getElementById('chat-messages');
    if (!messages) return;
    const div = document.createElement('div');
    div.className = `message ${type} ${className}`;
    div.innerHTML = `
        <div class="message-avatar">${type === 'ai' ? 'AI' : 'TU'}</div>
        <div class="message-content">${text.replace(/\n/g, '<br>')}</div>
    `;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

async function extrageJocuriDinRaspuns(raspuns) {
    const grid = document.getElementById('chat-games-grid');
    if (!grid) return;

    try {
        const response = await fetch(`${API_URL}/api/extrage-jocuri`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: raspuns })
        });
        const data = await response.json();
        if (data.jocuri && data.jocuri.length > 0) {
            await afiseazaJocuri(data.jocuri, grid);
        }
    } catch (e) {}
}

async function afiseazaJocuri(jocuri, container) {
    container.innerHTML = '';
    for (const joc of jocuri) {
        const imgData = await getGameImage(joc.nume);
        joc.image = imgData.image;
        joc.rating = imgData.rating;
        const card = document.createElement('div');
        card.className = 'game-card';
        card.onclick = () => openModal(joc);
        card.innerHTML = `
            <img src="${joc.image}" alt="${joc.nume}" onerror="this.src='https://via.placeholder.com/400x200/1a1a2e/00ff88?text=🎮'"/>
            <div class="game-card-info">
                <div class="game-card-name">${joc.nume}</div>
                <div class="game-card-meta">
                    <span>${joc.gen || joc.platforma || ''}</span>
                    ${joc.rating ? `<span class="rating-badge">⭐ ${joc.rating}</span>` : ''}
                </div>
            </div>
        `;
        container.appendChild(card);
    }
}

async function cautaJocuri() {
    const gen = document.getElementById('finder-gen')?.value;
    const platforma = document.getElementById('finder-platforma')?.value;
    const mod = document.getElementById('finder-mod')?.value;
    const varsta = document.getElementById('finder-varsta')?.value;
    const numar = document.getElementById('finder-numar')?.value || 5;
    const preferinte = document.getElementById('finder-preferinte')?.value;

    const btn = document.getElementById('finder-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Se cauta...'; }

    try {
        const response = await fetch(`${API_URL}/api/recomanda`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gen, platforma, mod, varsta, numar: parseInt(numar), preferinte })
        });
        const data = await response.json();
        const results = document.getElementById('finder-results');
        if (data.jocuri && results) {
            await afiseazaJocuri(data.jocuri, results);
            showToast(`${data.jocuri.length} jocuri gasite!`, 'success');
        }
    } catch (err) {
        showToast('Serverul nu raspunde!', 'error');
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Cauta Jocuri'; }
}

async function verificaConfig() {
    const cpu = document.getElementById('spec-cpu')?.value;
    const gpu = document.getElementById('spec-gpu')?.value;
    const ram = document.getElementById('spec-ram')?.value;
    const stocare = document.getElementById('spec-stocare')?.value;
    const gen = document.getElementById('spec-gen')?.value;
    const rezolutie = document.getElementById('spec-rezolutie')?.value;
    const console_det = document.getElementById('spec-console')?.value;
    const buget = document.getElementById('spec-buget')?.value;

    if (!cpu || !gpu) {
        showToast('Introduceti CPU si GPU!', 'error');
        return;
    }

    const btn = document.getElementById('config-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Se analizeaza...'; }

    try {
        const response = await fetch(`${API_URL}/api/pc-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpu, gpu, ram, stocare, gen, rezolutie, console_det, buget })
        });
        const data = await response.json();
        const results = document.getElementById('config-results');
        if (data.analiza && results) {
            results.innerHTML = `
                <div class="card">
                    <h3 style="color: var(--highlight); margin-bottom: 1rem;">Analiza Configuratiei Tale</h3>
                    <div style="font-size: 14px; line-height: 1.8; white-space: pre-wrap;">${data.analiza}</div>
                </div>
            `;
            if (data.jocuri) await afiseazaJocuri(data.jocuri, results);
        }
    } catch (err) {
        showToast('Serverul nu raspunde!', 'error');
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Analizeaza Configuratia'; }
}

async function compareJocuri() {
    const joc1 = document.getElementById('compare-joc1')?.value.trim();
    const joc2 = document.getElementById('compare-joc2')?.value.trim();

    if (!joc1 || !joc2) {
        showToast('Introduceti ambele jocuri!', 'error');
        return;
    }

    const btn = document.getElementById('compare-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Se compara...'; }

    try {
        const response = await fetch(`${API_URL}/api/compare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ joc1, joc2 })
        });
        const data = await response.json();
        const results = document.getElementById('compare-results');
        if (data.comparatie && results) {
            const img1 = await getGameImage(joc1);
            const img2 = await getGameImage(joc2);
            results.innerHTML = `
                <div class="card">
                    <div class="compare-grid" style="margin-bottom: 1.5rem;">
                        <div style="text-align: center;">
                            <img src="${img1.image}" style="width:100%; height:150px; object-fit:cover; border-radius:10px; margin-bottom:8px;"/>
                            <h3 style="color: var(--highlight);">${joc1}</h3>
                        </div>
                        <div class="vs-badge">VS</div>
                        <div style="text-align: center;">
                            <img src="${img2.image}" style="width:100%; height:150px; object-fit:cover; border-radius:10px; margin-bottom:8px;"/>
                            <h3 style="color: var(--highlight2);">${joc2}</h3>
                        </div>
                    </div>
                    <div style="font-size: 14px; line-height: 1.8; white-space: pre-wrap;">${data.comparatie}</div>
                </div>
            `;
        }
    } catch (err) {
        showToast('Serverul nu raspunde!', 'error');
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Compara Jocurile'; }
}

function setCompare(joc1, joc2) {
    const j1 = document.getElementById('compare-joc1');
    const j2 = document.getElementById('compare-joc2');
    if (j1) j1.value = joc1;
    if (j2) j2.value = joc2;
}

async function cautaTierJoc() {
    const search = document.getElementById('tier-search')?.value.trim();
    if (!search) return;

    try {
        const response = await fetch(
            `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(search)}&page_size=5`
        );
        const data = await response.json();
        const pool = document.getElementById('tier-pool');
        if (!pool) return;

        if (data.results && data.results.length > 0) {
            data.results.forEach(joc => {
                const item = document.createElement('div');
                item.className = 'tier-game-item';
                item.draggable = true;
                item.dataset.game = JSON.stringify({ nume: joc.name, image: joc.background_image });
                item.innerHTML = `
                    <img src="${joc.background_image || 'https://via.placeholder.com/30x30'}" alt="${joc.name}"/>
                    ${joc.name}
                `;
                item.addEventListener('dragstart', dragStart);
                pool.appendChild(item);
            });
            showToast(`${data.results.length} jocuri gasite!`, 'success');
        }
    } catch (err) {
        showToast('Eroare la cautare!', 'error');
    }
}

function dragStart(e) {
    draggedItem = e.target;
    e.dataTransfer.effectAllowed = 'move';
}

function allowDrop(e) {
    e.preventDefault();
}

function dropGame(e, tierId) {
    e.preventDefault();
    if (draggedItem) {
        document.getElementById(tierId).appendChild(draggedItem);
        draggedItem = null;
    }
}

function resetTierList() {
    ['tier-s', 'tier-a', 'tier-b', 'tier-c', 'tier-d'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    showToast('Tier list resetat!', 'success');
}

function loadFavorites() {
    const grid = document.getElementById('favorites-grid');
    if (!grid) return;

    document.getElementById('fav-total').textContent = favorites.length;

    if (favorites.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <p class="empty-icon">❤️</p>
                <p class="empty-title">Nu ai jocuri favorite inca!</p>
                <p class="empty-subtitle">Adauga jocuri din Chat sau Game Finder</p>
            </div>
        `;
        return;
    }

    const genCounts = {};
    const platCounts = {};
    favorites.forEach(f => {
        if (f.gen) genCounts[f.gen] = (genCounts[f.gen] || 0) + 1;
        if (f.platforma) platCounts[f.platforma] = (platCounts[f.platforma] || 0) + 1;
    });

    const topGen = Object.keys(genCounts).reduce((a, b) => genCounts[a] > genCounts[b] ? a : b, '-');
    const topPlat = Object.keys(platCounts).reduce((a, b) => platCounts[a] > platCounts[b] ? a : b, '-');

    document.getElementById('fav-gen').textContent = topGen;
    document.getElementById('fav-platforma').textContent = topPlat;

    grid.innerHTML = favorites.map(joc => `
        <div class="game-card" onclick='openModal(${JSON.stringify(joc)})'>
            <img src="${joc.image || 'https://via.placeholder.com/400x200/1a1a2e/00ff88?text=🎮'}" alt="${joc.nume}"
                onerror="this.src='https://via.placeholder.com/400x200/1a1a2e/00ff88?text=🎮'"/>
            <div class="game-card-info">
                <div class="game-card-name">${joc.nume}</div>
                <div class="game-card-meta">
                    <span>${joc.gen || ''}</span>
                    <button class="fav-btn" onclick="event.stopPropagation(); removeFav('${joc.nume}')">💔</button>
                </div>
            </div>
        </div>
    `).join('');
}

function removeFav(nume) {
    favorites = favorites.filter(f => f.nume !== nume);
    localStorage.setItem('gm_favorites', JSON.stringify(favorites));
    loadFavorites();
    showToast('Sters din favorite!', 'error');
}

function filtreazaFavorite(searchVal) {
    const search = searchVal || document.getElementById('fav-search')?.value.toLowerCase() || '';
    const gen = document.getElementById('fav-filter-gen')?.value || '';
    const filtered = favorites.filter(f => {
        const matchSearch = !search || f.nume.toLowerCase().includes(search);
        const matchGen = !gen || f.gen === gen;
        return matchSearch && matchGen;
    });
    const grid = document.getElementById('favorites-grid');
    if (!grid) return;
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state"><p class="empty-title">Niciun joc gasit!</p></div>`;
        return;
    }
    grid.innerHTML = filtered.map(joc => `
        <div class="game-card" onclick='openModal(${JSON.stringify(joc)})'>
            <img src="${joc.image || 'https://via.placeholder.com/400x200/1a1a2e/00ff88?text=🎮'}" alt="${joc.nume}"/>
            <div class="game-card-info">
                <div class="game-card-name">${joc.nume}</div>
                <div class="game-card-meta">
                    <span>${joc.gen || ''}</span>
                    <button class="fav-btn" onclick="event.stopPropagation(); removeFav('${joc.nume}')">💔</button>
                </div>
            </div>
        </div>
    `).join('');
}