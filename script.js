// ============================================================
//  Heritage Combined Explorer — script.js
//  UK (English Heritage, National Trust, Cadw) + Heritage Ireland
// ============================================================

class HeritageCombinedExplorer {
    constructor() {
        this.map = null;
        this.rawFeatures = [];       // All normalised features
        this.filteredFeatures = [];  // After active filters
        this.selectedProperty = null;
        this.activePopup = null;
        this.colorMode = 'org';      // 'org' | 'category'

        window.heritageMap = this;
        this.init();
    }

    // ── Initialisation ──────────────────────────────────────
    async init() {
        this.updateLoadingStatus('Loading datasets…');
        const ok = await this.loadAllDatasets();
        if (!ok) {
            this.showError('Could not load heritage datasets.');
            return;
        }
        this.updateLoadingStatus('Initialising map…');
        this.initMap();
        this.initUIEventListeners();
        this.initDraggablePanel();
        this.updateStats();
        this.hideLoading();
    }

    // ── Data Loading ─────────────────────────────────────────
    async fetchJson(url) {
        // Retry up to 3 times with increasing timeout
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutMs = 30000 + attempt * 15000; // 30s, 45s, 60s
                const timer = setTimeout(() => controller.abort(), timeoutMs);
                const r = await fetch(url, { signal: controller.signal });
                clearTimeout(timer);
                if (!r.ok) return null;
                return await r.json();
            } catch (e) {
                if (attempt === 2) return null;
                await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
            }
        }
        return null;
    }

    async loadAllDatasets() {
        try {
            // Load sequentially to avoid overwhelming the connection on first load
            this.updateLoadingStatus('Loading Cadw Wales data…');
            const cadwRes = await this.fetchJson('cadw.geojson');
            this.updateLoadingStatus('Loading English Heritage data…');
            const ehRes   = await this.fetchJson('english-heritage.geojson');
            this.updateLoadingStatus('Loading National Trust data…');
            const ntRes   = await this.fetchJson('NationalTrust.geojson');
            this.updateLoadingStatus('Loading Heritage Ireland data…');
            const hiRes   = await this.fetchJson('heritage_ireland.geojson');
            this.updateLoadingStatus('Processing datasets…');

            this.rawFeatures = [];

            // 1. Cadw Welsh Heritage
            // Manually designated star sites
            const CADW_STAR_SITES = new Set([
                'Castell Conwy',
                'Castell Caernarfon',
                'Castell Harlech',
                'Beaumaris Castle',
                'Caerphilly Castle',
                'Raglan Castle',
                'Chepstow Castle',
                'Tintern Abbey',
                "St Davids Bishop's Palace",
                'Bryn Celli Ddu Chambered Tomb',
            ]);
            if (cadwRes && cadwRes.features) {
                cadwRes.features.forEach(f => {
                    const props = f.properties;
                    // location_type can be a string OR an array
                    const rawLocType = props.location_type || '';
                    const locType = Array.isArray(rawLocType)
                        ? rawLocType.join(' ').toLowerCase()
                        : String(rawLocType).toLowerCase();
                    let category = 'Other';
                    if (locType.includes('castle')) category = 'Castle';
                    else if (locType.includes('religious') || locType.includes('abbey') || locType.includes('monastery') || locType.includes('priory')) category = 'Abbey';
                    else if (locType.includes('house') || locType.includes('palace') || locType.includes('hall')) category = 'House';
                    else if (locType.includes('burial') || locType.includes('chamber') || locType.includes('prehistoric')) category = 'Prehistoric';
                    else if (locType.includes('roman')) category = 'Roman';

                    this.rawFeatures.push({
                        type: 'Feature',
                        geometry: f.geometry,
                        properties: {
                            id: `cadw-${props.location_id || Math.random().toString(36).substr(2,9)}`,
                            title: props.name || 'Unnamed Cadw Site',
                            description: props.description || 'No description available.',
                            visitUrl: props.visit_url || 'https://cadw.gov.wales/',
                            imageUrl: props.image_url || null,
                            category,
                            period: props.period || 'Other',
                            org: 'cadw',
                            region: 'uk',
                            isFreeEntry: null,
                            isTopSite: CADW_STAR_SITES.has(props.name || ''),
                            locationText: null,
                            statusText: null,
                        }
                    });
                });
            }

            // 2. English Heritage
            if (ehRes && ehRes.features) {
                ehRes.features.forEach(f => {
                    const props = f.properties;
                    const text = `${props.title} ${props.summary || ''}`.toLowerCase();
                    let category = 'Other';
                    if (text.includes('castle') || text.includes('fort') || text.includes('tower')) category = 'Castle';
                    else if (text.includes('abbey') || text.includes('church') || text.includes('priory') || text.includes('monastery')) category = 'Abbey';
                    else if (text.includes('house') || text.includes('palace') || text.includes('hall') || text.includes('manor')) category = 'House';
                    else if (text.includes('roman') || text.includes('villa') || text.includes('fortress')) category = 'Roman';
                    else if (text.includes('stone') || text.includes('henge') || text.includes('barrow') || text.includes('prehistoric') || text.includes('ancient')) category = 'Prehistoric';

                    let period = 'Other';
                    if (text.includes('roman')) period = 'Roman';
                    else if (text.includes('prehistoric') || text.includes('neolithic') || text.includes('bronze age') || text.includes('stone age')) period = 'Prehistoric';
                    else if (text.includes('medieval') || text.includes('norman') || text.includes('saxon') || text.includes('abbey') || text.includes('priory')) period = 'Medieval';
                    else if (text.includes('tudor') || text.includes('elizabethan')) period = 'Tudor';
                    else if (text.includes('industrial') || text.includes('victorian') || text.includes('georgian') || text.includes('mill')) period = 'Industrial';

                    this.rawFeatures.push({
                        type: 'Feature',
                        geometry: f.geometry,
                        properties: {
                            id: `eh-${props.id || Math.random().toString(36).substr(2,9)}`,
                            title: props.title || 'Unnamed English Heritage Site',
                            description: props.summary || 'No summary available.',
                            visitUrl: props.path ? `https://www.english-heritage.org.uk${props.path}` : 'https://www.english-heritage.org.uk/',
                            imageUrl: props.imagePath ? `https://www.english-heritage.org.uk${props.imagePath}` : null,
                            category,
                            period,
                            org: 'english-heritage',
                            region: 'uk',
                            isFreeEntry: !!props.isFreeEntry,
                            isTopSite: !!props.isTopHeritageSite,
                            locationText: props.county ? `${props.county}${props.region ? ', ' + props.region : ''}` : null,
                            statusText: null,
                        }
                    });
                });
            }

            // 3. National Trust
            // Manually designated star sites
            const NT_STAR_SITES = new Set([
                'Fountains Abbey and Studley Royal Water Garden',
                "Giant's Causeway",
                'Stourhead',
                'Cliveden',
                'Corfe Castle',
                'Lacock',
                'Chartwell',
                'Knole',
                'Lyme',
                'Waddesdon',
            ]);
            if (ntRes && ntRes.features) {
                ntRes.features.forEach((f, idx) => {
                    const props = f.properties;
                    const text = `${props.title} ${props.description || ''}`.toLowerCase();
                    let category = 'Other';
                    if (text.includes('castle') || text.includes('fort') || text.includes('tower')) category = 'Castle';
                    else if (text.includes('abbey') || text.includes('church') || text.includes('priory') || text.includes('chapel')) category = 'Abbey';
                    else if (text.includes('house') || text.includes('hall') || text.includes('manor') || text.includes('court') || text.includes('cottage') || text.includes('farm') || text.includes('barn')) category = 'House';
                    else if (text.includes('roman') || text.includes('villa')) category = 'Roman';
                    else if (text.includes('stone') || text.includes('barrow') || text.includes('neolithic') || text.includes('prehistoric') || text.includes('ancient')) category = 'Prehistoric';

                    let period = 'Other';
                    if (text.includes('roman')) period = 'Roman';
                    else if (text.includes('prehistoric') || text.includes('ancient') || text.includes('stone age') || text.includes('neolithic')) period = 'Prehistoric';
                    else if (text.includes('medieval') || text.includes('norman') || text.includes('saxon') || text.includes('abbey')) period = 'Medieval';
                    else if (text.includes('tudor') || text.includes('elizabethan')) period = 'Tudor';
                    else if (text.includes('industrial') || text.includes('victorian') || text.includes('georgian') || text.includes('farm') || text.includes('mill')) period = 'Industrial';

                    let visitUrl = props.websiteUrl || '';
                    if (!visitUrl && props.websiteUrlPath) visitUrl = `https://www.nationaltrust.org.uk${props.websiteUrlPath}`;
                    if (!visitUrl) visitUrl = 'https://www.nationaltrust.org.uk/';

                    // Override known broken image URLs
                    const NT_IMAGE_OVERRIDES = {
                        'Waddesdon': 'https://nt.global.ssl.fastly.net/binaries/content/gallery/website/national/regions/oxfordshire-buckinghamshire-berkshire/places/waddesdon-manor/library/summer/parterre-in-summer-at-waddesdon-manor-buckinghamshire-1495313.jpg',
                    };
                    const resolvedImageUrl = NT_IMAGE_OVERRIDES[props.title] || props.imageUrl || null;

                    this.rawFeatures.push({
                        type: 'Feature',
                        geometry: f.geometry,
                        properties: {
                            id: `nt-${(props.id && props.id.value) || props.id || idx}`,
                            title: props.title || 'Unnamed National Trust Site',
                            description: props.description || 'No description available.',
                            visitUrl,
                            imageUrl: resolvedImageUrl,
                            category,
                            period,
                            org: 'national-trust',
                            region: 'uk',
                            isFreeEntry: null,
                            isTopSite: NT_STAR_SITES.has(props.title || ''),
                            locationText: null,
                            statusText: null,
                        }
                    });
                });
            }

            // 4. Heritage Ireland
            // Map Ireland categories → unified category values
            const IRELAND_CAT_MAP = {
                'Castles':                   'Castle',
                'Religious sites':           'Abbey',
                'Historic Houses & Estates': 'House',
                'Prehistoric monuments':     'Prehistoric',
                'Gardens':                   'Garden',
                'Parks':                     'Park',
                'Rebellion & Revolution':    'Other',
                'Iconic Sites':              'Other',
            };

            if (hiRes && hiRes.features) {
                hiRes.features.forEach((f, idx) => {
                    const props = f.properties;
                    const cats = Array.isArray(props.categories) ? props.categories : [];

                    // Primary category for unified filtering
                    let category = 'Other';
                    for (const c of cats) {
                        if (IRELAND_CAT_MAP[c]) { category = IRELAND_CAT_MAP[c]; break; }
                    }

                    // Ireland-specific category labels (all of them, for display)
                    const irishCatLabel  = cats.length > 0 ? cats[0] : 'Heritage Ireland';
                    const irishCatLabels = cats.length > 0 ? cats : ['Heritage Ireland'];

                    // Infer period from category
                    let period = 'Other';
                    if (category === 'Prehistoric') period = 'Prehistoric';
                    else if (category === 'Abbey') period = 'Medieval';
                    else if (category === 'Castle') period = 'Medieval';

                    this.rawFeatures.push({
                        type: 'Feature',
                        geometry: f.geometry,
                        properties: {
                            id: `hi-${idx}`,
                            title: props.name || 'Unnamed Heritage Ireland Site',
                            description: props.tagline || 'No description available.',
                            visitUrl: props.url || 'https://heritageireland.ie/',
                            imageUrl: props.thumbnail || null,
                            category,
                            irishCatLabel,
                            irishCatLabels: irishCatLabels.join('|'),
                            period,
                            org: 'heritage-ireland',
                            region: 'ireland',
                            isFreeEntry: null,
                            isTopSite: cats.includes('Iconic Sites'),
                            locationText: null,
                            statusText: props.status || null,
                        }
                    });
                });
            }

            this.filteredFeatures = [...this.rawFeatures];
            console.log(`Combined dataset: ${this.rawFeatures.length} features total.`);
            return this.rawFeatures.length > 0;
        } catch (err) {
            console.error('Dataset load error:', err);
            return false;
        }
    }

    // ── Map Initialisation ───────────────────────────────────
    initMap() {
        this.map = new maplibregl.Map({
            container: 'map',
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: [-4.5, 53.8],   // Centred to show both UK and Ireland
            zoom: 5.5,
            maxZoom: 18,
            minZoom: 3,
        });

        this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
        this.map.addControl(new maplibregl.FullscreenControl(), 'top-right');
        this.map.addControl(new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
        }), 'top-right');
        this.map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

        this.map.on('load', () => {
            this.addMapSourceAndLayers();
            this.applyFilters(true);
        });
    }

    // ── Map Source & Layers ──────────────────────────────────
    addMapSourceAndLayers() {
        this.map.addSource('heritage-sites', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: this.filteredFeatures },
        });

        // Main circles
        this.map.addLayer({
            id: 'sites-circles',
            type: 'circle',
            source: 'heritage-sites',
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    4, 4,
                    8, ['case', ['get', 'isTopSite'], 9, 6],
                    14, ['case', ['get', 'isTopSite'], 14, 9],
                ],
                'circle-color': this.getMarkerColorExpression(),
                'circle-stroke-color': [
                    'case',
                    ['get', 'isTopSite'], '#FFD700',
                    '#ffffff'
                ],
                'circle-stroke-width': [
                    'case',
                    ['get', 'isTopSite'], 3,
                    1.5
                ],
                'circle-opacity': 0.88,
            },
        });

        // Hover glow layer
        this.map.addLayer({
            id: 'sites-hover',
            type: 'circle',
            source: 'heritage-sites',
            paint: {
                'circle-radius': 18,
                'circle-color': '#0d6efd',
                'circle-opacity': 0.22,
                'circle-stroke-color': '#0d6efd',
                'circle-stroke-width': 1.5,
                'circle-stroke-opacity': 0.6,
            },
            filter: ['==', 'id', ''],
        });

        // Click → sidebar
        this.map.on('click', 'sites-circles', (e) => {
            if (e.features && e.features.length > 0) {
                this.showPropertyDetails(e.features[0].properties, e.lngLat);
            }
        });

        // Hover effects
        this.map.on('mouseenter', 'sites-circles', (e) => {
            this.map.getCanvas().style.cursor = 'pointer';
            if (e.features && e.features.length > 0) {
                this.map.setFilter('sites-hover', ['==', 'id', e.features[0].properties.id]);
            }
        });
        this.map.on('mouseleave', 'sites-circles', () => {
            this.map.getCanvas().style.cursor = '';
            this.map.setFilter('sites-hover', ['==', 'id', '']);
        });
    }

    // ── Colour Expressions ───────────────────────────────────
    getMarkerColorExpression() {
        if (this.colorMode === 'org') {
            return [
                'match', ['get', 'org'],
                'english-heritage', '#0066CC',
                'national-trust',   '#198754',
                'cadw',             '#D22630',
                'heritage-ireland', '#c8a84b',
                '#6c757d'
            ];
        }
        // Category colour coding
        return [
            'match', ['get', 'category'],
            'Castle',     '#CF142B',
            'Abbey',      '#4B0082',
            'House',      '#1a6e3c',
            'Roman',      '#8B4513',
            'Prehistoric','#FF8C00',
            'Garden',     '#2ecc71',
            'Park',       '#16a085',
            '#6c757d'
        ];
    }

    updateMarkerColors() {
        if (this.map && this.map.getLayer('sites-circles')) {
            this.map.setPaintProperty('sites-circles', 'circle-color', this.getMarkerColorExpression());
        }
    }

    // ── Filter Logic ─────────────────────────────────────────
    applyFilters(fitMapBounds = false) {
        const orgEh    = document.getElementById('org-eh').checked;
        const orgNt    = document.getElementById('org-nt').checked;
        const orgCadw  = document.getElementById('org-cadw').checked;
        const orgHi    = document.getElementById('org-hi').checked;

        const regionUk      = document.getElementById('region-uk').checked;
        const regionIreland = document.getElementById('region-ireland').checked;

        const activeCats = Array.from(document.querySelectorAll('.category-checkbox:checked'))
            .map(cb => cb.id.replace('cat-', ''));

        const specFree = document.getElementById('spec-free').checked;
        const specTop  = document.getElementById('spec-top').checked;
        const period   = document.getElementById('period-select').value;
        const query    = (document.getElementById('search-input').value || '').toLowerCase().trim();

        // Category map from checkbox id → property value
        const CAT_MAP = {
            castle:     'Castle',
            abbey:      'Abbey',
            house:      'House',
            roman:      'Roman',
            prehistoric:'Prehistoric',
            garden:     'Garden',
            park:       'Park',
            other:      'Other',
        };
        const activeCatValues = activeCats.map(k => CAT_MAP[k]).filter(Boolean);

        this.filteredFeatures = this.rawFeatures.filter(f => {
            const p = f.properties;

            // Region filter
            if (p.region === 'uk' && !regionUk) return false;
            if (p.region === 'ireland' && !regionIreland) return false;

            // Org filter
            if (p.org === 'english-heritage' && !orgEh) return false;
            if (p.org === 'national-trust'   && !orgNt) return false;
            if (p.org === 'cadw'             && !orgCadw) return false;
            if (p.org === 'heritage-ireland' && !orgHi) return false;

            // Category filter (any active → must match one)
            if (activeCatValues.length > 0 && !activeCatValues.includes(p.category)) return false;

            // Spec filters (UK-only fields)
            if (specFree && p.isFreeEntry !== true) return false;
            if (specTop  && p.isTopSite  !== true) return false;

            // Period filter
            if (period && p.period !== period) return false;

            // Search query
            if (query.length >= 2) {
                const haystack = `${p.title} ${p.locationText || ''} ${p.irishCatLabel || ''}`.toLowerCase();
                if (!haystack.includes(query)) return false;
            }

            return true;
        });

        if (this.map && this.map.getSource('heritage-sites')) {
            this.map.getSource('heritage-sites').setData({
                type: 'FeatureCollection',
                features: this.filteredFeatures,
            });
        }

        this.updateStats();

        if (fitMapBounds && this.filteredFeatures.length > 0) {
            this.fitMapToFeatures();
        }
    }

    fitMapToFeatures() {
        if (this.filteredFeatures.length === 0) return;
        const bounds = new maplibregl.LngLatBounds();
        this.filteredFeatures.forEach(f => {
            if (f.geometry && f.geometry.coordinates) bounds.extend(f.geometry.coordinates);
        });
        this.map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 900 });
    }

    // ── Stats Update ─────────────────────────────────────────
    updateStats() {
        const total = this.filteredFeatures.length;
        const eh    = this.filteredFeatures.filter(f => f.properties.org === 'english-heritage').length;
        const nt    = this.filteredFeatures.filter(f => f.properties.org === 'national-trust').length;
        const cadw  = this.filteredFeatures.filter(f => f.properties.org === 'cadw').length;
        const hi    = this.filteredFeatures.filter(f => f.properties.org === 'heritage-ireland').length;

        document.getElementById('total-count').textContent = total.toLocaleString();
        document.getElementById('eh-count').textContent    = eh.toLocaleString();
        document.getElementById('nt-count').textContent    = nt.toLocaleString();
        document.getElementById('cadw-count').textContent  = cadw.toLocaleString();
        document.getElementById('hi-count').textContent    = hi.toLocaleString();

        // Badge counts in panel (always show raw totals)
        document.getElementById('org-eh-badge').textContent   = this.rawFeatures.filter(f => f.properties.org === 'english-heritage').length;
        document.getElementById('org-nt-badge').textContent   = this.rawFeatures.filter(f => f.properties.org === 'national-trust').length;
        document.getElementById('org-cadw-badge').textContent = this.rawFeatures.filter(f => f.properties.org === 'cadw').length;
        document.getElementById('org-hi-badge').textContent   = this.rawFeatures.filter(f => f.properties.org === 'heritage-ireland').length;
    }

    // ── Reset Filters ────────────────────────────────────────
    resetAllFilters() {
        ['org-eh','org-nt','org-cadw','org-hi','region-uk','region-ireland'].forEach(id => {
            document.getElementById(id).checked = true;
        });
        document.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = false);
        document.querySelectorAll('.spec-checkbox').forEach(cb => cb.checked = false);
        document.getElementById('period-select').value = '';
        document.getElementById('search-input').value = '';
        document.getElementById('clear-search').classList.add('d-none');
        this.closeSearchDrawer();
        this.applyFilters(true);
    }

    // ── Property Sidebar ─────────────────────────────────────
    showPropertyDetails(props, _lngLat) {
        this.selectedProperty = props;

        // On mobile, close filter panel when sidebar opens
        const fp = document.getElementById('filter-panel');
        if (fp && window.innerWidth <= 768) fp.classList.remove('open');

        const orgBadge    = document.getElementById('sidebar-org-badge');
        const title       = document.getElementById('sidebar-title');
        const catBadge    = document.getElementById('sidebar-category-badge');
        const periodBadge = document.getElementById('sidebar-period-badge');
        const freeBadge   = document.getElementById('sidebar-free-badge');
        const topBadge    = document.getElementById('sidebar-top-badge');
        const statusBadge = document.getElementById('sidebar-status-badge');
        const locDiv      = document.getElementById('sidebar-location');
        const locText     = document.getElementById('sidebar-location-text');
        const desc        = document.getElementById('sidebar-description');
        const img         = document.getElementById('sidebar-img');
        const placeholder = document.getElementById('sidebar-placeholder');
        const visitBtn    = document.getElementById('sidebar-visit-btn');

        title.textContent = props.title;
        desc.innerHTML    = props.description;

        // Org badge
        orgBadge.className = 'badge px-2 py-1 rounded-pill';
        const ORG_LABELS = {
            'english-heritage': ['English Heritage', 'bg-primary'],
            'national-trust':   ['National Trust',   'bg-success'],
            'cadw':             ['Cadw Wales',        'bg-danger'],
            'heritage-ireland': ['Heritage Ireland',  ''],
        };
        const [orgLabel, orgClass] = ORG_LABELS[props.org] || ['Unknown', 'bg-secondary'];
        orgBadge.textContent = orgLabel;
        if (orgClass) {
            orgBadge.classList.add(orgClass);
        } else {
            orgBadge.style.background = '#c8a84b';
            orgBadge.style.color = '#1a3a2a';
        }

        // Category badge(s) — for Heritage Ireland show all categories as separate badges
        if (props.org === 'heritage-ireland' && props.irishCatLabels) {
            const allCats = props.irishCatLabels.split('|');
            // Colour map matching the original heritage-ireland app
            const IRELAND_CAT_COLORS = {
                'Castles':                   '#c0392b',
                'Religious sites':           '#8e44ad',
                'Gardens':                   '#27ae60',
                'Prehistoric monuments':     '#d35400',
                'Historic Houses & Estates': '#2980b9',
                'Rebellion & Revolution':    '#922b21',
                'Parks':                     '#16a085',
                'Iconic Sites':              '#f39c12',
            };
            // Replace the single badge with one per category
            catBadge.style.display = 'none';
            // Remove any previously injected multi-badges
            catBadge.parentElement.querySelectorAll('.hi-cat-badge').forEach(el => el.remove());
            allCats.forEach(cat => {
                const span = document.createElement('span');
                span.className = 'badge hi-cat-badge';
                span.textContent = cat;
                span.style.background = IRELAND_CAT_COLORS[cat] || '#7f8c8d';
                span.style.color = '#fff';
                catBadge.insertAdjacentElement('afterend', span);
            });
        } else {
            catBadge.style.display = '';
            catBadge.parentElement.querySelectorAll('.hi-cat-badge').forEach(el => el.remove());
            catBadge.textContent = props.category;
        }

        // Period badge
        if (props.period && props.period !== 'Other') {
            periodBadge.textContent = props.period;
            periodBadge.classList.remove('d-none');
        } else {
            periodBadge.classList.add('d-none');
        }

        // Free / Star badges
        props.isFreeEntry === true ? freeBadge.classList.remove('d-none') : freeBadge.classList.add('d-none');
        props.isTopSite   === true ? topBadge.classList.remove('d-none')  : topBadge.classList.add('d-none');

        // Status badge (Heritage Ireland)
        if (props.statusText) {
            statusBadge.textContent = props.statusText;
            statusBadge.classList.remove('d-none');
        } else {
            statusBadge.classList.add('d-none');
        }

        // Location
        if (props.locationText) {
            locText.textContent = props.locationText;
            locDiv.classList.remove('d-none');
        } else {
            locDiv.classList.add('d-none');
        }

        // Image
        if (props.imageUrl) {
            img.src = props.imageUrl;
            img.classList.remove('d-none');
            placeholder.classList.add('d-none');
        } else {
            img.classList.add('d-none');
            placeholder.classList.remove('d-none');
        }

        visitBtn.href = props.visitUrl;
        document.getElementById('property-sidebar').classList.remove('closed');
    }

    closeSidebar() {
        document.getElementById('property-sidebar').classList.add('closed');
        this.selectedProperty = null;
    }

    // ── Search ───────────────────────────────────────────────
    handleSearchQuery(query) {
        this.applyFilters(false);

        const drawer = document.getElementById('search-results-drawer');
        const list   = document.getElementById('search-results-list');
        const label  = document.getElementById('results-count-label');

        if (!query || query.length < 2) { this.closeSearchDrawer(); return; }

        const matches = this.rawFeatures.filter(f => {
            const p = f.properties;
            return p.title.toLowerCase().includes(query) ||
                   (p.locationText && p.locationText.toLowerCase().includes(query)) ||
                   (p.irishCatLabel && p.irishCatLabel.toLowerCase().includes(query));
        }).slice(0, 8);

        if (matches.length === 0) {
            list.innerHTML = `<div class="p-3 text-center text-muted small"><i class="bi bi-search mb-1 d-block"></i>No sites found.</div>`;
            label.textContent = '0 Results';
            drawer.classList.remove('d-none');
            return;
        }

        label.textContent = `${matches.length} Suggestion${matches.length > 1 ? 's' : ''}`;
        list.innerHTML = '';

        const ORG_BADGE = {
            'english-heritage': ['bg-primary',  'EH'],
            'national-trust':   ['bg-success',  'NT'],
            'cadw':             ['bg-danger',   'Cadw'],
            'heritage-ireland': ['',            'Ireland'],
        };

        matches.forEach(feature => {
            const p = feature.properties;
            const [badgeClass, badgeLabel] = ORG_BADGE[p.org] || ['bg-secondary', '?'];
            const item = document.createElement('div');
            item.className = 'search-result-item list-group-item list-group-item-action d-flex align-items-center justify-content-between';
            item.innerHTML = `
                <div>
                    <div class="search-result-title">${p.title}</div>
                    <div class="search-result-subtitle">${p.irishCatLabel || p.category}</div>
                </div>
                <span class="badge ${badgeClass} uppercase-label" ${!badgeClass ? 'style="background:#c8a84b;color:#1a3a2a;"' : ''}>${badgeLabel}</span>
            `;
            item.addEventListener('click', () => {
                const coords = feature.geometry.coordinates;
                this.map.flyTo({ center: coords, zoom: 13, duration: 1200, essential: true });
                this.showPropertyDetails(p, coords);
                this.closeSearchDrawer();
                document.getElementById('search-input').value = p.title;
            });
            list.appendChild(item);
        });

        drawer.classList.remove('d-none');
    }

    closeSearchDrawer() {
        const d = document.getElementById('search-results-drawer');
        if (d) d.classList.add('d-none');
    }

    // ── UI Event Listeners ───────────────────────────────────
    initUIEventListeners() {
        // Filter checkboxes
        document.querySelectorAll('.filter-checkbox, .region-checkbox').forEach(cb => {
            cb.addEventListener('change', () => this.applyFilters(false));
        });
        document.querySelectorAll('.category-checkbox').forEach(cb => {
            cb.addEventListener('change', () => this.applyFilters(false));
        });
        document.querySelectorAll('.spec-checkbox').forEach(cb => {
            cb.addEventListener('change', () => this.applyFilters(false));
        });
        document.getElementById('period-select').addEventListener('change', () => this.applyFilters(false));

        // Reset
        document.getElementById('reset-filters').addEventListener('click', () => this.resetAllFilters());

        // Minimise panel
        document.getElementById('toggle-filters').addEventListener('click', () => this.toggleFilterPanel());

        // Close sidebar
        document.getElementById('close-sidebar').addEventListener('click', () => this.closeSidebar());

        // Search
        const searchInput = document.getElementById('search-input');
        const clearBtn    = document.getElementById('clear-search');
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase().trim();
            clearBtn.classList.toggle('d-none', !q);
            this.handleSearchQuery(q);
        });
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.add('d-none');
            this.closeSearchDrawer();
            this.applyFilters(false);
        });

        // Mobile search
        const mobileInput = document.getElementById('mobile-search-input');
        const mobileClear = document.getElementById('mobile-clear-search');
        if (mobileInput) {
            mobileInput.addEventListener('input', () => {
                const q = mobileInput.value.toLowerCase().trim();
                mobileClear.classList.toggle('d-none', !q);
                searchInput.value = mobileInput.value;
                this.handleSearchQuery(q);
            });
        }
        if (mobileClear) {
            mobileClear.addEventListener('click', () => {
                mobileInput.value = '';
                mobileClear.classList.add('d-none');
                searchInput.value = '';
                this.closeSearchDrawer();
                this.applyFilters(false);
            });
        }

        // Mobile filter toggle
        const mobileFilterBtn = document.getElementById('mobile-filter-btn');
        if (mobileFilterBtn) {
            mobileFilterBtn.addEventListener('click', () => {
                document.getElementById('filter-panel').classList.toggle('open');
            });
        }
        const closeMobileFilters = document.getElementById('close-filters-mobile');
        if (closeMobileFilters) {
            closeMobileFilters.addEventListener('click', () => {
                document.getElementById('filter-panel').classList.remove('open');
            });
        }

        // Search drawer close
        document.getElementById('close-drawer-btn').addEventListener('click', () => this.closeSearchDrawer());

        // Close drawer on outside click
        document.addEventListener('click', (e) => {
            const drawer = document.getElementById('search-results-drawer');
            if (!drawer.contains(e.target) && !searchInput.contains(e.target)) {
                this.closeSearchDrawer();
            }
        });

        // Colour mode toggle
        document.getElementById('color-mode-org').addEventListener('change', () => {
            this.colorMode = 'org';
            this.updateMarkerColors();
        });
        document.getElementById('color-mode-cat').addEventListener('change', () => {
            this.colorMode = 'category';
            this.updateMarkerColors();
        });
    }

    // ── Toggle Panel Minimise ────────────────────────────────
    toggleFilterPanel() {
        const content = document.getElementById('filter-content');
        const btn     = document.getElementById('toggle-filters');
        const icon    = btn.querySelector('i');
        if (content.style.display === 'none') {
            content.style.display = '';
            icon.className = 'bi bi-dash-lg';
            btn.title = 'Minimise panel';
        } else {
            content.style.display = 'none';
            icon.className = 'bi bi-plus-lg';
            btn.title = 'Expand panel';
        }
    }

    // ── Draggable Panel ──────────────────────────────────────
    initDraggablePanel() {
        const panel  = document.getElementById('filter-panel');
        const header = panel.querySelector('.card-header');
        let isDragging = false, startX, startY, initLeft, initTop;

        const onStart = (cx, cy) => {
            isDragging = true;
            panel.classList.add('dragging');
            startX = cx; startY = cy;
            const rect = panel.getBoundingClientRect();
            initLeft = rect.left; initTop = rect.top;
            panel.style.right = 'auto'; panel.style.bottom = 'auto';
            panel.style.left = `${initLeft}px`; panel.style.top = `${initTop}px`;
        };
        const onMove = (cx, cy) => {
            if (!isDragging) return;
            let tl = initLeft + (cx - startX);
            let tt = initTop  + (cy - startY);
            const rect = panel.getBoundingClientRect();
            tl = Math.max(10, Math.min(window.innerWidth  - rect.width  - 10, tl));
            tt = Math.max(10, Math.min(window.innerHeight - rect.height - 10, tt));
            panel.style.left = `${tl}px`; panel.style.top = `${tt}px`;
        };
        const onEnd = () => { isDragging = false; panel.classList.remove('dragging'); };

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.btn-action')) return;
            onStart(e.clientX, e.clientY);
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
        document.addEventListener('mouseup', onEnd);

        header.addEventListener('touchstart', (e) => {
            if (e.target.closest('.btn-action')) return;
            const t = e.touches[0];
            onStart(t.clientX, t.clientY);
        }, { passive: true });
        document.addEventListener('touchmove', (e) => {
            const t = e.touches[0];
            onMove(t.clientX, t.clientY);
        }, { passive: true });
        document.addEventListener('touchend', onEnd);
    }

    // ── Loading Helpers ──────────────────────────────────────
    updateLoadingStatus(msg) {
        const el = document.getElementById('loading-status');
        if (el) el.textContent = msg;
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.transition = 'opacity 0.4s';
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 420);
        }
    }

    showError(msg) {
        this.updateLoadingStatus(msg);
        const spinner = document.querySelector('#loading-overlay .spinner-border');
        if (spinner) spinner.remove();
    }
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => new HeritageCombinedExplorer());
