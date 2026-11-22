(() => {
  "use strict";

  const DATA = window.SNACK_DATA;
  if (!DATA) {
    console.error("SNACK_DATA 未加载");
    return;
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.documentElement.classList.add("js");

  const revealObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.05, rootMargin: "0px 0px -30px 0px" })
    : null;

  function observeReveals(root = document) {
    const nodes = root.querySelectorAll("[data-reveal]:not(.is-visible)");
    if (!revealObserver) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    nodes.forEach((node) => revealObserver.observe(node));
  }

  const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESC_MAP[ch]);
  const normalize = (value) =>
    String(value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  const collator = new Intl.Collator("zh-CN", { sensitivity: "base", numeric: true });

  const state = {
    query: "",
    category: "all",
    sort: "recent",
    todayId: null,
    dialogId: null,
    theme: localStorage.getItem("snack-theme") === "dark" ? "dark" : "light",
  };

  const els = {
    grid: $("#grid"),
    empty: $("#empty"),
    emptyReset: $("#empty-reset"),
    resultCount: $("#result-count"),
    search: $("#search"),
    searchClear: $("#search-clear"),
    sort: $("#sort"),
    categoryChips: $("#category-chips"),
    themeToggle: $("#theme-toggle"),
    themeLabel: $(".theme-label"),
    metaTheme: $('meta[name="theme-color"]'),
    random: $("#random"),
    reroll: $("#reroll"),
    today: $(".today"),
    todayOpen: $("#today-open"),
    todayBrandmark: $("#today-brandmark"),
    todayTitle: $("#today-title"),
    todayBrand: $("#today-brand"),
    todayNote: $("#today-note"),
    todayCategory: $("#today-category"),
    todayNo: $("#today-no"),
    todayRating: $("#today-rating"),
    dialog: $("#snack-dialog"),
    dialogClose: $("#dialog-close"),
    dialogArt: $("#dialog-art-wrap"),
    dialogBrandmark: $("#dialog-brandmark"),
    dialogIndex: $("#dialog-index"),
    dialogTitle: $("#dialog-title"),
    dialogBrand: $("#dialog-brand"),
    dialogRating: $("#dialog-rating"),
    dialogNote: $("#dialog-note"),
    dialogCategory: $("#dialog-category"),
    dialogFlavor: $("#dialog-flavor"),
    dialogPrice: $("#dialog-price"),
    dialogPlace: $("#dialog-place"),
    dialogDate: $("#dialog-date"),
    dialogRepurchase: $("#dialog-repurchase"),
    dialogTags: $("#dialog-tags"),
    toast: $("#toast"),
    toTop: $("#to-top"),
    year: $("#year"),
    updated: $("#updated"),
  };

  let searchTimer = 0;
  let toastTimer = 0;

  /* ---------- rating ---------- */

  function artLabel(snack) {
    const name = String(snack.name || "").trim();
    const brand = String(snack.brand || "").trim();
    if (brand && name.startsWith(brand)) {
      const rest = name.slice(brand.length).trim();
      if (rest) return rest;
    }
    return name;
  }

  function ratingHTML(rating) {
    const value = Math.max(0, Math.min(5, Number(rating) || 0));
    return Array.from({ length: 5 }, (_, index) =>
      `<span class="${index < value ? "is-on" : ""}">★</span>`).join("");
  }

  /* ---------- theme ---------- */

  function applyTheme(theme, persist = false) {
    const isDark = theme === "dark";
    state.theme = isDark ? "dark" : "light";
    document.documentElement.dataset.theme = state.theme;
    if (els.themeLabel) els.themeLabel.textContent = isDark ? "白天" : "夜宵";
    if (els.themeToggle) {
      const label = isDark ? "切换到白天主题" : "切换到夜宵主题";
      els.themeToggle.setAttribute("aria-label", label);
      els.themeToggle.title = label;
    }
    if (els.metaTheme) els.metaTheme.setAttribute("content", isDark ? "#22201c" : "#fbf6ec");
    if (persist) localStorage.setItem("snack-theme", state.theme);
  }

  /* ---------- data ---------- */

  function getFiltered() {
    const query = normalize(state.query);
    const list = DATA.snacks.filter((snack) => {
      if (state.category !== "all" && snack.category !== state.category) return false;
      if (!query) return true;
      const haystack = [snack.name, snack.brand, snack.flavor, snack.note, ...(snack.tags || [])].join(" ");
      return normalize(haystack).includes(query);
    });

    const categoryOrder = new Map(DATA.categories.map((item, index) => [item.name, index]));
    if (state.sort === "rating") {
      list.sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date));
    } else if (state.sort === "name") {
      list.sort((a, b) => collator.compare(a.name, b.name));
    } else if (state.sort === "category") {
      list.sort((a, b) =>
        (categoryOrder.get(a.category) ?? 99) - (categoryOrder.get(b.category) ?? 99) ||
        collator.compare(a.name, b.name));
    } else {
      list.sort((a, b) => b.date.localeCompare(a.date) || collator.compare(a.name, b.name));
    }
    return list;
  }

  /* ---------- render ---------- */

  function cardHTML(snack, index) {
    return `
      <article class="snack-card" data-id="${esc(snack.id)}" data-category="${esc(snack.category)}"
        data-reveal tabindex="0" role="button" aria-label="查看 ${esc(snack.name)} 详情" style="--i:${index % 12}">
        <span class="snack-card__tape" aria-hidden="true"></span>
        <div class="snack-card__art">
          <span class="snack-card__art-brand">${esc(artLabel(snack))}</span>
          <span class="snack-card__art-sub">PACKAGED SNACK</span>
          <span class="snack-card__category">${esc(snack.category)}</span>
          <span class="snack-card__no">NO. ${esc(snack.id)}</span>
        </div>
        <div class="snack-card__body">
          <h3 class="snack-card__title">${esc(snack.name)}</h3>
          <p class="snack-card__brand">${esc(snack.brand)}</p>
          <div class="rating snack-card__rating" aria-label="评分 ${esc(snack.rating)} 分">${ratingHTML(snack.rating)}</div>
          <p class="snack-card__note">${esc(snack.note)}</p>
          <div class="snack-card__tags">${(snack.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>
          <div class="snack-card__foot">
            <span class="stamp" data-repurchase="${esc(snack.repurchase)}">${esc(snack.repurchase)}</span>
            <span class="snack-card__price">${esc(snack.price)}</span>
          </div>
        </div>
      </article>`;
  }

  function updateResultCount(count) {
    const total = DATA.stats.snacks;
    const bits = [];
    if (state.category !== "all") bits.push(state.category);
    if (state.query.trim()) bits.push(`“${state.query.trim()}”`);
    els.resultCount.textContent = bits.length
      ? `找到 ${count} 包 · ${bits.join(" · ")}`
      : `共 ${total} 包 · 只收有包装的、会反复买的`;
  }

  function render() {
    const list = getFiltered();
    els.grid.innerHTML = list.map(cardHTML).join("");
    els.empty.hidden = list.length > 0;
    updateResultCount(list.length);
    observeReveals(els.grid);
  }

  function renderChips() {
    const chips = [
      { name: "全部", value: "all", count: DATA.stats.snacks },
      ...DATA.categories.map((category) => ({ name: category.name, value: category.name, count: category.count })),
    ];
    els.categoryChips.innerHTML = chips.map((chip) => {
      const active = chip.value === state.category;
      return `<button class="chip${active ? " is-active" : ""}" type="button"
        data-category="${esc(chip.value)}" aria-pressed="${active}">${esc(chip.name)}<span>${chip.count}</span></button>`;
    }).join("");
  }

  /* ---------- today pick ---------- */

  function setToday(snack) {
    state.todayId = snack.id;
    els.today.dataset.category = snack.category;
    els.todayBrandmark.textContent = artLabel(snack);
    els.todayTitle.textContent = snack.name;
    els.todayBrand.textContent = snack.brand;
    els.todayNote.textContent = snack.note;
    els.todayCategory.textContent = snack.category;
    els.todayNo.textContent = `NO. ${snack.id}`;
    els.todayRating.innerHTML = ratingHTML(snack.rating);
    els.todayRating.setAttribute("aria-label", `评分 ${snack.rating} 分`);
    els.today.classList.remove("is-spinning");
    void els.today.offsetWidth;
    els.today.classList.add("is-spinning");
    clearTimeout(els.today._spinTimer);
    els.today._spinTimer = setTimeout(() => els.today.classList.remove("is-spinning"), 650);
  }

  function spinToday() {
    if (!DATA.snacks.length) return;
    const snack = DATA.snacks[Math.floor(Math.random() * DATA.snacks.length)];
    setToday(snack);
  }

  /* ---------- dialog ---------- */

  function openDialog(id) {
    const snack = DATA.snacks.find((item) => item.id === id);
    if (!snack) return;
    state.dialogId = snack.id;

    els.dialogArt.dataset.category = snack.category;
    els.dialogBrandmark.textContent = artLabel(snack);
    els.dialogIndex.textContent = `NO. ${snack.id}`;
    els.dialogTitle.textContent = snack.name;
    els.dialogBrand.textContent = snack.brand;
    els.dialogRating.innerHTML = ratingHTML(snack.rating);
    els.dialogRating.setAttribute("aria-label", `评分 ${snack.rating} 分`);
    els.dialogNote.textContent = snack.note;
    els.dialogCategory.textContent = snack.category;
    els.dialogFlavor.textContent = snack.flavor;
    els.dialogPrice.textContent = snack.price;
    els.dialogPlace.textContent = snack.place;
    els.dialogDate.textContent = snack.date;
    els.dialogRepurchase.textContent = snack.repurchase;
    els.dialogTags.innerHTML = (snack.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join("");

    if (!els.dialog.open) els.dialog.showModal();
    document.body.classList.add("dialog-open");
  }

  function closeDialog() {
    if (els.dialog.open) els.dialog.close();
  }

  /* ---------- toast ---------- */

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2000);
  }

  /* ---------- stats ---------- */

  function animateCount(element, target) {
    if (reduceMotion.matches) {
      element.textContent = target;
      return;
    }
    const start = performance.now();
    const duration = 800;
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else element.textContent = target;
    }
    requestAnimationFrame(tick);
  }

  function initStats() {
    const targets = {
      snacks: DATA.stats.snacks,
      brands: DATA.stats.brands,
      categories: DATA.stats.categories,
      favorites: DATA.stats.favorites,
    };
    $$("[data-count]").forEach((element) => {
      const target = targets[element.dataset.stat];
      if (typeof target === "number") animateCount(element, target);
    });
  }

  /* ---------- events ---------- */

  function bindEvents() {
    els.themeToggle.addEventListener("click", () => {
      applyTheme(state.theme === "dark" ? "light" : "dark", true);
    });

    els.search.addEventListener("input", () => {
      state.query = els.search.value;
      els.searchClear.hidden = !els.search.value;
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(render, 110);
    });

    els.search.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (els.search.value) {
        els.search.value = "";
        state.query = "";
        els.searchClear.hidden = true;
        render();
      } else {
        els.search.blur();
      }
    });

    els.searchClear.addEventListener("click", () => {
      els.search.value = "";
      state.query = "";
      els.searchClear.hidden = true;
      render();
      els.search.focus();
    });

    els.sort.addEventListener("change", () => {
      state.sort = els.sort.value;
      render();
    });

    els.categoryChips.addEventListener("click", (event) => {
      const chip = event.target.closest(".chip");
      if (!chip) return;
      state.category = chip.dataset.category;
      $$(".chip", els.categoryChips).forEach((item) => {
        const active = item.dataset.category === state.category;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      render();
    });

    els.grid.addEventListener("click", (event) => {
      const card = event.target.closest(".snack-card");
      if (card) openDialog(card.dataset.id);
    });

    els.grid.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest(".snack-card");
      if (!card) return;
      event.preventDefault();
      openDialog(card.dataset.id);
    });

    els.random.addEventListener("click", spinToday);
    els.reroll.addEventListener("click", spinToday);
    els.todayOpen.addEventListener("click", () => {
      if (state.todayId) openDialog(state.todayId);
    });

    els.dialogClose.addEventListener("click", closeDialog);
    els.dialog.addEventListener("click", (event) => {
      if (event.target === els.dialog) closeDialog();
    });
    els.dialog.addEventListener("close", () => {
      document.body.classList.remove("dialog-open");
      state.dialogId = null;
    });

    els.emptyReset.addEventListener("click", () => {
      state.category = "all";
      state.query = "";
      state.sort = "recent";
      els.search.value = "";
      els.searchClear.hidden = true;
      els.sort.value = "recent";
      renderChips();
      render();
      els.search.focus();
    });

    els.toTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
    });

    window.addEventListener("scroll", () => {
      els.toTop.classList.toggle("is-visible", window.scrollY > 700);
    }, { passive: true });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target instanceof HTMLElement && (
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" || target.isContentEditable
      );
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        els.search.focus();
      }
    });
  }

  /* ---------- init ---------- */

  applyTheme(state.theme, false);
  renderChips();
  initStats();
  bindEvents();
  render();
  spinToday();
  observeReveals(document);

  if (els.year) els.year.textContent = new Date().getFullYear();
  if (els.updated && DATA.updated) els.updated.textContent = String(DATA.updated).replace(/-/g, ".");

})();
