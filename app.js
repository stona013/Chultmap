(() => {
  const IMAGE_WIDTH = 1107;
  const IMAGE_HEIGHT = 1499;

  const categoryLabels = {
    place: "Ort",
    danger: "Gefahr",
    quest: "Quest",
    camp: "Lager",
    npc: "NPC",
    note: "Notiz"
  };

  const ui = {
    connectionStatus: document.getElementById("connectionStatus"),
    configError: document.getElementById("configError"),
    addModeBtn: document.getElementById("addModeBtn"),
    drawModeBtn: document.getElementById("drawModeBtn"),
    eraserModeBtn: document.getElementById("eraserModeBtn"),
    positionModeBtn: document.getElementById("positionModeBtn"),
    drawColor: document.getElementById("drawColor"),
    drawSize: document.getElementById("drawSize"),
    drawSizeValue: document.getElementById("drawSizeValue"),
    notebookBtn: document.getElementById("notebookBtn"),
    reloadBtn: document.getElementById("reloadBtn"),
    dayMinusBtn: document.getElementById("dayMinusBtn"),
    dayPlusBtn: document.getElementById("dayPlusBtn"),
    daysValue: document.getElementById("daysValue"),
    notebookBackdrop: document.getElementById("notebookBackdrop"),
    notebookPages: document.getElementById("notebookPages"),
    newPageBtn: document.getElementById("newPageBtn"),
    closeNotebookBtn: document.getElementById("closeNotebookBtn"),
    pageTitle: document.getElementById("pageTitle"),
    pageContent: document.getElementById("pageContent"),
    savePageBtn: document.getElementById("savePageBtn"),
    deletePageBtn: document.getElementById("deletePageBtn"),
    pageSaveStatus: document.getElementById("pageSaveStatus"),
    backdrop: document.getElementById("modalBackdrop"),
    title: document.getElementById("markerTitle"),
    category: document.getElementById("markerCategory"),
    note: document.getElementById("markerNote"),
    deleteBtn: document.getElementById("deleteBtn"),
    cancelBtn: document.getElementById("cancelBtn"),
    saveBtn: document.getElementById("saveBtn")
  };


  function ensurePositionButton() {
    let button = document.getElementById("positionModeBtn");

    if (!button) {
      const actions = document.querySelector(".actions");
      if (!actions) return null;

      button = document.createElement("button");
      button.id = "positionModeBtn";
      button.type = "button";
      button.textContent = "Position setzen";

      const notebookButton = document.getElementById("notebookBtn");
      if (notebookButton) {
        actions.insertBefore(button, notebookButton);
      } else {
        actions.appendChild(button);
      }
    }

    ui.positionModeBtn = button;
    return button;
  }

  ensurePositionButton();

  const cfg = window.APP_CONFIG || {};
  const configured = Boolean(
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    window.supabase
  );

  if (!configured) {
    ui.connectionStatus.textContent = "Supabase fehlt";
    ui.connectionStatus.className = "status status-error";
    ui.configError.classList.remove("hidden");
    return;
  }

  const sb = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  const bounds = [[0, 0], [IMAGE_HEIGHT, IMAGE_WIDTH]];

  const map = L.map("map", {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 4,
    zoomSnap: 0.25,
    attributionControl: false
  });

  window.debugMap = map;

  L.imageOverlay("assets/Chult-map.webp", bounds).addTo(map);
  map.fitBounds(bounds);

  map.setMaxBounds([
    [-IMAGE_HEIGHT * 0.25, -IMAGE_WIDTH * 0.25],
    [IMAGE_HEIGHT * 1.25, IMAGE_WIDTH * 1.25]
  ]);

  let mode = "move";
  let editingMarker = null;
  let pendingPoint = null;

  let markers = [];
  let drawings = [];
  let notebookPages = [];
  let currentPageId = null;
  let daysUnderway = 0;

  const leafletMarkers = new Map();
  const leafletDrawings = new Map();

  let drawingNow = false;
  let currentPoints = [];
  let previewLine = null;
  const erasedDuringDrag = new Set();

let currentPosition = null;
let currentPositionMarker = null;
  
  function setStatus(text, type) {
    ui.connectionStatus.textContent = text;
    ui.connectionStatus.className = `status ${type}`;
  }

  function normalizeMarker(row) {
    return {
      id: String(row.id),
      x: Number(row.x),
      y: Number(row.y),
      title: String(row.title || "Unbenannter Marker"),
      note: String(row.note || ""),
      category: categoryLabels[row.category] ? row.category : "note",
      created_at: row.created_at || new Date().toISOString()
    };
  }

  function normalizeDrawing(row) {
    return {
      id: String(row.id),
      color: String(row.color || "#d32f2f"),
      size: Number(row.size || 6),
      points: Array.isArray(row.points) ? row.points : [],
      created_at: row.created_at || new Date().toISOString()
    };
  }

  function popupHtml(m) {
    const div = document.createElement("div");

    const title = document.createElement("div");
    title.className = "popup-title";
    title.textContent = m.title;
    div.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "popup-meta";
    meta.textContent = categoryLabels[m.category] || "Notiz";
    div.appendChild(meta);

    if (m.note) {
      const note = document.createElement("div");
      note.className = "popup-note";
      note.textContent = m.note;
      div.appendChild(note);
    }

    const actions = document.createElement("div");
    actions.className = "popup-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Bearbeiten";
    editButton.addEventListener("click", () => openEditModal(m));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Löschen";
    deleteButton.className = "popup-delete";
    deleteButton.addEventListener("click", async () => {
      if (!confirm(`Marker "${m.title}" wirklich löschen?`)) return;
      try {
        await deleteMarker(m.id);
        map.closePopup();
      } catch (error) {
        console.error(error);
        alert("Der Marker konnte nicht gelöscht werden.");
      }
    });

    actions.append(editButton, deleteButton);
    div.appendChild(actions);

    return div;
  }

  function drawMarkers() {
    leafletMarkers.forEach(layer => layer.remove());
    leafletMarkers.clear();

    const colors = {
      place: "#2f6ea6",
      danger: "#aa3434",
      quest: "#a27b26",
      camp: "#4c8d4f",
      npc: "#7c4a9d",
      note: "#666666"
    };

    for (const m of markers) {
      if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;

      const layer = L.circleMarker([m.y, m.x], {
        radius: 9,
        color: "#ffffff",
        weight: 3,
        fillColor: colors[m.category] || "#666666",
        fillOpacity: 1,
        pane: "markerPane"
      }).addTo(map);

      layer.bindPopup(() => popupHtml(m));
      leafletMarkers.set(m.id, layer);
    }
  }

  function drawStoredDrawings() {
    leafletDrawings.forEach(layer => layer.remove());
    leafletDrawings.clear();

    for (const d of drawings) {
      const latlngs = d.points
        .filter(p => Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
        .map(p => [Number(p.y), Number(p.x)]);

      if (latlngs.length < 2) continue;

      const layer = L.polyline(latlngs, {
        color: d.color,
        weight: d.size,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
        interactive: true
      }).addTo(map);

      leafletDrawings.set(d.id, layer);
    }
  }

  function setMode(newMode) {
    mode = newMode;

    ui.addModeBtn.classList.toggle("active", mode === "marker");
    ui.drawModeBtn.classList.toggle("active", mode === "draw");
    ui.eraserModeBtn.classList.toggle("active", mode === "erase");

    if (ui.positionModeBtn) {
      ui.positionModeBtn.classList.toggle("active", mode === "position");
    }

    if (mode === "marker") {
      ui.addModeBtn.textContent = "Klicke auf die Karte";
    } else {
      ui.addModeBtn.textContent = "Marker setzen";
    }

    if (mode === "draw") {
      map.dragging.disable();
      map.getContainer().style.cursor = "crosshair";
    } else if (mode === "erase") {
      map.dragging.disable();
      map.getContainer().style.cursor = "cell";
    } else {
      map.dragging.enable();

      if (mode === "marker" || mode === "position") {
        map.getContainer().style.cursor = "crosshair";
      } else {
        map.getContainer().style.cursor = "";
      }
    }
  }

  function openCreateModal(point) {
    editingMarker = null;
    pendingPoint = point;
    ui.title.value = "";
    ui.category.value = "place";
    ui.note.value = "";
    ui.deleteBtn.classList.add("hidden");
    ui.backdrop.classList.remove("hidden");
    setTimeout(() => ui.title.focus(), 0);
  }

  function openEditModal(marker) {
    editingMarker = marker;
    pendingPoint = null;
    ui.title.value = marker.title;
    ui.category.value = marker.category;
    ui.note.value = marker.note;
    ui.deleteBtn.classList.remove("hidden");
    ui.backdrop.classList.remove("hidden");
  }

  function closeModal() {
    ui.backdrop.classList.add("hidden");
    editingMarker = null;
    pendingPoint = null;
  }

  async function loadAll() {
    setStatus("Lade Daten...", "status-warn");

    try {
      const [
        { data: markerData, error: markerError },
        { data: drawingData, error: drawingError }
      ] = await Promise.all([
        sb.from("markers").select("*").order("created_at", { ascending: true }),
        sb.from("drawings").select("*").order("created_at", { ascending: true })
      ]);

      if (markerError) throw markerError;
      if (drawingError) throw drawingError;

      markers = (markerData || []).map(normalizeMarker);
      drawings = (drawingData || []).map(normalizeDrawing);

      drawMarkers();
      drawStoredDrawings();

      window.debugMarkers = markers;
      window.debugDrawings = drawings;

      await Promise.all([loadTracker(), loadNotebook(), loadCurrentPosition()]);

      setStatus("Online", "status-ok");
    } catch (error) {
      console.error("Fehler beim Laden:", error);
      setStatus("Verbindungsfehler", "status-error");
    }
  }

  async function createMarker(payload) {
    const { data, error } = await sb
      .from("markers")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    markers.push(normalizeMarker(data));
    drawMarkers();
  }

  async function updateMarker(id, payload) {
    const { data, error } = await sb
      .from("markers")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    const index = markers.findIndex(m => m.id === id);
    if (index !== -1) markers[index] = normalizeMarker(data);

    drawMarkers();
  }

  async function deleteMarker(id) {
    const { error } = await sb
      .from("markers")
      .delete()
      .eq("id", id);

    if (error) throw error;

    markers = markers.filter(m => m.id !== id);
    drawMarkers();
  }

  async function createDrawing(points, color, size) {
    const payload = {
      points,
      color,
      size
    };

    const { data, error } = await sb
      .from("drawings")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    drawings.push(normalizeDrawing(data));
    drawStoredDrawings();
  }

  async function deleteDrawing(id) {
    const { error } = await sb
      .from("drawings")
      .delete()
      .eq("id", id);

    if (error) throw error;

    drawings = drawings.filter(d => d.id !== id);

    const layer = leafletDrawings.get(id);
    if (layer) layer.remove();
    leafletDrawings.delete(id);
  }

  function pointToSegmentDistance(p, a, b) {
    const x = p.x;
    const y = p.y;
    const x1 = a.x;
    const y1 = a.y;
    const x2 = b.x;
    const y2 = b.y;

    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
      return Math.hypot(x - x1, y - y1);
    }

    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    const px = x1 + t * dx;
    const py = y1 + t * dy;

    return Math.hypot(x - px, y - py);
  }

  async function eraseAt(latlng) {
    const p = { x: latlng.lng, y: latlng.lat };
    const zoom = map.getZoom();
    const threshold = 16 / Math.max(0.25, Math.pow(2, zoom));

    for (const d of [...drawings]) {
      if (erasedDuringDrag.has(d.id)) continue;

      const pts = d.points.map(pt => ({
        x: Number(pt.x),
        y: Number(pt.y)
      }));

      let hit = false;

      for (let i = 1; i < pts.length; i++) {
        const dist = pointToSegmentDistance(p, pts[i - 1], pts[i]);
        if (dist <= threshold + d.size / 2) {
          hit = true;
          break;
        }
      }

      if (hit) {
        erasedDuringDrag.add(d.id);
        try {
          await deleteDrawing(d.id);
        } catch (error) {
          console.error("Zeichnung konnte nicht gelöscht werden:", error);
        }
      }
    }
  }


  function normalizePage(row) {
    return {
      id: String(row.id),
      title: String(row.title || "Neue Seite"),
      content: String(row.content || ""),
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || row.created_at || new Date().toISOString()
    };
  }

  async function loadTracker() {
    const { data, error } = await sb
      .from("campaign_state")
      .select("value")
      .eq("key", "days_underway")
      .maybeSingle();

    if (error) throw error;

    daysUnderway = Number(data?.value ?? 0);
    if (!Number.isFinite(daysUnderway)) daysUnderway = 0;
    ui.daysValue.textContent = String(daysUnderway);
  }

  async function setDays(value) {
    const safeValue = Math.max(0, Math.floor(Number(value) || 0));

    const { error } = await sb
      .from("campaign_state")
      .upsert({
        key: "days_underway",
        value: safeValue,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });

    if (error) throw error;

    daysUnderway = safeValue;
    ui.daysValue.textContent = String(daysUnderway);
  }

  function renderNotebookPages() {
  ui.notebookPages.innerHTML = "";

  for (const page of notebookPages) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-list-item";

    if (page.id === currentPageId) {
      button.classList.add("active");
    }

    const title = document.createElement("span");
    title.textContent = page.title || "Neue Seite";

    button.append(title);

    button.addEventListener("click", () => {
      selectPage(page.id);
    });

    ui.notebookPages.appendChild(button);
  }
}

  function selectPage(id) {
    const page = notebookPages.find(p => p.id === id);
    if (!page) return;

    currentPageId = id;
    ui.pageTitle.value = page.title;
    ui.pageContent.value = page.content;
    ui.deletePageBtn.classList.remove("hidden");
    ui.pageSaveStatus.textContent = "";
    renderNotebookPages();
  }

  function clearPageEditor() {
    currentPageId = null;
    ui.pageTitle.value = "";
    ui.pageContent.value = "";
    ui.deletePageBtn.classList.add("hidden");
    ui.pageSaveStatus.textContent = "";
    renderNotebookPages();
  }

  async function loadNotebook() {
    const { data, error } = await sb
      .from("notebook_pages")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    notebookPages = (data || []).map(normalizePage);

    if (currentPageId && !notebookPages.some(p => p.id === currentPageId)) {
      currentPageId = null;
    }

    if (!currentPageId && notebookPages.length > 0) {
      currentPageId = notebookPages[0].id;
    }

    if (currentPageId) selectPage(currentPageId);
    else clearPageEditor();
  }

  async function createPage() {
    const { data, error } = await sb
      .from("notebook_pages")
      .insert({ title: "Neue Seite", content: "" })
      .select()
      .single();

    if (error) throw error;

    notebookPages.unshift(normalizePage(data));
    selectPage(String(data.id));
    setTimeout(() => {
      ui.pageTitle.focus();
      ui.pageTitle.select();
    }, 0);
  }

  async function saveCurrentPage() {
    if (!currentPageId) await createPage();

    const title = ui.pageTitle.value.trim() || "Neue Seite";
    const content = ui.pageContent.value;
    const updatedAt = new Date().toISOString();

    ui.pageSaveStatus.textContent = "Speichert...";

    const { data, error } = await sb
      .from("notebook_pages")
      .update({ title, content, updated_at: updatedAt })
      .eq("id", currentPageId)
      .select()
      .single();

    if (error) throw error;

    const index = notebookPages.findIndex(p => p.id === currentPageId);
    if (index !== -1) notebookPages[index] = normalizePage(data);

    notebookPages.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    renderNotebookPages();
    ui.pageSaveStatus.textContent = "Gespeichert";
  }

  async function deleteCurrentPage() {
    if (!currentPageId) return;

    const page = notebookPages.find(p => p.id === currentPageId);
    if (!confirm(`Seite "${page?.title || "Neue Seite"}" wirklich löschen?`)) return;

    const { error } = await sb
      .from("notebook_pages")
      .delete()
      .eq("id", currentPageId);

    if (error) throw error;

    notebookPages = notebookPages.filter(p => p.id !== currentPageId);
    currentPageId = notebookPages[0]?.id || null;

    if (currentPageId) selectPage(currentPageId);
    else clearPageEditor();
  }

async function loadCurrentPosition() {
  const { data, error } = await sb
    .from("campaign_state")
    .select("value")
    .eq("key", "current_position")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || !data.value) {
    currentPosition = null;

    if (currentPositionMarker) {
      currentPositionMarker.remove();
      currentPositionMarker = null;
    }

    return;
  }

  const position = data.value;

  if (
    !Number.isFinite(Number(position.x)) ||
    !Number.isFinite(Number(position.y))
  ) {
    return;
  }

  currentPosition = {
    x: Number(position.x),
    y: Number(position.y)
  };

  drawCurrentPosition();
}

