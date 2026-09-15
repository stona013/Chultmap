(() => {
  const IMAGE_WIDTH = 952;
  const IMAGE_HEIGHT = 1289;
  const LOCAL_KEY = "chult-map-markers-v1";

  const categoryLabels = {
    place: "Ort",
    danger: "Gefahr",
    quest: "Quest",
    camp: "Lager",
    npc: "NPC",
    note: "Notiz"
  };

  const bounds = [[0, 0], [IMAGE_HEIGHT, IMAGE_WIDTH]];

  const map = L.map("map", {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 4,
    zoomSnap: 0.25,
    attributionControl: false
  });

  L.imageOverlay("assets/chult-map.png", bounds).addTo(map);
  map.fitBounds(bounds);
  map.setMaxBounds([
    [-IMAGE_HEIGHT * 0.25, -IMAGE_WIDTH * 0.25],
    [IMAGE_HEIGHT * 1.25, IMAGE_WIDTH * 1.25]
  ]);

  const ui = {
    storageMode: document.getElementById("storageMode"),
    addModeBtn: document.getElementById("addModeBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importInput: document.getElementById("importInput"),
    backdrop: document.getElementById("modalBackdrop"),
    title: document.getElementById("markerTitle"),
    category: document.getElementById("markerCategory"),
    note: document.getElementById("markerNote"),
    deleteBtn: document.getElementById("deleteBtn"),
    cancelBtn: document.getElementById("cancelBtn"),
    saveBtn: document.getElementById("saveBtn")
  };

  let addMode = false;
  let editingMarker = null;
  let pendingPoint = null;
  let markers = [];
  let leafletMarkers = new Map();

  const cfg = window.APP_CONFIG || {};
  const hasSupabase = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = hasSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  ui.storageMode.textContent = hasSupabase ? "Gemeinsamer Supabase Modus" : "Lokaler Modus";

  function makeIcon(category) {
    const safe = categoryLabels[category] ? category : "note";
    return L.divIcon({
      className: "",
      html: `<div class="marker-pin pin-${safe}"><span></span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 27],
      popupAnchor: [0, -24]
    });
  }

  function normalize(row) {
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

    const button = document.createElement("button");
    button.type = "button";
    button.className = "popup-edit";
    button.textContent = "Bearbeiten";
    button.addEventListener("click", () => openEditModal(m));
    div.appendChild(button);

    return div;
  }

  function drawAll() {
    leafletMarkers.forEach(marker => marker.remove());
    leafletMarkers.clear();

    for (const m of markers) {
      const lm = L.marker([m.y, m.x], { icon: makeIcon(m.category) }).addTo(map);
      lm.bindPopup(() => popupHtml(m));
      leafletMarkers.set(m.id, lm);
    }
  }

  function setAddMode(value) {
    addMode = value;
    ui.addModeBtn.classList.toggle("active", value);
    ui.addModeBtn.textContent = value ? "Klicke auf die Karte" : "Marker setzen";
    map.getContainer().style.cursor = value ? "crosshair" : "";
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

  function loadLocal() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      markers = Array.isArray(raw) ? raw.map(normalize) : [];
    } catch {
      markers = [];
    }
    drawAll();
  }

  function saveLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(markers));
  }

  async function loadRemote() {
    const { data, error } = await sb
      .from("markers")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      alert("Supabase konnte nicht geladen werden. Prüfe config.js und die SQL Einrichtung.");
      return;
    }

    markers = (data || []).map(normalize);
    drawAll();
  }

  async function createMarker(payload) {
    if (hasSupabase) {
      const { data, error } = await sb.from("markers").insert(payload).select().single();
      if (error) throw error;
      markers.push(normalize(data));
    } else {
      markers.push(normalize({
        ...payload,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString()
      }));
      saveLocal();
    }
    drawAll();
  }

  async function updateMarker(id, payload) {
    if (hasSupabase) {
      const { data, error } = await sb.from("markers").update(payload).eq("id", id).select().single();
      if (error) throw error;
      const index = markers.findIndex(m => m.id === id);
      if (index !== -1) markers[index] = normalize(data);
    } else {
      const index = markers.findIndex(m => m.id === id);
      if (index !== -1) markers[index] = normalize({ ...markers[index], ...payload });
      saveLocal();
    }
    drawAll();
  }

  async function deleteMarker(id) {
    if (hasSupabase) {
      const { error } = await sb.from("markers").delete().eq("id", id);
      if (error) throw error;
    }
    markers = markers.filter(m => m.id !== id);
    if (!hasSupabase) saveLocal();
    drawAll();
  }

  async function subscribeRealtime() {
    if (!hasSupabase) return;

    sb.channel("markers-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "markers" }, () => loadRemote())
      .subscribe();
  }

  ui.addModeBtn.addEventListener("click", () => setAddMode(!addMode));

  map.on("click", event => {
    if (!addMode) return;
    const p = event.latlng;

    if (p.lng < 0 || p.lng > IMAGE_WIDTH || p.lat < 0 || p.lat > IMAGE_HEIGHT) return;

    setAddMode(false);
    openCreateModal({ x: p.lng, y: p.lat });
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
      alert("Der Marker konnte nicht gespeichert werden.");
    }
  });

  ui.deleteBtn.addEventListener("click", async () => {
    if (!editingMarker) return;
    if (!confirm(`Marker "${editingMarker.title}" wirklich löschen?`)) return;

    try {
      await deleteMarker(editingMarker.id);
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Der Marker konnte nicht gelöscht werden.");
    }
  });

  ui.exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(markers, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chult-markers.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  ui.importInput.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (hasSupabase) {
      alert("Import ist im Supabase Modus absichtlich deaktiviert. Nutze dafür zunächst den lokalen Modus.");
      event.target.value = "";
      return;
    }

    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error("Kein Array");
      markers = data.map(normalize);
      saveLocal();
      drawAll();
    } catch {
      alert("Die Datei ist kein gültiger Marker Export.");
    } finally {
      event.target.value = "";
    }
  });

  if (hasSupabase) {
    loadRemote();
    subscribeRealtime();
  } else {
    loadLocal();
  }
})();
