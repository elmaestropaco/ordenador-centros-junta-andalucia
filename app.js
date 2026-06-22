(function () {
  const data = Array.isArray(window.CENTROS_DATA) ? window.CENTROS_DATA : [];
  const meta = window.CENTROS_META || {};

  const state = {
    origin: null,
    currentRows: [],
    provinces: new Set(),
    types: new Set(),
    sources: new Set(),
  };

  const STORAGE_KEY = "centros-andalucia-preferencias";

  const TYPE_LABELS = {
    CC: "Centro de Convenio",
    CEIP: "Colegio de Educación Infantil y Primaria",
    CEP: "Colegio de Educación Primaria",
    CPR: "Colegio Público Rural",
    IES: "Instituto de Educación Secundaria",
    IPEP: "Instituto Provincial de Educación Permanente",
    SESO: "Sección de Educación Secundaria Obligatoria",
    SIPEP: "Sección de Instituto Provincial de Educación Permanente",
  };

  const els = {
    originForm: document.getElementById("originForm"),
    originInput: document.getElementById("originInput"),
    originStatus: document.getElementById("originStatus"),
    clearOriginButton: document.getElementById("clearOriginButton"),
    localitySelect: document.getElementById("localitySelect"),
    textSearchInput: document.getElementById("textSearchInput"),
    onlyBilingualCheckbox: document.getElementById("onlyBilingualCheckbox"),
    onlyWithCoordsCheckbox: document.getElementById("onlyWithCoordsCheckbox"),
    onlyVoluntaryCheckbox: document.getElementById("onlyVoluntaryCheckbox"),
    onlyZtsCheckbox: document.getElementById("onlyZtsCheckbox"),
    onlyDifficultCheckbox: document.getElementById("onlyDifficultCheckbox"),
    difficultCheckboxWrap: document.getElementById("difficultCheckboxWrap"),
    provinceFilters: document.getElementById("provinceFilters"),
    typeFilters: document.getElementById("typeFilters"),
    sourceFilters: document.getElementById("sourceFilters"),
    selectAllProvincesButton: document.getElementById("selectAllProvincesButton"),
    clearProvincesButton: document.getElementById("clearProvincesButton"),
    clearTypesButton: document.getElementById("clearTypesButton"),
    clearSourcesButton: document.getElementById("clearSourcesButton"),
    resetFiltersButton: document.getElementById("resetFiltersButton"),
    activeFilters: document.getElementById("activeFilters"),
    resultsBody: document.getElementById("resultsBody"),
    resultsSummary: document.getElementById("resultsSummary"),
    noticeBox: document.getElementById("noticeBox"),
    copyCodesButton: document.getElementById("copyCodesButton"),
    exportPdfButton: document.getElementById("exportPdfButton"),
    exportCsvButton: document.getElementById("exportCsvButton"),
    exportXlsxButton: document.getElementById("exportXlsxButton"),
    filterSections: Array.from(document.querySelectorAll(".filter-section")),
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function normalizeSearch(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function slugify(value) {
    return normalizeSearch(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function hasCoordinates(item) {
    return typeof item.latitud === "number" && typeof item.longitud === "number";
  }

  function setNotice(message) {
    if (!message) {
      els.noticeBox.style.display = "none";
      els.noticeBox.textContent = "";
      return;
    }

    els.noticeBox.style.display = "block";
    els.noticeBox.textContent = message;
  }

  function savePreferences() {
    const payload = {
      originInput: els.originInput.value.trim(),
      origin: state.origin,
      locality: els.localitySelect.value,
      text: els.textSearchInput.value,
      onlyBilingual: els.onlyBilingualCheckbox.checked,
      onlyWithCoords: els.onlyWithCoordsCheckbox.checked,
      onlyVoluntary: els.onlyVoluntaryCheckbox.checked,
      onlyZts: els.onlyZtsCheckbox.checked,
      onlyDifficult: els.onlyDifficultCheckbox.checked,
      provinces: Array.from(state.provinces),
      types: Array.from(state.types),
      sources: Array.from(state.sources),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function restorePreferences() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const saved = JSON.parse(raw);
      if (saved.originInput) {
        els.originInput.value = saved.originInput;
      }
      if (saved.origin) {
        state.origin = saved.origin;
        setOriginStatus(`Origen recordado: ${saved.origin.raw || saved.origin.label}`, "neutral");
      }
      if (saved.text) {
        els.textSearchInput.value = saved.text;
      }
      if (saved.onlyBilingual) els.onlyBilingualCheckbox.checked = true;
      if (saved.onlyWithCoords) els.onlyWithCoordsCheckbox.checked = true;
      if (saved.onlyVoluntary) els.onlyVoluntaryCheckbox.checked = true;
      if (saved.onlyZts) els.onlyZtsCheckbox.checked = true;
      if (saved.onlyDifficult) els.onlyDifficultCheckbox.checked = true;

      if (Array.isArray(saved.provinces)) {
        els.provinceFilters.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
          checkbox.checked = saved.provinces.includes(checkbox.value);
          setChipState(checkbox);
        });
      }
      if (Array.isArray(saved.types)) {
        els.typeFilters.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
          checkbox.checked = saved.types.includes(checkbox.value);
          setChipState(checkbox);
        });
      }
      if (Array.isArray(saved.sources)) {
        els.sourceFilters.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
          checkbox.checked = saved.sources.includes(checkbox.value);
          setChipState(checkbox);
        });
      }

      fillLocalityOptions();
      if (saved.locality) {
        els.localitySelect.value = saved.locality;
      }
    } catch (_error) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function getSelectedCheckboxValues(container) {
    return new Set(
      Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value),
    );
  }

  function setChipState(checkbox) {
    const chip = checkbox.closest(".chip");
    if (!chip) return;
    chip.classList.toggle("is-selected", checkbox.checked);
  }

  function buildChipFilters(container, items, onChange) {
    container.innerHTML = "";

    items.forEach((item) => {
      const label = document.createElement("label");
      label.className = "chip";
      const tooltip = TYPE_LABELS[item.label] ? ` title="${escapeHtml(TYPE_LABELS[item.label])}"` : "";
      label.innerHTML = `
        <input type="checkbox" value="${escapeHtml(item.id)}"${tooltip} />
        <span${tooltip}>${escapeHtml(item.label)}</span>
        <small>${item.count}</small>
      `;

      if (TYPE_LABELS[item.label]) {
        label.title = TYPE_LABELS[item.label];
      }

      const checkbox = label.querySelector("input");
      checkbox.addEventListener("change", () => {
        setChipState(checkbox);
        onChange();
      });

      container.appendChild(label);
    });
  }

  function updateSelectedSets() {
    state.provinces = getSelectedCheckboxValues(els.provinceFilters);
    state.types = getSelectedCheckboxValues(els.typeFilters);
    state.sources = getSelectedCheckboxValues(els.sourceFilters);
  }

  function provinceLabelToIdMap() {
    return new Map((meta.provinces || []).map((item) => [item.label, slugify(item.label)]));
  }

  function selectedProvinceLabels() {
    const idByLabel = provinceLabelToIdMap();
    return (meta.provinces || [])
      .map((item) => item.label)
      .filter((label) => state.provinces.has(idByLabel.get(label)));
  }

  function collectAllLocalities() {
    const set = new Set();
    Object.values(meta.localitiesByProvince || {}).forEach((items) => {
      items.forEach((item) => set.add(item));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }

  function fillLocalityOptions() {
    updateSelectedSets();
    const selectedProvinces = selectedProvinceLabels();
    const current = els.localitySelect.value;

    let localities = [];
    if (!selectedProvinces.length) {
      localities = collectAllLocalities();
    } else {
      const set = new Set();
      selectedProvinces.forEach((province) => {
        (meta.localitiesByProvince?.[province] || []).forEach((locality) => set.add(locality));
      });
      localities = Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
    }

    els.localitySelect.innerHTML = '<option value="">Todas</option>';
    localities.forEach((locality) => {
      const option = document.createElement("option");
      option.value = locality;
      option.textContent = locality;
      els.localitySelect.appendChild(option);
    });

    els.localitySelect.value = localities.includes(current) ? current : "";
  }

  function calculateDistanceFromOrigin(item) {
    if (!state.origin || !hasCoordinates(item)) {
      return null;
    }

    return haversine(state.origin.lat, state.origin.lon, item.latitud, item.longitud);
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function compareRows(a, b) {
    if (state.origin) {
      if (a.distanciaKm === null && b.distanciaKm !== null) return 1;
      if (a.distanciaKm !== null && b.distanciaKm === null) return -1;
      if (a.distanciaKm !== null && b.distanciaKm !== null && a.distanciaKm !== b.distanciaKm) {
        return a.distanciaKm - b.distanciaKm;
      }
    }

    return (
      a.provincia.localeCompare(b.provincia, "es") ||
      a.localidad.localeCompare(b.localidad, "es") ||
      a.nombre.localeCompare(b.nombre, "es")
    );
  }

  function getFilteredRows() {
    const locality = els.localitySelect.value;
    const text = normalizeSearch(els.textSearchInput.value);
    const onlyBilingual = els.onlyBilingualCheckbox.checked;
    const onlyWithCoords = els.onlyWithCoordsCheckbox.checked;
    const onlyVoluntary = els.onlyVoluntaryCheckbox.checked;
    const onlyZts = els.onlyZtsCheckbox.checked;
    const onlyDifficult = els.onlyDifficultCheckbox.checked;
    const provinceIdMap = provinceLabelToIdMap();

    return data
      .filter((item) => !state.provinces.size || state.provinces.has(provinceIdMap.get(item.provincia)))
      .filter((item) => !locality || item.localidad === locality)
      .filter((item) => !text || item.textoBusqueda.includes(text))
      .filter((item) => !onlyBilingual || item.esBilingue)
      .filter((item) => !onlyWithCoords || hasCoordinates(item))
      .filter((item) => !onlyVoluntary || item.esVoluntario)
      .filter((item) => !onlyZts || item.esZTS)
      .filter((item) => !onlyDifficult || item.esDificilDesempeno)
      .filter((item) => !state.types.size || state.types.has(slugify(item.tipoAbreviado)))
      .filter((item) => !state.sources.size || item.listasOrigenIds.some((sourceId) => state.sources.has(sourceId)))
      .map((item) => ({
        ...item,
        distanciaKm: calculateDistanceFromOrigin(item),
      }))
      .sort(compareRows);
  }

  function activeFilterPill(label) {
    return `<span class="filter-pill">${escapeHtml(label)}</span>`;
  }

  function typeTooltip(typeAbbreviation) {
    return TYPE_LABELS[typeAbbreviation] || typeAbbreviation;
  }

  function renderActiveFilters() {
    const pills = [];
    const selectedProvinces = selectedProvinceLabels();

    selectedProvinces.forEach((province) => pills.push(activeFilterPill(`Provincia: ${province}`)));
    if (els.localitySelect.value) pills.push(activeFilterPill(`Localidad: ${els.localitySelect.value}`));
    if (els.textSearchInput.value.trim()) pills.push(activeFilterPill(`Texto: ${els.textSearchInput.value.trim()}`));
    if (els.onlyBilingualCheckbox.checked) pills.push(activeFilterPill("Solo bilingües"));
    if (els.onlyWithCoordsCheckbox.checked) pills.push(activeFilterPill("Solo con coordenadas"));
    if (els.onlyVoluntaryCheckbox.checked) pills.push(activeFilterPill("Solo voluntarios"));
    if (els.onlyZtsCheckbox.checked) pills.push(activeFilterPill("Solo ZTS"));
    if (els.onlyDifficultCheckbox.checked) pills.push(activeFilterPill("Solo difícil desempeño"));

    Array.from(els.typeFilters.querySelectorAll('input:checked')).forEach((input) => {
      const label = input.closest(".chip")?.querySelector("span")?.textContent;
      if (label) pills.push(activeFilterPill(`Tipo: ${label}`));
    });

    Array.from(els.sourceFilters.querySelectorAll('input:checked')).forEach((input) => {
      const label = input.closest(".chip")?.querySelector("span")?.textContent;
      if (label) pills.push(activeFilterPill(`Lista: ${label}`));
    });

    if (state.origin?.label) pills.push(activeFilterPill(`Origen: ${state.origin.label}`));

    els.activeFilters.innerHTML = pills.length
      ? pills.join("")
      : '<span class="filter-pill filter-pill-muted">Sin filtros activos</span>';
  }

  function renderResults() {
    updateSelectedSets();
    state.currentRows = getFilteredRows();
    renderActiveFilters();

    const rowsHtml = state.currentRows
      .map((row, index) => {
        const distanceText = row.distanciaKm === null ? "Sin dato" : `${row.distanciaKm.toFixed(2)} km`;
        const details = [];
        const otherTags = [];
        const rowClasses = ["result-row"];

        if (row.dependencia) details.push(`<span class="tag">${escapeHtml(row.dependencia)}</span>`);
        if (row.esBilingue) details.push(`<span class="tag">Bilingüe ${escapeHtml(row.biling)}</span>`);
        row.listasOrigenLabels.forEach((label) => details.push(`<span class="tag">${escapeHtml(label)}</span>`));
        if (row.esVoluntario) {
          otherTags.push('<span class="tag tag-otros tag-voluntario">Voluntario</span>');
          rowClasses.push("row-voluntario");
        }
        if (row.esZTS) {
          otherTags.push('<span class="tag tag-otros tag-zts">ZTS</span>');
          rowClasses.push("row-zts");
        }
        if (row.esDificilDesempeno) {
          otherTags.push('<span class="tag tag-otros tag-dificil">Difícil desempeño</span>');
          rowClasses.push("row-dificil");
        }

        return `
          <tr class="${rowClasses.join(" ")}">
            <td><span class="rank-badge">${index + 1}</span></td>
            <td><code>${escapeHtml(row.codigo)}</code></td>
            <td><span class="type-badge" title="${escapeHtml(typeTooltip(row.tipoAbreviado))}">${escapeHtml(row.tipoAbreviado)}</span></td>
            <td>
              <div class="center-main">
                <strong>${escapeHtml(row.nombre)}</strong>
                <span class="muted">${escapeHtml(row.denominacion)}</span>
              </div>
            </td>
            <td><span class="distance">${distanceText}</span></td>
            <td>${escapeHtml(row.localidad || "-")}</td>
            <td>${escapeHtml(row.provincia || "-")}</td>
            <td>
              <div class="tag-list">${otherTags.join("") || '<span class="muted">Sin marcas</span>'}</div>
            </td>
            <td>
              <div class="center-main">
                <div class="tag-list">${details.join("") || '<span class="muted">Sin extras</span>'}</div>
                <span class="muted">${escapeHtml(row.municipio || "")} · ${escapeHtml(row.telefono || "Sin teléfono")}</span>
                <span class="muted">${escapeHtml(row.ensenanzas || "Sin enseñanzas")}</span>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    els.resultsBody.innerHTML =
      rowsHtml || '<tr><td colspan="9">No hay centros que cumplan los filtros actuales.</td></tr>';

    const orderedBy = state.origin
      ? `Ordenados por distancia desde “${state.origin.label}”.`
      : "Orden alfabético por provincia, localidad y nombre.";
    els.resultsSummary.textContent = `${state.currentRows.length} resultados · ${orderedBy}`;

    const notices = [];
    if (state.origin && state.currentRows.some((row) => row.distanciaKm === null)) {
      notices.push("Algunos centros no tienen coordenadas y se colocan al final al ordenar por distancia.");
    }
    setNotice(notices.join(" "));
    savePreferences();
  }

  async function geocodeOrigin(query) {
    const trimmed = query.trim();
    if (!trimmed) {
      throw new Error("Introduce una calle, pueblo o código postal.");
    }

    const candidates = [`${trimmed}, Andalucía, España`, `${trimmed}, España`, trimmed];

    for (const candidate of candidates) {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "es");
      url.searchParams.set("accept-language", "es");
      url.searchParams.set("q", candidate);

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error("No se pudo consultar el servicio de geocodificación.");
      }

      const results = await response.json();
      if (results.length) {
        const first = results[0];
        return {
          lat: Number(first.lat),
          lon: Number(first.lon),
          label: trimmed,
          raw: first.display_name,
        };
      }
    }

    throw new Error("No he encontrado ese punto. Prueba con más detalle: calle, pueblo o código postal.");
  }

  function setOriginStatus(message, tone) {
    els.originStatus.textContent = message;
    els.originStatus.classList.toggle("helper-error", tone === "error");
  }

  async function handleOriginSubmit(event) {
    event.preventDefault();
    const query = els.originInput.value.trim();
    const submitButton = els.originForm.querySelector("button[type='submit']");

    setOriginStatus("Buscando la ubicación…", "neutral");
    submitButton.disabled = true;

    try {
      state.origin = await geocodeOrigin(query);
      setOriginStatus(`Origen encontrado: ${state.origin.raw}`, "neutral");
      renderResults();
    } catch (error) {
      state.origin = null;
      setOriginStatus(error.message, "error");
      renderResults();
    } finally {
      submitButton.disabled = false;
    }
  }

  function clearOrigin() {
    state.origin = null;
    els.originInput.value = "";
    setOriginStatus(
      "Si no indicas un origen, el listado se ordena alfabéticamente por provincia, localidad y nombre.",
      "neutral",
    );
    renderResults();
  }

  function exportRowsForDownload() {
    return state.currentRows.map((row, index) => ({
      orden: index + 1,
      código: row.codigo,
      tipo: row.tipoAbreviado,
      nombre: row.nombre,
      denominación: row.denominacion,
      distancia_km: row.distanciaKm === null ? "" : Number(row.distanciaKm.toFixed(3)),
      localidad: row.localidad,
      municipio: row.municipio,
      provincia: row.provincia,
      código_postal: row.codigoPostal,
      teléfono: row.telefono,
      dependencia: row.dependencia,
      enseñanzas: row.ensenanzas,
      servicios: row.servicios,
      bilingüe: row.biling,
      voluntario: row.esVoluntario ? "Sí" : "",
      zts: row.esZTS ? "Sí" : "",
      difícil_desempeño: row.esDificilDesempeno ? "Sí" : "",
      listas_origen: row.listasOrigenLabels.join(" | "),
      email: row.email || "",
      latitud: row.latitud ?? "",
      longitud: row.longitud ?? "",
    }));
  }

  function exportRowsForXlsx() {
    return state.currentRows.map((row, index) => ({
      marcar: "☐",
      orden: index + 1,
      código: row.codigo,
      tipo: row.tipoAbreviado,
      nombre: row.nombre,
      denominación: row.denominacion,
      distancia_km: row.distanciaKm === null ? "" : Number(row.distanciaKm.toFixed(3)),
      localidad: row.localidad,
      municipio: row.municipio,
      provincia: row.provincia,
      código_postal: row.codigoPostal,
      teléfono: row.telefono,
      dependencia: row.dependencia,
      enseñanzas: row.ensenanzas,
      servicios: row.servicios,
      bilingüe: row.biling,
      voluntario: row.esVoluntario ? "Sí" : "",
      zts: row.esZTS ? "Sí" : "",
      difícil_desempeño: row.esDificilDesempeno ? "Sí" : "",
      listas_origen: row.listasOrigenLabels.join(" | "),
      email: row.email || "",
      latitud: row.latitud ?? "",
      longitud: row.longitud ?? "",
    }));
  }

  function downloadBlob(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const rows = exportRowsForDownload();
    if (!rows.length) {
      setNotice("No hay resultados para exportar.");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");

    downloadBlob("centros-ordenados.csv", "\ufeff" + csv, "text/csv;charset=utf-8");
  }

  function exportXlsx() {
    const rows = exportRowsForXlsx();
    if (!rows.length) {
      setNotice("No hay resultados para exportar.");
      return;
    }

    if (!window.XLSX) {
      setNotice("La librería XLSX no está disponible en esta página.");
      return;
    }

    const worksheet = window.XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 8 },
      { wch: 12 },
      { wch: 10 },
      { wch: 34 },
      { wch: 38 },
      { wch: 14 },
      { wch: 16 },
      { wch: 22 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 18 },
      { wch: 28 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
    ];
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Centros");
    window.XLSX.writeFile(workbook, "centros-ordenados.xlsx");
  }

  function exportPdf() {
    const rows = exportRowsForDownload();
    if (!rows.length) {
      setNotice("No hay resultados para exportar.");
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      setNotice("La librería PDF no está disponible en esta página.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const exportDate = new Date().toLocaleString("es-ES");
    const filterText = els.activeFilters.textContent?.trim() || "Sin filtros activos";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Centros ordenados", 14, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Exportado: ${exportDate}`, 14, 20);

    const wrappedFilters = doc.splitTextToSize(`Filtros: ${filterText}`, 265);
    doc.text(wrappedFilters, 14, 26);

    doc.autoTable({
      startY: 26 + wrappedFilters.length * 4 + 2,
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 109, 119] },
      alternateRowStyles: { fillColor: [245, 249, 250] },
      margin: { left: 10, right: 10 },
      head: [["#", "Código", "Tipo", "Centro", "Distancia", "Localidad", "Provincia", "Otros"]],
      body: state.currentRows.map((row, index) => [
        index + 1,
        row.codigo,
        row.tipoAbreviado,
        row.nombre,
        row.distanciaKm === null ? "Sin dato" : `${row.distanciaKm.toFixed(2)} km`,
        row.localidad,
        row.provincia,
        row.otrosLabels.join(", ") || "Sin marcas",
      ]),
      didDrawPage: function (data) {
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.setFontSize(8);
        doc.text(`Página ${data.pageNumber}`, pageSize.getWidth() - 24, pageHeight - 6);
      },
    });

    doc.save("centros-ordenados.pdf");
  }

  async function copyCodes() {
    if (!state.currentRows.length) {
      setNotice("No hay resultados para copiar.");
      return;
    }

    const codes = state.currentRows.map((row) => row.codigo).join("\n");
    try {
      await navigator.clipboard.writeText(codes);
      setNotice("Códigos copiados al portapapeles.");
    } catch (_error) {
      setNotice("No se pudo copiar al portapapeles. Usa la exportación CSV o XLSX.");
    }
  }

  function clearCheckboxes(container) {
    container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.checked = false;
      setChipState(checkbox);
    });
  }

  function setAllCheckboxes(container, checked) {
    container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.checked = checked;
      setChipState(checkbox);
    });
  }

  function setupAccordion() {
    els.filterSections.forEach((section) => {
      section.addEventListener("toggle", () => {
        if (!section.open) {
          return;
        }

        els.filterSections.forEach((otherSection) => {
          if (otherSection !== section) {
            otherSection.open = false;
          }
        });
      });
    });
  }

  function resetFilters() {
    clearOrigin();
    els.localitySelect.value = "";
    els.textSearchInput.value = "";
    els.onlyBilingualCheckbox.checked = false;
    els.onlyWithCoordsCheckbox.checked = false;
    els.onlyVoluntaryCheckbox.checked = false;
    els.onlyZtsCheckbox.checked = false;
    els.onlyDifficultCheckbox.checked = false;
    clearCheckboxes(els.provinceFilters);
    fillLocalityOptions();
    clearCheckboxes(els.typeFilters);
    clearCheckboxes(els.sourceFilters);
    renderResults();
  }

  function bindEvents() {
    els.originForm.addEventListener("submit", handleOriginSubmit);
    els.clearOriginButton.addEventListener("click", clearOrigin);

    els.localitySelect.addEventListener("change", renderResults);
    els.textSearchInput.addEventListener("input", renderResults);
    els.onlyBilingualCheckbox.addEventListener("change", renderResults);
    els.onlyWithCoordsCheckbox.addEventListener("change", renderResults);
    els.onlyVoluntaryCheckbox.addEventListener("change", renderResults);
    els.onlyZtsCheckbox.addEventListener("change", renderResults);
    els.onlyDifficultCheckbox.addEventListener("change", renderResults);

    els.selectAllProvincesButton.addEventListener("click", () => {
      setAllCheckboxes(els.provinceFilters, true);
      fillLocalityOptions();
      renderResults();
    });

    els.clearProvincesButton.addEventListener("click", () => {
      clearCheckboxes(els.provinceFilters);
      fillLocalityOptions();
      renderResults();
    });

    els.clearTypesButton.addEventListener("click", () => {
      clearCheckboxes(els.typeFilters);
      renderResults();
    });

    els.clearSourcesButton.addEventListener("click", () => {
      clearCheckboxes(els.sourceFilters);
      renderResults();
    });

    els.resetFiltersButton.addEventListener("click", resetFilters);
    els.exportCsvButton.addEventListener("click", exportCsv);
    els.exportPdfButton.addEventListener("click", exportPdf);
    els.exportXlsxButton.addEventListener("click", exportXlsx);
    els.copyCodesButton.addEventListener("click", copyCodes);
  }

  function init() {
    buildChipFilters(
      els.provinceFilters,
      (meta.provinces || []).map((item) => ({ id: slugify(item.label), label: item.label, count: item.count })),
      () => {
        fillLocalityOptions();
        renderResults();
      },
    );
    buildChipFilters(els.typeFilters, meta.types || [], renderResults);
    buildChipFilters(
      els.sourceFilters,
      (meta.sourceLists || []).filter((item) => item.label !== "Bilingüe"),
      renderResults,
    );

    fillLocalityOptions();

    restorePreferences();
    setupAccordion();
    bindEvents();
    renderResults();
  }

  init();
})();
