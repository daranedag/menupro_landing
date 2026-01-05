import { toDataURL } from 'qrcode';

(function() {
  const root = document.getElementById('menus-root');
  const alertEl = document.getElementById('menus-alert');
  const statusEl = document.getElementById('menus-status');
  const listEl = document.getElementById('menus-list');
  const createBtn = document.getElementById('create-menu-btn');
  const headerEl = document.getElementById('menus-header');
  const limitHintEl = document.getElementById('menus-limit-hint');
  const loadingEl = document.getElementById('menus-loading');
  const contentEl = document.getElementById('menus-content');

  const defaultCreateLabel = createBtn?.dataset?.defaultLabel || createBtn?.textContent?.trim() || 'Crear nueva carta';
  const defaultCreateHref = createBtn?.getAttribute('href') || '';

  const rawBase = root?.dataset.apiBase || 'http://localhost:3000';
  const trimmedBase = rawBase.replace(/\/$/, '');
  const apiBase = trimmedBase.includes('/api') ? trimmedBase : `${trimmedBase}/api`;

  const token = localStorage.getItem('supabase_token');
  const restaurantId = localStorage.getItem('restaurant_id');
  const restaurantSlug = localStorage.getItem('restaurant_slug') || '';
  const userTier = normalizeTierKey(localStorage.getItem('user_tier') || 'free');
  let cachedTierLimits = {};
  let maxMenus = Infinity;
  let draggingSectionEl = null;
  let draggingDishEl = null;
  let draggingDishOrigin = null;

  if (!token) {
    showAlert('No hay sesión activa. Inicia sesión para continuar.');
    statusEl.textContent = 'Sesión requerida.';
    setTimeout(() => (window.location.href = '/app/login'), 1000);
    return;
  }

  if (!restaurantId) {
    showAlert('Debes crear un restaurante antes de gestionar cartas.');
    statusEl.textContent = 'Restaurante requerido.';
    setTimeout(() => (window.location.href = '/app/settings'), 1000);
    return;
  }

  function normalizeTierKey(key) {
    const raw = (key || '').toString().trim().toLowerCase();
    const cleaned = raw.replace(/\s+/g, '_').replace(/\+/g, '_').replace(/-/g, '_');
    if (cleaned.includes('free') || cleaned.includes('gratis')) return 'free';
    return cleaned || 'free';
  }

  const tierCaps = {
    free: { maxMenus: 1, maxRestaurants: 1 },
    basico: { maxMenus: 1, maxRestaurants: 1 },
    pro: { maxMenus: 3, maxRestaurants: 3 },
    pro_plus: { maxMenus: 0, maxRestaurants: 0 },
  };

  function getTierCaps(tierKey) {
    const normalized = normalizeTierKey(tierKey);
    return tierCaps[normalized] || tierCaps.free;
  }

  function formatTierLabel(key) {
    const normalized = normalizeTierKey(key);
    if (normalized === 'pro_plus') return 'Pro+';
    if (normalized === 'basico') return 'Básico';
    if (normalized === 'pro') return 'Pro';
    return 'Free';
  }

  function parseLimitNumber(value) {
    if (value === null || value === undefined) return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  function parseCachedLimit(value) {
    if (value === undefined || value === null) return undefined;
    if (value === 'Infinity') return Infinity;
    return parseLimitNumber(value);
  }

  function normalizeLimitForTier(limitValue, tierKey) {
    if (limitValue === Infinity) return Infinity;
    const parsed = parseLimitNumber(limitValue);
    if (parsed === 0) return Infinity;
    if (Number.isFinite(parsed)) return parsed;

    const caps = getTierCaps(tierKey);
    const cap = caps.maxMenus;
    if (cap === 0) return Infinity;
    if (Number.isFinite(cap)) return cap;

    const normalized = normalizeTierKey(tierKey);
    if (normalized === 'free') return 1;
    return Infinity;
  }

  function serializeLimitsForStorage(limits) {
    if (!limits || typeof limits !== 'object') return {};
    const toStore = { ...limits };
    if (toStore.maxMenus === Infinity) toStore.maxMenus = 0;
    return toStore;
  }

  function enforceTierCaps() {
    const caps = getTierCaps(userTier);
    maxMenus = caps.maxMenus === 0 ? Infinity : caps.maxMenus;
  }

  function extractMaxMenusFromTier(tier) {
    if (!tier || typeof tier !== 'object') return undefined;
    const direct = parseLimitNumber(tier.max_menus ?? tier.menu_limit ?? tier.maxMenus ?? tier.limit_menus);
    if (Number.isFinite(direct)) return direct;
    const nested = parseLimitNumber(tier?.limits?.menus);
    if (Number.isFinite(nested)) return nested;
    const caps = getTierCaps(tier?.tier_name || tier?.slug || tier?.id || userTier);
    if (Number.isFinite(caps.maxMenus) || caps.maxMenus === 0) return caps.maxMenus;
    return undefined;
  }

  async function hydrateTierLimits() {
    try {
      const cached = JSON.parse(localStorage.getItem('tier_limits') || '{}');
      cachedTierLimits = cached && typeof cached === 'object' ? cached : {};
      const cachedMaxMenus = parseCachedLimit(cached?.maxMenus);
      if (Number.isFinite(cachedMaxMenus)) {
        maxMenus = normalizeLimitForTier(cachedMaxMenus, userTier);
        enforceTierCaps();
        enforceMenuLimit(0);
      }
    } catch (_e) {}

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${apiBase}/subscriptions/tiers`, { headers });
      const tiersPayload = await res.json().catch(() => ({}));
      const list = Array.isArray(tiersPayload?.data)
        ? tiersPayload.data
        : Array.isArray(tiersPayload?.tiers)
          ? tiersPayload.tiers
          : Array.isArray(tiersPayload)
            ? tiersPayload
            : [];
      const caps = getTierCaps(userTier);
      const storeCaps = { ...caps };

      if (!Array.isArray(list) || !list.length) {
        enforceTierCaps();
        const toStore = serializeLimitsForStorage(storeCaps);
        localStorage.setItem('tier_limits', JSON.stringify(toStore));
        enforceMenuLimit(0);
        return;
      }

      const currentTier = list.find((t) => normalizeTierKey(t?.tier_name || t?.slug || t?.id || t?.name) === userTier);
      const extracted = extractMaxMenusFromTier(currentTier);
      const normalized = normalizeLimitForTier(Number.isFinite(extracted) ? extracted : caps.maxMenus, userTier);
      maxMenus = normalized;
      enforceTierCaps();
      storeCaps.maxMenus = Number.isFinite(extracted) || extracted === 0 ? extracted : caps.maxMenus;
      const toStore = serializeLimitsForStorage(storeCaps);
      localStorage.setItem('tier_limits', JSON.stringify(toStore));
      enforceMenuLimit(0);
    } catch (_err) {
      const caps = getTierCaps(userTier);
      maxMenus = normalizeLimitForTier(caps.maxMenus, userTier);
      enforceTierCaps();
      const toStore = serializeLimitsForStorage(caps);
      localStorage.setItem('tier_limits', JSON.stringify(toStore));
    }
  }

  function enforceMenuLimit(currentCount) {
    if (!createBtn) return;
    const capped = maxMenus !== Infinity && currentCount >= maxMenus;

    if (capped) {
      createBtn.setAttribute('aria-disabled', 'true');
      createBtn.classList.add('pointer-events-none', 'opacity-60', 'cursor-not-allowed');
      createBtn.textContent = 'Límite de cartas alcanzado';
    } else {
      createBtn.removeAttribute('aria-disabled');
      createBtn.classList.remove('pointer-events-none', 'opacity-60', 'cursor-not-allowed');
      createBtn.textContent = defaultCreateLabel;
    }

    if (limitHintEl) {
      const caps = getTierCaps(userTier);
      const capLabel = caps.maxMenus === 0 ? 'ilimitado' : String(caps.maxMenus);
      if (caps.maxMenus === 0) {
        limitHintEl.textContent = `Plan ${formatTierLabel(userTier)}: cartas ilimitadas`;
      } else {
        limitHintEl.textContent = capped
          ? `Has alcanzado ${currentCount}/${capLabel} cartas en tu plan ${formatTierLabel(userTier)}.`
          : `Cartas usadas: ${currentCount}/${capLabel} en tu plan ${formatTierLabel(userTier)}.`;
      }
    }
  }

  init();

  async function init() {
    setLoading(true);
    await hydrateTierLimits();
    await loadMenus();
    setLoading(false);
  }

  async function loadMenus() {
    setLoading(true);
    statusEl.textContent = 'Cargando cartas...';
    try {
      const res = await fetch(`${apiBase}/menus/restaurant/${restaurantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'No se pudo cargar las cartas');

      const menusBase = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.menus)
          ? data.menus
          : Array.isArray(data)
            ? data
            : [];

      const menusWithSections = await hydrateMenusWithSections(menusBase);
      renderMenus(menusWithSections);
      enforceMenuLimit(menusWithSections.length);
      statusEl.textContent = menusWithSections.length ? `${menusWithSections.length} cartas encontradas` : 'Aún no tienes cartas.';
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'Error al cargar las cartas');
      statusEl.textContent = 'Error al cargar las cartas';
    } finally {
      setLoading(false);
    }
  }

  async function hydrateMenusWithSections(menus) {
    if (!Array.isArray(menus) || !menus.length) return [];
    try {
      const enriched = await Promise.all(menus.map(async (menu) => {
        if (!menu?.id) return menu;
        try {
          const res = await fetch(`${apiBase}/menus/${menu.id}/sections`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error();
          const sections = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.sections)
              ? payload.sections
              : Array.isArray(payload)
                ? payload
                : [];
          const sectionsWithItems = await hydrateSectionsWithItems(sections);
          return { ...menu, sections: sectionsWithItems };
        } catch (_e) {
          return { ...menu, sections: Array.isArray(menu?.sections) ? menu.sections : [] };
        }
      }));
      return enriched;
    } catch (_err) {
      return menus;
    }
  }

  async function hydrateSectionsWithItems(sections) {
    if (!Array.isArray(sections) || !sections.length) return sections;
    try {
      const enriched = await Promise.all(sections.map(async (section) => {
        if (!section?.id) return section;
        try {
          const res = await fetch(`${apiBase}/menus/sections/${section.id}/items`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error();
          const items = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.items)
              ? payload.items
              : Array.isArray(payload)
                ? payload
                : [];
          return { ...section, items };
        } catch (_err) {
          return section;
        }
      }));
      return enriched;
    } catch (_err) {
      return sections;
    }
  }

  function renderMenus(menus) {
    if (!listEl) return;
    if (!menus.length) {
      listEl.innerHTML = '<div class="rounded-xl border border-dashed border-default p-4 text-sm text-muted">Crea tu primera carta para comenzar.</div>';
      return;
    }

    const cards = menus.map((menu) => {
      const sections = Array.isArray(menu?.sections) ? menu.sections : [];
      const totalDishes = sections.reduce((acc, sec) => acc + (sec?.items?.length || 0), 0);
      const sectionsList = sections.map((sec) => buildSectionHtml(sec, menu?.id)).join('');
      const sectionOptions = sections.map((sec) => `<option value="${sec?.id}">${sec?.name || 'Sección'}</option>`).join('');
      const isPublished = Boolean(menu?.is_published);
      const views = menu?.view_count ?? 0;
      const slug = menu?.slug || '';
      const qrUrl = menu?.qr_code_url || '';
      const restaurantSlugForMenu = menu?.restaurant?.slug || restaurantSlug || '';
      const publicPath = restaurantSlugForMenu && slug ? `/menu/${restaurantSlugForMenu}/${slug}` : '';

      return `
        <div class="rounded-xl border border-default bg-white dark:bg-neutral-900 p-5 shadow-sm space-y-4">
          <div class="flex flex-col gap-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${isPublished ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'}">
                    <span class="h-2 w-2 rounded-full ${isPublished ? 'bg-green-500' : 'bg-amber-500'}"></span>
                    ${isPublished ? 'Publicado' : 'Borrador'}
                  </span>
                </div>
                <div class="space-y-2">
                  <h2 class="text-xl font-semibold">${menu?.name || 'Sin nombre'}</h2>
                  <p class="text-sm text-muted italic">${menu?.description || 'Sin descripción'}</p>
                  <div class="flex flex-col md:flex-row items-start gap-3 w-full">
                    <form class="title-form flex flex-col md:flex-row flex-1 items-start gap-2" data-menu-id="${menu?.id}">
                      <input
                        type="text"
                        name="menu_title"
                        value="${menu?.name || ''}"
                        class="w-full md:w-64 rounded-lg border border-default px-3 py-2 bg-white dark:bg-neutral-950 text-sm"
                        placeholder="Nuevo título"
                        required
                      />
                      <button type="submit" class="btn-primary px-3 py-2 rounded-lg text-sm font-semibold">Guardar</button>
                    </form>
                    <form class="description-form flex flex-col md:flex-row flex-1 items-start gap-2" data-menu-id="${menu?.id}">
                      <textarea
                        id="menu-description-${menu?.id}"
                        name="menu_description"
                        rows="2"
                        class="w-full rounded-lg border border-default px-3 py-2 bg-white dark:bg-neutral-950 text-sm min-h-[42px]"
                        placeholder="Añade una descripción para esta carta"
                        aria-label="Descripción de la carta"
                      >${menu?.description || ''}</textarea>
                      <button type="submit" class="btn-primary px-3 py-2 rounded-lg text-sm font-semibold">Guardar</button>
                    </form>
                  </div>
                </div>
                <div class="flex items-center gap-3 text-xs text-muted">
                  <span data-sections-count="${menu?.id}">${sections.length} secciones</span>
                  <span data-dishes-count="${menu?.id}">${totalDishes} platos</span>
                </div>
              </div>
              <div class="flex flex-col items-end gap-2 text-sm">
                ${publicPath
                  ? `<a class="text-[var(--color-accent)] underline" href="${publicPath}" target="_blank" rel="noreferrer">${isPublished ? 'Ver público' : 'Preview'}</a>`
                  : '<span class="text-xs text-muted">Slug no disponible</span>'}
                <div class="flex flex-wrap gap-2 justify-end">
                  <button type="button" class="publish-toggle-btn inline-flex items-center gap-2 rounded-lg border border-default px-3 py-2 text-sm font-semibold ${isPublished ? 'bg-white dark:bg-neutral-950' : 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'}" data-menu-id="${menu?.id}" data-published="${isPublished}">
                    ${isPublished ? 'Despublicar' : 'Publicar'}
                  </button>
                  <button
                    type="button"
                    class="generate-qr-btn inline-flex items-center gap-2 rounded-lg border border-default px-3 py-2 text-sm font-semibold"
                    data-menu-id="${menu?.id}"
                    data-slug="${slug}"
                    data-restaurant-slug="${restaurantSlugForMenu}"
                    data-tooltip="Genera el QR y descárgalo para usarlo en sala o impresión."
                  >
                    Generar QR
                  </button>
                </div>
                <div class="flex items-start gap-3 flex-wrap justify-end w-full">
                  <div class="rounded-lg border border-default bg-[var(--color-bg-soft)] px-4 py-3">
                    <p class="text-xs text-muted">Vistas</p>
                    <p class="text-sm font-semibold">${views}</p>
                  </div>
                  <div class="rounded-lg border border-default bg-[var(--color-bg-soft)] px-4 py-3">
                    <p class="text-xs text-muted">Slug</p>
                    <p class="text-sm font-semibold">${slug || '—'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <img data-qr-img="${menu?.id}" src="${qrUrl || ''}" alt="QR de ${menu?.name || 'carta'}" class="h-24 w-24 border border-default rounded ${qrUrl ? '' : 'hidden'}" />
            </div>
          </div>

          <div class="space-y-3" data-sections-container="${menu?.id}">
            <h3 class="text-sm font-semibold">Secciones</h3>
            ${sectionsList || '<p class="text-sm text-muted">Sin secciones aún.</p>'}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form class="section-form space-y-2 rounded-lg border border-default p-3 bg-[var(--color-bg-soft)]" data-menu-id="${menu?.id}" data-next-order="${sections.length}">
              <p class="text-sm font-semibold">Crear sección</p>
              <input type="text" name="section_name" required class="w-full rounded-lg border border-default px-3 py-2 bg-white dark:bg-neutral-950 text-sm" placeholder="Ej: Entradas" />
              <textarea name="section_description" rows="2" class="w-full rounded-lg border border-default px-3 py-2 bg-white dark:bg-neutral-950 text-sm" placeholder="Descripción (opcional)"></textarea>
              <button type="submit" class="btn-primary px-3 py-2 rounded-lg text-sm font-semibold">Guardar sección</button>
            </form>

            <form class="dish-form space-y-2 rounded-lg border border-default p-3 bg-[var(--color-bg-soft)]" data-menu-id="${menu?.id}">
              <p class="text-sm font-semibold">Crear plato</p>
              <select name="section_id" required class="w-full rounded-lg border border-default px-3 py-2 bg-white dark:bg-neutral-950 text-sm">
                <option value="">Selecciona sección</option>
                ${sectionOptions}
              </select>
              <input type="text" name="dish_name" required class="w-full rounded-lg border border-default px-3 py-2 bg-white dark:bg-neutral-950 text-sm" placeholder="Nombre del plato" />
              <textarea name="dish_description" rows="2" class="w-full rounded-lg border border-default px-3 py-2 bg-white dark:bg-neutral-950 text-sm" placeholder="Descripción (opcional)"></textarea>
              <input type="number" min="0" step="0.01" name="dish_price" required class="w-full rounded-lg border border-default px-3 py-2 bg-white dark:bg-neutral-950 text-sm" placeholder="Precio" />
              <button type="submit" class="btn-primary px-3 py-2 rounded-lg text-sm font-semibold">Guardar plato</button>
            </form>
          </div>
        </div>
      `;
    }).join('');

    listEl.innerHTML = cards;

    attachSectionFormHandlers();
    attachDishFormHandlers();
    attachPublishHandlers();
    attachQrHandlers();
    attachTitleFormHandlers();
    attachDescriptionFormHandlers();
    attachSectionDragAndDrop();
    attachDishDragAndDrop();
  }

  function attachSectionFormHandlers() {
    const forms = listEl?.querySelectorAll('.section-form');
    forms?.forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const target = e.currentTarget;
        const menuId = target?.dataset?.menuId;
        const nextOrderRaw = target?.dataset?.nextOrder;
        const name = target?.section_name?.value?.trim();
        const description = target?.section_description?.value?.trim();
        if (!menuId || !name) return;
        const orderIndex = Number.isFinite(Number(nextOrderRaw)) ? Number(nextOrderRaw) : 0;
        setStatus('Creando sección...');
        try {
          const payload = description ? { name, description, order_index: orderIndex } : { name, order_index: orderIndex };
          const res = await fetch(`${apiBase}/menus/${menuId}/sections`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.message || 'No se pudo crear la sección');
          const newSection = data?.data || data?.section || data;
          setStatus('Sección creada.');
          if (newSection?.id) {
            appendSectionToMenu(menuId, newSection);
          } else {
            // fallback a recarga de datos si la API no devolvió la sección
            loadMenus();
          }
        } catch (err) {
          setStatus(err instanceof Error ? err.message : 'Error al crear sección', true);
        }
      });
    });
  }

  function appendSectionToMenu(menuId, section) {
    const container = listEl?.querySelector(`[data-sections-container="${menuId}"]`);
    if (!container) return;
    const sectionHtml = buildSectionHtml(section, menuId);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = sectionHtml.trim();
    const card = wrapper.firstElementChild;
    if (!card) return;
    container.appendChild(card);
    // actualizar conteo y orden siguiente
    const currentCount = container.querySelectorAll('[data-section-id]').length;
    syncNextOrderForMenu(menuId, currentCount);
    updateSectionsCount(menuId, currentCount);
    addSectionToDishSelect(menuId, section);
    // reactivar drag & drop en el contenedor actualizado
    attachSectionDragAndDrop(container);
    attachDishDragAndDrop(card);
  }

  function attachTitleFormHandlers() {
    const forms = listEl?.querySelectorAll('.title-form');
    forms?.forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const target = e.currentTarget;
        const menuId = target?.dataset?.menuId;
        const title = target?.menu_title?.value?.trim();
        if (!menuId || !title) return;
        setStatus('Actualizando título...');
        const submitBtn = target.querySelector('button[type="submit"]');
        try {
          submitBtn?.setAttribute('disabled', 'true');
          const res = await fetch(`${apiBase}/menus/${menuId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: title }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.message || 'No se pudo actualizar el título');
          setStatus('Título actualizado.');
          loadMenus();
        } catch (err) {
          setStatus(err instanceof Error ? err.message : 'Error al actualizar el título', true);
        } finally {
          submitBtn?.removeAttribute('disabled');
        }
      });
    });
  }

  function attachDescriptionFormHandlers() {
    const forms = listEl?.querySelectorAll('.description-form');
    forms?.forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const target = e.currentTarget;
        const menuId = target?.dataset?.menuId;
        const descriptionRaw = target?.menu_description?.value ?? '';
        if (!menuId) return;
        setStatus('Actualizando descripción...');
        const submitBtn = target.querySelector('button[type="submit"]');
        try {
          submitBtn?.setAttribute('disabled', 'true');
          const res = await fetch(`${apiBase}/menus/${menuId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ description: descriptionRaw.trim() }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.message || 'No se pudo actualizar la descripción');
          setStatus('Descripción actualizada.');
          loadMenus();
        } catch (err) {
          setStatus(err instanceof Error ? err.message : 'Error al actualizar la descripción', true);
        } finally {
          submitBtn?.removeAttribute('disabled');
        }
      });
    });
  }

  function attachSectionDragAndDrop(containerOverride) {
    const containers = containerOverride ? [containerOverride] : listEl?.querySelectorAll('[data-sections-container]');
    containers?.forEach((container) => {
      container.addEventListener('dragover', handleSectionDragOver);
      container.addEventListener('drop', handleSectionDrop);
      const cards = container.querySelectorAll('[data-section-id]');
      cards.forEach((card) => {
        card.setAttribute('draggable', 'false');
        const handle = card.querySelector('.section-handle');
        if (handle) {
          handle.setAttribute('draggable', 'true');
          handle.addEventListener('dragstart', handleSectionDragStart);
          handle.addEventListener('dragend', handleSectionDragEnd);
        }
      });
    });
  }

  function attachDishDragAndDrop(containerOverride) {
    const sections = containerOverride ? [containerOverride] : listEl?.querySelectorAll('[data-section-id]');
    sections?.forEach((section) => {
      const list = section.querySelector('ul');
      if (!list) return;
      list.addEventListener('dragover', handleDishDragOver);
      list.addEventListener('drop', handleDishDrop);
      list.querySelectorAll('.dish-item').forEach((item) => {
        item.setAttribute('draggable', 'true');
        item.addEventListener('dragstart', handleDishDragStart);
        item.addEventListener('dragend', handleDishDragEnd);
        const handle = item.querySelector('.dish-handle');
        if (handle) {
          handle.setAttribute('draggable', 'true');
          handle.addEventListener('dragstart', handleDishDragStart);
          handle.addEventListener('dragend', handleDishDragEnd);
        }
      });
    });
  }

  function handleDishDragStart(e) {
    const target = e.currentTarget.closest('.dish-item') || e.currentTarget;
    const fromHandle = e.target.closest('.drag-handle');
    if (!fromHandle) {
      e.preventDefault();
      return;
    }
    draggingDishEl = target;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // algunos navegadores requieren un payload para habilitar el drag
      e.dataTransfer.setData('text/plain', 'drag-dish');
    }
    const originSection = target.closest('[data-section-id]');
    draggingDishOrigin = {
      sectionId: originSection?.dataset?.sectionId,
      menuId: originSection?.dataset?.menuId,
    };
    target.classList.add('dragging');
  }

  function handleDishDragEnd() {
    if (draggingDishEl) draggingDishEl.classList.remove('dragging');
    draggingDishEl = null;
    draggingDishOrigin = null;
  }

  function handleDishDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingDishEl) return;
    const list = e.currentTarget;
    removeEmptyPlaceholders(list);
    const afterEl = getDishAfterElement(list, e.clientY);
    if (!afterEl) {
      list.appendChild(draggingDishEl);
    } else {
      list.insertBefore(draggingDishEl, afterEl);
    }
  }

  async function handleDishDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const list = e.currentTarget;
    const sectionCard = list.closest('[data-section-id]');
    const sectionId = sectionCard?.dataset?.sectionId;
    const menuId = sectionCard?.dataset?.menuId;
    const sourceSectionId = draggingDishOrigin?.sectionId;
    const sourceMenuId = draggingDishOrigin?.menuId;
    const sourceSectionCard = sourceSectionId
      ? listEl?.querySelector(`[data-section-id="${sourceSectionId}"]`)
      : draggingDishEl?.closest('[data-section-id]');
    const dishId = draggingDishEl?.dataset?.dishId;
    if (!sectionId) return;
    const ordered = Array.from(list.querySelectorAll('.dish-item')).map((el, idx) => ({
      id: el?.dataset?.dishId,
      order_index: idx,
    })).filter((entry) => entry.id);

    // mover dentro de la misma sección
    if (!sourceSectionId || sourceSectionId === sectionId) {
      if (menuId) updateDishesCount(menuId, ordered.length);
      await persistDishOrder(sectionId, ordered);
      ensureEmptyPlaceholder(sourceSectionCard?.querySelector('ul'));
      return;
    }

    // mover entre secciones: validar mismo menú
    if (sourceMenuId && menuId && sourceMenuId !== menuId) {
      setStatus('Solo puedes mover platos dentro del mismo menú.', true);
      loadMenus();
      return;
    }

    if (!dishId) return;
    const newIndex = ordered.findIndex((o) => o.id === dishId);
    const sourceList = sourceSectionCard?.querySelector('ul');

    // limpiar placeholders
    removeEmptyPlaceholders(list);
    removeEmptyPlaceholders(sourceList);

    // persistir movimiento y luego reordenar la lista de origen
    await persistDishMove(sourceSectionId, dishId, sectionId, newIndex);
    if (menuId) updateDishesCount(menuId, ordered.length);
    const sourceOrdered = Array.from(sourceList?.querySelectorAll('.dish-item') || []).map((el, idx) => ({
      id: el?.dataset?.dishId,
      order_index: idx,
    })).filter((entry) => entry.id);
    if (sourceMenuId) updateDishesCount(sourceMenuId, sourceOrdered.length);
    ensureEmptyPlaceholder(sourceList);
    await persistDishOrder(sourceSectionId, sourceOrdered, { silent: true });
  }

  function getDishAfterElement(list, y) {
    const elements = [...list.querySelectorAll('.dish-item:not(.dragging)')];
    return elements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  function handleSectionDragStart(e) {
    const target = e.currentTarget.closest('[data-section-id]') || e.currentTarget;
    const fromHandle = e.target.closest('.drag-handle');
    if (!fromHandle) {
      e.preventDefault();
      return;
    }
    draggingSectionEl = target;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'drag-section');
    }
    target.classList.add('dragging');
  }

  function handleSectionDragEnd() {
    if (draggingSectionEl) draggingSectionEl.classList.remove('dragging');
    draggingSectionEl = null;
  }

  function handleSectionDragOver(e) {
    e.preventDefault();
    if (!draggingSectionEl) return;
    const container = e.currentTarget;
    const afterEl = getSectionAfterElement(container, e.clientY);
    if (!afterEl) {
      container.appendChild(draggingSectionEl);
    } else {
      container.insertBefore(draggingSectionEl, afterEl);
    }
  }

  async function handleSectionDrop(e) {
    e.preventDefault();
    if (!draggingSectionEl) return;
    const container = e.currentTarget;
    const menuId = container?.dataset?.sectionsContainer;
    if (!menuId) return;
    const ordered = Array.from(container.querySelectorAll('[data-section-id]')).map((el, idx) => ({
      id: el?.dataset?.sectionId,
      order_index: idx,
    })).filter((entry) => entry.id);
    syncNextOrderForMenu(menuId, ordered.length);
    updateSectionsCount(menuId, ordered.length);
    await persistSectionOrder(menuId, ordered);
  }

  function getSectionAfterElement(container, y) {
    const elements = [...container.querySelectorAll('[data-section-id]:not(.dragging)')];
    return elements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  async function persistSectionOrder(menuId, ordered) {
    if (!Array.isArray(ordered) || !ordered.length) return;
    setStatus('Actualizando orden de secciones...');
    try {
      const res = await fetch(`${apiBase}/menus/${menuId}/sections/reorder`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sections: ordered }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'No se pudo reordenar las secciones');
      setStatus('Orden actualizado.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'No se pudo reordenar las secciones', true);
    }
  }

  async function persistDishOrder(sectionId, ordered, options = {}) {
    const { silent = false } = options;
    if (!Array.isArray(ordered) || !ordered.length) return;
    if (!silent) setStatus('Actualizando orden de platos...');
    try {
      const res = await fetch(`${apiBase}/menus/sections/${sectionId}/items/reorder`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: ordered }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'No se pudo reordenar los platos');
      if (!silent) setStatus('Orden actualizado.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'No se pudo reordenar los platos', true);
    }
  }

  async function persistDishMove(sourceSectionId, itemId, targetSectionId, orderIndex) {
    if (!sourceSectionId || !itemId || !targetSectionId) return;
    setStatus('Moviendo plato...');
    try {
      const res = await fetch(`${apiBase}/menus/sections/${sourceSectionId}/items/${itemId}/move`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target_section_id: targetSectionId, order_index: orderIndex }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'No se pudo mover el plato');
      setStatus('Orden actualizado.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'No se pudo mover el plato', true);
      loadMenus();
    }
  }

  function removeEmptyPlaceholders(list) {
    list?.querySelectorAll('li.text-xs.text-muted').forEach((el) => el.remove());
  }

  function ensureEmptyPlaceholder(list) {
    if (!list) return;
    const hasDish = list.querySelector('.dish-item');
    if (!hasDish && !list.querySelector('li.text-xs.text-muted')) {
      const li = document.createElement('li');
      li.className = 'text-xs text-muted';
      li.textContent = 'Sin platos aún.';
      list.appendChild(li);
    }
  }

  function updateSectionsCount(menuId, count) {
    const countEl = listEl?.querySelector(`[data-sections-count="${menuId}"]`);
    if (countEl) countEl.textContent = `${count} secciones`;
  }

  function addSectionToDishSelect(menuId, section) {
    const select = listEl?.querySelector(`form.dish-form[data-menu-id="${menuId}"] select[name="section_id"]`);
    if (!select || !section?.id) return;
    const option = document.createElement('option');
    option.value = section.id;
    option.textContent = section?.name || 'Sección';
    select.appendChild(option);
  }

  function appendDishToSection(menuId, sectionId, dish) {
    const sectionCard = listEl?.querySelector(`[data-section-id="${sectionId}"]`);
    const list = sectionCard?.querySelector('ul');
    if (!sectionCard || !list) return;
    // remove empty state if present
    list.querySelectorAll('li.text-xs.text-muted').forEach((el) => el.remove());
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildDishHtml(dish).trim();
    const li = wrapper.firstElementChild;
    if (!li) return;
    list.appendChild(li);
    const count = list.querySelectorAll('.dish-item').length;
    updateDishesCount(menuId, count);
    attachDishDragAndDrop(sectionCard);
  }

  function syncNextOrderForMenu(menuId, count) {
    const form = listEl?.querySelector(`form.section-form[data-menu-id="${menuId}"]`);
    if (form) form.dataset.nextOrder = String(count);
  }

  function updateDishesCount(menuId, count) {
    const countEl = listEl?.querySelector(`[data-dishes-count="${menuId}"]`);
    if (countEl) countEl.textContent = `${count} platos`;
  }

  function buildSectionHtml(sec, menuId) {
    const dishes = Array.isArray(sec?.items) ? sec.items : [];
    const orderIndex = Number.isFinite(Number(sec?.order_index)) ? Number(sec.order_index) : 0;
    return `
      <div class="rounded-lg border border-default p-3 bg-[var(--color-bg-soft)] space-y-2 section-card" data-section-id="${sec?.id}" data-menu-id="${menuId || ''}" data-order-index="${orderIndex}" draggable="true">
        <div class="flex items-stretch gap-3">
          <span class="drag-handle section-handle self-stretch w-2 min-h-full rounded bg-white/60 dark:bg-neutral-950/60 border border-dashed border-default/60 cursor-grab active:cursor-grabbing" aria-label="Mover sección"></span>
          <div class="flex-1 flex items-start justify-between gap-2 text-sm font-semibold">
            <div>
              <span>${sec?.name || 'Sección'}</span>
              <p class="text-xs text-muted">${sec?.description || 'Sin descripción'}</p>
            </div>
            <span class="text-muted">${dishes.length} platos</span>
          </div>
        </div>
        <ul class="text-sm text-muted space-y-1">
          ${dishes.length
            ? dishes.map((d) => buildDishHtml(d)).join('')
            : '<li class="text-xs text-muted">Sin platos aún.</li>'}
        </ul>
      </div>
    `;
  }

  function buildDishHtml(dish) {
    const priceLabel = dish?.price !== undefined && dish?.price !== null ? formatPrice(dish.price) : 'S/‑';
    const dishDescription = dish?.description ? `<p class="text-xs text-muted">${dish.description}</p>` : '';
    const orderIndex = Number.isFinite(Number(dish?.order_index)) ? Number(dish.order_index) : 0;
    return `
      <li class="rounded border border-default px-3 py-2 bg-white/40 dark:bg-neutral-950/40 dish-item" data-dish-id="${dish?.id}" data-order-index="${orderIndex}" draggable="true">
        <div class="flex items-start gap-3">
          <span class="drag-handle dish-handle mt-0.5 h-8 w-2 rounded bg-white/60 dark:bg-neutral-950/60 border border-dashed border-default/60 cursor-grab active:cursor-grabbing" aria-label="Mover plato"></span>
          <div class="flex-1 space-y-1">
            <div class="flex items-center justify-between gap-2 text-sm">
              <span class="font-medium">${dish?.name || 'Plato'}</span>
              <span class="text-muted">${priceLabel}</span>
            </div>
            ${dishDescription}
          </div>
        </div>
      </li>
    `;
  }

  function attachDishFormHandlers() {
    const forms = listEl?.querySelectorAll('.dish-form');
    forms?.forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const target = e.currentTarget;
        const menuId = target?.dataset?.menuId;
        const sectionId = target?.section_id?.value;
        const dishName = target?.dish_name?.value?.trim();
        const dishDescription = target?.dish_description?.value?.trim();
        const dishPriceRaw = target?.dish_price?.value;
        const dishPrice = dishPriceRaw ? Number(dishPriceRaw) : NaN;
        if (!menuId || !sectionId || !dishName || Number.isNaN(dishPrice)) {
          setStatus('Completa nombre, precio y sección para crear el plato.', true);
          return;
        }
        setStatus('Creando plato...');
        try {
          // usa order_index secuencial al tamaño actual de la sección
          const sectionCard = listEl?.querySelector(`[data-section-id="${sectionId}"]`);
          const currentItems = sectionCard?.querySelectorAll('.dish-item') || [];
          const nextOrderIndex = currentItems.length;

          const body = { name: dishName, price: dishPrice, order_index: nextOrderIndex };
          if (dishDescription) body.description = dishDescription;
          const res = await fetch(`${apiBase}/menus/sections/${sectionId}/items`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.message || 'No se pudo crear el plato');
          const newDish = data?.data || data?.item || data;
          setStatus('Plato creado.');
          if (newDish?.id) {
            appendDishToSection(menuId, sectionId, newDish);
          } else {
            loadMenus();
          }
        } catch (err) {
          setStatus(err instanceof Error ? err.message : 'Error al crear plato', true);
        }
      });
    });
  }

  function attachPublishHandlers() {
    const buttons = listEl?.querySelectorAll('.publish-toggle-btn');
    buttons?.forEach((button) => {
      button.addEventListener('click', async () => {
        const menuId = button?.dataset?.menuId;
        const isPublished = button?.dataset?.published === 'true';
        if (!menuId) return;
        await updateMenuPublish(menuId, !isPublished, button);
      });
    });
  }

  async function updateMenuPublish(menuId, shouldPublish, buttonEl) {
    setStatus(shouldPublish ? 'Publicando carta...' : 'Despublicando carta...');
    try {
      buttonEl?.setAttribute('disabled', 'true');
      const res = await fetch(`${apiBase}/menus/${menuId}/publish`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_published: shouldPublish }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'No se pudo actualizar la carta');
      setStatus('Estado actualizado.');
      loadMenus();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Error al actualizar la carta', true);
    } finally {
      buttonEl?.removeAttribute('disabled');
    }
  }

  function attachQrHandlers() {
    const buttons = listEl?.querySelectorAll('.generate-qr-btn');
    buttons?.forEach((button) => {
      button.addEventListener('click', async () => {
        const menuId = button?.dataset?.menuId;
        const slug = button?.dataset?.slug;
        const restaurantSlugForMenu = button?.dataset?.restaurantSlug || restaurantSlug;
        const targetImg = listEl?.querySelector(`img[data-qr-img="${menuId}"]`);
        if (!menuId || !slug || !restaurantSlugForMenu || !targetImg) {
          setStatus('Falta información para generar el QR.', true);
          return;
        }
        const host = window.location.origin.replace(/\/$/, '');
        const url = `${host}/menu/${restaurantSlugForMenu}/${slug}`;
        await generateQr(targetImg, url, button);
      });
    });
  }

  async function generateQr(imgEl, value, buttonEl) {
    try {
      setStatus('Generando QR...');
      buttonEl?.setAttribute('disabled', 'true');
      const dataUrl = await toDataURL(value, { width: 360, margin: 1 });
      imgEl.src = dataUrl;
      imgEl.classList.remove('hidden');
      setStatus('QR generado.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'No se pudo generar el QR', true);
    } finally {
      buttonEl?.removeAttribute('disabled');
    }
  }

  function formatPrice(value) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return 'S/‑';
    try {
      return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(Number(value));
    } catch (e) {
      return `$${value}`;
    }
  }

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle('text-red-500', Boolean(isError));
  }

  function showAlert(message) {
    if (!alertEl) return;
    if (!message) {
      alertEl.classList.add('hidden');
      alertEl.textContent = '';
      return;
    }
    alertEl.textContent = message;
    alertEl.classList.remove('hidden');
  }

  function setLoading(isLoading) {
    if (loadingEl) loadingEl.classList.toggle('hidden', !isLoading);
    if (contentEl) contentEl.classList.toggle('hidden', isLoading);
    if (headerEl) headerEl.classList.toggle('hidden', isLoading);
    if (createBtn) {
      createBtn.toggleAttribute('aria-disabled', isLoading);
      createBtn.classList.toggle('pointer-events-none', isLoading);
      createBtn.classList.toggle('opacity-60', isLoading);
      createBtn.setAttribute('tabindex', isLoading ? '-1' : '0');
      if (isLoading) {
        createBtn.dataset.hrefCached = createBtn.getAttribute('href') || defaultCreateHref;
        createBtn.removeAttribute('href');
        createBtn.style.pointerEvents = 'none';
      } else {
        const href = createBtn.dataset.hrefCached || defaultCreateHref;
        if (href) createBtn.setAttribute('href', href);
        createBtn.style.pointerEvents = '';
      }
    }
    if (listEl) listEl.classList.toggle('opacity-60', isLoading);
  }
})();
