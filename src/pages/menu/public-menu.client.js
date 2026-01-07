(function() {
  const root = document.querySelector('[data-public-url]');
  if (!root) return;
  const publicUrl = root.dataset.publicUrl || '';

  const loadingEl = document.getElementById('menu-loading');
  const contentEl = document.getElementById('menu-content');
  const errorEl = document.getElementById('menu-error');
  const titleEl = document.getElementById('menu-title');
  const descEl = document.getElementById('menu-description');
  const statusEl = document.getElementById('menu-status');
  const sectionsEl = document.getElementById('menu-sections');
  const restaurantNameEl = document.getElementById('menu-restaurant-name');
  const restaurantMetaEl = document.getElementById('menu-restaurant-meta');
  const restaurantInfoCard = document.getElementById('restaurant-info');
  const restaurantInfoNameEl = document.getElementById('restaurant-info-name');
  const restaurantInfoHoursEl = document.getElementById('restaurant-info-hours');
  const restaurantInfoAddressEl = document.getElementById('restaurant-info-address');
  const restaurantInfoPhoneEl = document.getElementById('restaurant-info-phone');
  const baseStatusClasses = 'inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1';
  // Status badge is hidden on public menu.

  function showError() {
    errorEl?.classList.remove('hidden');
    loadingEl?.classList.add('hidden');
    contentEl?.classList.add('hidden');
  }

  function showContent() {
    loadingEl?.classList.add('hidden');
    errorEl?.classList.add('hidden');
    contentEl?.classList.remove('hidden');
  }

  function formatPrice(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'CLP -';
    const num = Number(value);
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  }

  function normalizeSections(menu) {
    if (Array.isArray(menu?.sections)) return menu.sections;
    if (Array.isArray(menu?.data?.sections)) return menu.data.sections;
    if (Array.isArray(menu?.menu_sections)) return menu.menu_sections;
    if (Array.isArray(menu?.data)) return menu.data;
    return [];
  }

  function normalizeItems(section) {
    if (!section || typeof section !== 'object') return [];
    if (Array.isArray(section.items)) return section.items;
    if (Array.isArray(section.menu_items)) return section.menu_items;
    if (Array.isArray(section.data)) return section.data;
    return [];
  }

  function getSchedule(menu) {
    return (
      menu?.schedule ||
      menu?.opening_hours ||
      menu?.hours ||
      menu?.working_hours ||
      menu?.business_hours ||
      ''
    );
  }

  function renderSections(sections = []) {
    if (!sections.length) {
      sectionsEl.innerHTML = '<p class="text-sm text-muted">Este menú aún no tiene secciones públicas.</p>';
      return;
    }
    const html = sections.map((section) => {
      const items = normalizeItems(section);
      const itemsHtml = items.length
        ? items.map((item) => `
            <li class="flex items-start justify-between gap-2 py-1 border-b border-default/60 last:border-0">
              <div>
                <p class="text-sm font-semibold">${item?.name || 'Plato'}</p>
                ${item?.description ? `<p class="text-xs text-muted">${item.description}</p>` : ''}
              </div>
              <span class="text-sm text-muted">${formatPrice(item?.price)}</span>
            </li>
          `).join('')
        : '<li class="text-xs text-muted">Sin platos aún.</li>';
      return `
        <section class="rounded-lg border border-default p-3 space-y-2 bg-[var(--color-bg-soft)]">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-base font-semibold">${section?.name || 'Sección'}</h2>
              <p class="text-xs text-muted">${section?.description || ''}</p>
            </div>
            <span class="text-xs text-muted">${items.length} platos</span>
          </div>
          <ul class="text-sm space-y-1">
            ${itemsHtml}
          </ul>
        </section>
      `;
    }).join('');
    sectionsEl.innerHTML = html;
  }

  async function loadPublicMenu() {
    if (!publicUrl) {
      console.error('[public menu] missing publicUrl');
      showError();
      return;
    }
    try {
      console.debug('[public menu] fetch', publicUrl);
      const res = await fetch(publicUrl);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'No se pudo cargar el menú público');
      const menu = data?.data || data?.menu || data;
      const sections = normalizeSections(menu);
      titleEl.textContent = menu?.menu_name || menu?.name || 'Menú';
      descEl.textContent = menu?.description || '';
      restaurantNameEl.textContent = menu?.restaurant_name || '';
      const restaurantMeta = [menu?.restaurant_slug, menu?.address, menu?.phone].filter(Boolean).join(' • ');
      restaurantMetaEl.textContent = restaurantMeta;
      statusEl.textContent = '';
      statusEl.className = 'hidden';

      const hours = getSchedule(menu);
      const address = menu?.address || '';
      const phone = menu?.phone || '';
      const restaurantDisplayName = menu?.restaurant_name || menu?.restaurant_slug || '';
      restaurantInfoNameEl.textContent = restaurantDisplayName || 'Restaurante';
      restaurantInfoHoursEl.textContent = hours || '';
      restaurantInfoAddressEl.textContent = address;
      restaurantInfoPhoneEl.textContent = phone;
      const hasInfo = [restaurantDisplayName, hours, address, phone].some(Boolean);
      if (hasInfo) {
        restaurantInfoCard?.classList.remove('hidden');
      } else {
        restaurantInfoCard?.classList.add('hidden');
      }
      renderSections(sections);
      showContent();
    } catch (err) {
      console.error('[public menu] error', err);
      showError();
    }
  }

  loadPublicMenu();
})();
