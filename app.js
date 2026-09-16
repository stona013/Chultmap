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
    reloadBtn: document.getElementById("reloadBtn"),
    backdrop: document.getElementById("modalBackdrop"),
    title: document.getElementById("markerTitle"),
    category: document.getElementById("markerCategory"),
    note: document.getElementById("markerNote"),
    deleteBtn: document.getElementById("deleteBtn"),
    cancelBtn: document.getElementById("cancelBtn"),
    saveBtn: document.getElementById("saveBtn")
  };

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
    ui.addModeBtn.disabled = true;
    ui.reloadBtn.disabled = true;
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

  L.imageOverlay("assets/Chult-map.webp", bounds).addTo(map);
  map.fitBounds(bounds);

  map.setMaxBounds([
    [-IMAGE_HEIGHT * 0.25, -IMAGE_WIDTH * 0.25],
    [IMAGE_HEIGHT * 1.25, IMAGE_WIDTH * 1.25]
  ]);

  let addMode = false;
  let editingMarker = null;
  let pendingPoint = null;
  let markers = [];
  let leafletMarkers = new Map();

  function setStatus(text, type) {
    ui.connectionStatus.textContent = text;
    ui.connectionStatus.className = `status ${type}`;
  }

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

  console.log("Zeichne Marker:", markers);

  const colors = {
    place: "#2f6ea6",
    danger: "#aa3434",
    quest: "#a27b26",
    camp: "#4c8d4f",
    npc: "#7c4a9d",
    note: "#666666"
  };

  for (const m of markers) {
    console.log("Marker:", m.title, m.x, m.y);

    if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) {
      console.warn("Ungültiger Marker:", m);
      continue;
    }

    const lm = L.circleMarker([m.y, m.x], {
      radius: 9,
      color: "#ffffff",
      weight: 3,
      fillColor: colors[m.category] || "#666666",
      fillOpacity: 1
    }).addTo(map);

    lm.bindPopup(() => popupHtml(m));

    leafletMarkers.set(m.id, lm);
  }

  console.log(`${leafletMarkers.size} Marker angezeigt`);
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

async function loadRemote() {
  setStatus("Lade Daten...", "status-warn");

  try {
    const { data, error } = await sb
      .from("markers")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    console.log("Marker aus Supabase geladen:", data);

    markers = (data || []).map(normalize);

    console.log("Normalisierte Marker:", markers);

    drawAll();

    console.log(`${markers.length} Marker angezeigt`);

    setStatus("Online", "status-ok");
  } catch (error) {
    console.error("Fehler beim Laden der Marker:", error);
    setStatus("Verbindungsfehler", "status-error");
    alert("Die Marker konnten nicht aus Supabase geladen werden.");
  }
}

  async function createMarker(payload) {
    const { data, error } = await sb
      .from("markers")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    markers.push(normalize(data));
    drawAll();
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
    if (index !== -1) {
      markers[index] = normalize(data);
    }

    drawAll();
  }

  async function deleteMarker(id) {
    const { error } = await sb
      .from("markers")
      .delete()
      .eq("id", id);

    if (error) throw error;

    markers = markers.filter(m => m.id !== id);
    drawAll();
  }

  function subscribeRealtime() {
    sb.channel("markers-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "markers"
        },
        async () => {
          await loadRemote();
        }
      )
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          setStatus("Online", "status-ok");
        }
      });
  }

  ui.addModeBtn.addEventListener("click", () => {
    setAddMode(!addMode);
  });

  ui.reloadBtn.addEventListener("click", loadRemote);

  map.on("click", event => {
    if (!addMode) return;

    const p = event.latlng;

    if (
      p.lng < 0 ||
      p.lng > IMAGE_WIDTH ||
      p.lat < 0 ||
      p.lat > IMAGE_HEIGHT
    ) {
      return;
    }

    setAddMode(false);
    openCreateModal({
      x: p.lng,
      y: p.lat
    });
  });

  ui.cancelBtn.addEventListener("click", closeModal);

  ui.backdrop.addEventListener("click", event => {
    if (event.target === ui.backdrop) {
      closeModal();
    }
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

    if (!confirm(`Marker "${editingMarker.title}" wirklich löschen?`)) {
      return;
    }

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

  loadRemote();
  subscribeRealtime();
})();