function drawCurrentPosition() {
  if (!currentPosition) {
    return;
  }

  if (currentPositionMarker) {
    currentPositionMarker.remove();
  }

  const icon = L.divIcon({
    className: "",
    html: `
      <div class="current-position-pin">
        <div class="current-position-dot"></div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 34]
  });

  currentPositionMarker = L.marker(
    [currentPosition.y, currentPosition.x],
    {
      icon,
      draggable: true,
      zIndexOffset: 1000
    }
  ).addTo(map);

  currentPositionMarker.bindTooltip(
    "Aktuelle Position",
    {
      permanent: false,
      direction: "top"
    }
  );

  currentPositionMarker.on("dragend", async event => {
    const position = event.target.getLatLng();

    try {
      await saveCurrentPosition(
        position.lng,
        position.lat
      );
    } catch (error) {
      console.error(
        "Position konnte nicht gespeichert werden:",
        error
      );

      alert(
        "Die aktuelle Position konnte nicht gespeichert werden."
      );
    }
  });
}

async function saveCurrentPosition(x, y) {
  const value = {
    x: Number(x),
    y: Number(y)
  };

  const { error } = await sb
    .from("campaign_state")
    .upsert(
      {
        key: "current_position",
        value,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "key"
      }
    );

  if (error) {
    throw error;
  }

  currentPosition = value;
  drawCurrentPosition();
}

  function subscribeRealtime() {
    sb.channel("map-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "markers" },
        loadAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drawings" },
        loadAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_state" },
        async () => {
          await loadTracker();
          await loadCurrentPosition();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notebook_pages" },
        loadNotebook
      )
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          setStatus("Online", "status-ok");
        }
      });
  }

  ui.addModeBtn.addEventListener("click", () => {
    setMode(mode === "marker" ? "move" : "marker");
  });

  ui.drawModeBtn.addEventListener("click", () => {
    setMode(mode === "draw" ? "move" : "draw");
  });

  ui.eraserModeBtn.addEventListener("click", () => {
    setMode(mode === "erase" ? "move" : "erase");
  });

  if (ui.positionModeBtn) {
    ui.positionModeBtn.addEventListener("click", () => {
      setMode(mode === "position" ? "move" : "position");
    });
  }

  ui.drawSize.addEventListener("input", () => {
    ui.drawSizeValue.textContent = ui.drawSize.value;
  });

  ui.reloadBtn.addEventListener("click", loadAll);

  ui.dayPlusBtn.addEventListener("click", async () => {
    try {
      await setDays(daysUnderway + 1);
    } catch (error) {
      console.error(error);
      alert("Tage Unterwegs konnte nicht gespeichert werden.");
    }
  });

  ui.dayMinusBtn.addEventListener("click", async () => {
    try {
      await setDays(daysUnderway - 1);
    } catch (error) {
      console.error(error);
      alert("Tage Unterwegs konnte nicht gespeichert werden.");
    }
  });

  ui.notebookBtn.addEventListener("click", async () => {
    ui.notebookBackdrop.classList.remove("hidden");
    try {
      await loadNotebook();
    } catch (error) {
      console.error(error);
      alert("Das Notizbuch konnte nicht geladen werden.");
    }
  });

  ui.closeNotebookBtn.addEventListener("click", () => {
    ui.notebookBackdrop.classList.add("hidden");
  });

  ui.notebookBackdrop.addEventListener("click", event => {
    if (event.target === ui.notebookBackdrop) {
      ui.notebookBackdrop.classList.add("hidden");
    }
  });

  ui.newPageBtn.addEventListener("click", async () => {
    try {
      await createPage();
    } catch (error) {
      console.error(error);
      alert("Die neue Seite konnte nicht erstellt werden.");
    }
  });

  ui.savePageBtn.addEventListener("click", async () => {
    try {
      await saveCurrentPage();
    } catch (error) {
      console.error(error);
      ui.pageSaveStatus.textContent = "Fehler beim Speichern";
    }
  });

  ui.deletePageBtn.addEventListener("click", async () => {
    try {
      await deleteCurrentPage();
    } catch (error) {
      console.error(error);
      alert("Die Seite konnte nicht gelöscht werden.");
    }
  });

  map.on("click", async event => {
    const p = event.latlng;

    if (
      p.lng < 0 ||
      p.lng > IMAGE_WIDTH ||
      p.lat < 0 ||
      p.lat > IMAGE_HEIGHT
    ) {
      return;
    }

    if (mode === "position") {
      try {
        await saveCurrentPosition(p.lng, p.lat);
        setMode("move");
      } catch (error) {
        console.error(error);
        alert("Die Position konnte nicht gespeichert werden.");
      }

      return;
    }

    if (mode !== "marker") return;

    setMode("move");
    openCreateModal({ x: p.lng, y: p.lat });
  });

  map.on("mousedown", event => {
    if (mode === "draw") {
      drawingNow = true;
      currentPoints = [{ x: event.latlng.lng, y: event.latlng.lat }];

      previewLine = L.polyline([[event.latlng.lat, event.latlng.lng]], {
        color: ui.drawColor.value,
        weight: Number(ui.drawSize.value),
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
        interactive: false
      }).addTo(map);
    }

    if (mode === "erase") {
      erasedDuringDrag.clear();
      eraseAt(event.latlng);
    }
  });

  map.on("mousemove", event => {
    if (mode === "draw" && drawingNow) {
      const p = { x: event.latlng.lng, y: event.latlng.lat };
      const last = currentPoints[currentPoints.length - 1];

      if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 1) {
        currentPoints.push(p);
        previewLine.setLatLngs(currentPoints.map(pt => [pt.y, pt.x]));
      }
    }

    if (mode === "erase" && map._mouseDown) {
      eraseAt(event.latlng);
    }
  });

  const mapContainer = map.getContainer();

  mapContainer.addEventListener("mousedown", () => {
    map._mouseDown = true;
  });

  window.addEventListener("mouseup", async () => {
    map._mouseDown = false;

    if (mode === "draw" && drawingNow) {
      drawingNow = false;

      if (previewLine) {
        previewLine.remove();
        previewLine = null;
      }

      if (currentPoints.length >= 2) {
        try {
          await createDrawing(
            currentPoints,
            ui.drawColor.value,
            Number(ui.drawSize.value)
          );
        } catch (error) {
          console.error(error);
          alert("Die Zeichnung konnte nicht gespeichert werden.");
        }
      }

      currentPoints = [];
    }

    erasedDuringDrag.clear();
  });

  ui.cancelBtn.addEventListener("click", closeModal);

  ui.backdrop.addEventListener("click", event => {
    if (event.target === ui.backdrop) closeModal();
  });

  ui.saveBtn.addEventListener("click", async () => {
    const title = ui.title.value.trim();

    if (!title) {
      alert("Bitte gib einen Titel ein.");
      return;
    }

    const payload = {
      title,
      category: ui.category.value,
      note: ui.note.value.trim()
    };

    ui.saveBtn.disabled = true;

    try {
      if (editingMarker) {
        await updateMarker(editingMarker.id, payload);
      } else if (pendingPoint) {
        await createMarker({
          ...payload,
          x: pendingPoint.x,
          y: pendingPoint.y
        });
      }

      closeModal();
    } catch (error) {
      console.error(error);
      alert("Der Marker konnte nicht online gespeichert werden.");
    } finally {
      ui.saveBtn.disabled = false;
    }
  });

  ui.deleteBtn.addEventListener("click", async () => {
    if (!editingMarker) return;
    if (!confirm(`Marker "${editingMarker.title}" wirklich löschen?`)) return;

    ui.deleteBtn.disabled = true;

    try {
      await deleteMarker(editingMarker.id);
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Der Marker konnte nicht gelöscht werden.");
    } finally {
      ui.deleteBtn.disabled = false;
    }
  });

  setMode("move");
  loadAll();
  subscribeRealtime();
})();
