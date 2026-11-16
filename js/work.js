/* WORK page: one full-screen "page" per piece, art left / text right, paged sideways.
 * Content comes from js/work-data.js (window.WORK = { tabs: [ { name, items: [...] } ] }).
 * All categories run in one continuous sequence (in tab order, each newest first);
 * the tabs jump to a category and highlight the one being viewed.
 * One wheel gesture / swipe / arrow key = one page.
 */
(function () {
  const data = window.WORK || { tabs: [] };
  const pages = document.getElementById("pages");
  const tabsEl = document.getElementById("tabs");
  const top = document.querySelector(".top");
  const footer = document.getElementById("site-footer");
  const counter = document.getElementById("pager-count");
  const prevBtn = document.getElementById("pager-prev");
  const nextBtn = document.getElementById("pager-next");
  if (!pages) return;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null && text !== "") e.textContent = text;
    return e;
  };

  // placeholder: white cross on a dark square
  const placeholder = () => {
    const ph = el("div", "ph");
    ph.innerHTML =
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      '<line x1="0" y1="0" x2="100" y2="100"/><line x1="100" y1="0" x2="0" y2="100"/></svg>';
    return ph;
  };

  const newestFirst = (items) =>
    items
      .map((item, i) => ({ item, i }))
      .sort((a, b) => (Number(b.item.year) || 0) - (Number(a.item.year) || 0) || a.i - b.i)
      .map((x) => x.item);

  function buildPage(item, tabName, tabIndex) {
    const page = el("article", "page");
    page.dataset.tab = tabIndex;

    const art = el("div", "art");
    if (item.image) {
      const img = el("img");
      img.src = item.image;
      img.alt = item.title || "";
      img.draggable = false;
      art.appendChild(img);
    } else {
      art.appendChild(placeholder());
    }
    page.appendChild(art);

    const text = el("div", "text");
    text.appendChild(el("p", "text-cat", tabName));
    text.appendChild(el("h2", "text-title", item.title));
    if (item.year) text.appendChild(el("p", "text-year", String(item.year)));
    if (item.description) text.appendChild(el("p", "text-desc", item.description));
    if (item.text) text.appendChild(el("p", "text-poem", item.text));
    if (item.links && item.links.length) {
      const ul = el("ul", "text-links");
      item.links.forEach((l) => {
        const li = el("li");
        const a = el("a", null, l.label);
        a.href = l.url;
        a.target = "_blank";
        a.rel = "noopener";
        li.appendChild(a);
        ul.appendChild(li);
      });
      text.appendChild(ul);
    }
    page.appendChild(text);
    return page;
  }

  /* ---- build every category into one sequence; remember where each starts ---- */
  const tabStart = [];
  const tabButtons = [];
  let n = 0;
  data.tabs.forEach((tab, ti) => {
    const items = newestFirst(tab.items || []);
    tabStart[ti] = n;
    items.forEach((item) => pages.appendChild(buildPage(item, tab.name, ti)));
    n += items.length;

    const b = el("button", "tab", tab.name);
    b.type = "button";
    b.disabled = items.length === 0;
    b.addEventListener("click", () => go(tabStart[ti]));
    tabsEl.appendChild(b);
    tabButtons.push(b);
  });
  const allPages = [...pages.querySelectorAll(".page")];

  /* ---- paging ---- */
  const index = () => Math.round(pages.scrollLeft / pages.clientWidth);

  function go(i) {
    const target = Math.max(0, Math.min(allPages.length - 1, i));
    pages.scrollTo({ left: target * pages.clientWidth, behavior: "smooth" });
  }

  let current = 0; // last settled page, used to stay put when the window resizes
  function update() {
    const i = Math.min(index(), allPages.length - 1);
    current = i;
    const total = allPages.length;
    counter.textContent = `${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    prevBtn.disabled = i <= 0;
    nextBtn.disabled = i >= total - 1;
    const activeTab = allPages[i] ? Number(allPages[i].dataset.tab) : 0;
    tabButtons.forEach((b, ti) => b.classList.toggle("active", ti === activeTab));
  }
  pages.addEventListener("scroll", update, { passive: true });

  // one wheel gesture = one page. A gesture is "over" once no wheel events arrive for a moment,
  // which also swallows the long momentum tail of trackpads and Magic Mouse.
  let locked = false, quietTimer = 0;
  pages.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => (locked = false), 180);
      if (locked) return;
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(d) < 4) return;
      locked = true;
      go(index() + Math.sign(d));
    },
    { passive: false }
  );

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "PageDown") { go(index() + 1); e.preventDefault(); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { go(index() - 1); e.preventDefault(); }
  });
  prevBtn.addEventListener("click", () => go(index() - 1));
  nextBtn.addEventListener("click", () => go(index() + 1));

  // keep pages between the fixed menu + tabs and the fixed footer, whatever height they wrap to
  const measure = () => {
    const root = document.body.style; // on <body> so it overrides the defaults in work.css
    root.setProperty("--top", top.offsetHeight + "px");
    if (footer) root.setProperty("--foot", footer.offsetHeight + "px");
  };
  measure();
  window.addEventListener("resize", () => {
    const keep = current;
    measure();
    pages.scrollLeft = keep * pages.clientWidth; // stay on the same page
  });
  if (document.fonts) document.fonts.ready.then(measure);

  update();
})();
